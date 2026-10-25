'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Lock, Unlock, Zap, Layers, RefreshCw, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, ClipboardList } from 'lucide-react';

/**
 * Claude API grading, behind a password. Two new ways to grade, next to (not instead of) the manual
 * Gemini workflow:
 *   - "Grade selected with Claude": the chosen copies are sent as Message Batches (half price). The
 *     page keeps collecting while it is open; results are saved automatically when Claude is done.
 *   - "Grade now": one copy immediately (full price).
 * Every check is written to the log below, and warnings / notifications fire from the shared save step.
 */
interface Target { _id: string; name: string; board?: string | null; status: 'PENDING' | 'CORRECTED' }
interface Status {
    configured?: boolean; model?: string;
    counts: Record<string, number>; bySubmission: Record<string, { status: string; mode: string; error: string }>;
    active: number; queuedToSend: number; costUSD: number;
}
interface LogEntry {
    _id: string; createdAt: string; studentName: string; code: string; source: string; status: string; reason: string;
    counts: { total: number; correct: number; incorrect: number; skipped: number }; grade: string | null; unreadable: boolean;
    warning: { triggered: boolean; count: number; limit: number | null; notified: boolean };
    usage: { input: number; output: number; cacheRead: number; cacheWrite: number }; costUSD: number; reviewed: { at: string | null };
}

const KEY = 'claude_unlock';
const SOURCE_LABEL: Record<string, string> = { 'claude-batch': 'Claude batch', 'claude-now': 'Claude now', 'gemini-import': 'Gemini import', 'manual-edit': 'Manual edit' };
const adminAuth = (): Record<string, string> => { try { const t = localStorage.getItem('adminToken'); return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; } };

export default function ClaudeGradingSection({ assignmentId, targets, onChanged }: { assignmentId: string; targets: Target[]; onChanged: () => void }) {
    const [unlock, setUnlock] = useState<{ token: string; expiresAt: number } | null>(null);
    const [pw, setPw] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [busy, setBusy] = useState<string | null>(null); // 'unlock' | 'batch' | 'tick' | submission id
    const [status, setStatus] = useState<Status | null>(null);
    const [regrade, setRegrade] = useState(false);
    const [logOpen, setLogOpen] = useState(false);
    const [logFilter, setLogFilter] = useState<'all' | 'warnings' | 'failed' | 'unreviewed'>('all');
    const [log, setLog] = useState<{ entries: LogEntry[]; totals: any } | null>(null);
    const alive = useRef(true);
    useEffect(() => () => { alive.current = false; }, []);

    // Restore a still-valid unlock for this browser session
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(KEY);
            if (raw) { const u = JSON.parse(raw); if (u.expiresAt > Date.now()) setUnlock(u); else sessionStorage.removeItem(KEY); }
        } catch { }
    }, []);

    const headers = useCallback((): Record<string, string> => ({ 'Content-Type': 'application/json', ...adminAuth(), 'x-claude-unlock': unlock?.token || '' }), [unlock]);
    const lock = useCallback(() => { try { sessionStorage.removeItem(KEY); } catch { } setUnlock(null); setStatus(null); setLog(null); }, []);

    /** fetch wrapper: a "locked" answer (expired / invalid token) sends the admin back to the password box. */
    const call = useCallback(async (url: string, init?: RequestInit) => {
        const res = await fetch(url, { cache: 'no-store', ...init, headers: { ...headers(), ...(init?.headers || {}) } });
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 && data.locked) { lock(); throw new Error('Locked - enter the password again'); }
        return { res, data };
    }, [headers, lock]);

    const doUnlock = async () => {
        setBusy('unlock');
        try {
            const res = await fetch('/api/admin/claude/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json', ...adminAuth() }, body: JSON.stringify({ password: pw }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Wrong password');
            const u = { token: data.token, expiresAt: data.expiresAt };
            sessionStorage.setItem(KEY, JSON.stringify(u));
            setUnlock(u); setPw(''); setShowPw(false);
            if (data.configured === false) toast.error('The Claude API key is not set on the server yet (ANTHROPIC_API_KEY).');
        } catch (e: any) { toast.error(e.message || 'Could not unlock'); }
        finally { setBusy(null); }
    };

    // ---- status + the collecting loop (runs only while this panel is open and unlocked)
    const tick = useCallback(async (quiet = true) => {
        if (!unlock) return;
        try {
            const { res, data } = await call(`/api/admin/assignments/${assignmentId}/claude-tick`, { method: 'POST' });
            if (!res.ok) throw new Error(data.error || 'Check failed');
            if (!alive.current) return;
            setStatus(prev => ({ ...(prev || {} as Status), ...data }));
            if (data.collected > 0) { toast.success(`${data.collected} copy${data.collected === 1 ? '' : 'ies'} graded by Claude`); onChanged(); if (logOpen) loadLog(); }
            return data as Status & { sent: number; collected: number };
        } catch (e: any) { if (!quiet) toast.error(e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unlock, call, assignmentId, onChanged, logOpen]);

    useEffect(() => {
        if (!unlock) return;
        call(`/api/admin/assignments/${assignmentId}/claude-status`).then(({ data }) => { if (alive.current && data.counts) setStatus(data); }).catch(() => { });
    }, [unlock, assignmentId, call]);

    useEffect(() => {
        if (!unlock || !status || status.active === 0) return;
        const id = setInterval(() => { if (document.visibilityState === 'visible') tick(); }, status.queuedToSend > 0 ? 3000 : 20000);
        return () => clearInterval(id);
    }, [unlock, status?.active, status?.queuedToSend, tick]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadLog = useCallback(async (f = logFilter) => {
        if (!unlock) return;
        try {
            const { res, data } = await call(`/api/admin/assignments/${assignmentId}/claude-log?filter=${f}`);
            if (res.ok && alive.current) setLog(data);
        } catch { }
    }, [unlock, call, assignmentId, logFilter]);
    useEffect(() => { if (logOpen) loadLog(logFilter); }, [logOpen, logFilter, unlock]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- actions
    const startBatch = async () => {
        const ids = targets.map(t => t._id);
        if (ids.length === 0) return toast.error('No submissions selected (step 1)');
        setBusy('batch');
        try {
            const { res, data } = await call(`/api/admin/assignments/${assignmentId}/claude-grade`, { method: 'POST', body: JSON.stringify({ action: 'queue', submissionIds: ids, regrade }) });
            if (!res.ok) throw new Error(data.error || 'Could not start');
            const skipped: Array<{ name: string; reason: string }> = data.skipped || [];
            if (data.queued > 0) toast.success(`${data.queued} copies sent to Claude. You can leave this page open and check back.`);
            if (skipped.length) toast(`${skipped.length} skipped: ${skipped.slice(0, 3).map(s => `${s.name} (${s.reason})`).join(', ')}${skipped.length > 3 ? '…' : ''}`, { icon: 'ℹ️', duration: 7000 });
            const s = await tick(false);
            if (s) setStatus(prev => ({ ...(prev || {} as Status), ...s }));
        } catch (e: any) { toast.error(e.message); }
        finally { setBusy(null); }
    };

    const gradeNow = async (t: Target) => {
        let again = regrade;
        if (t.status === 'CORRECTED' && !again) {
            if (!confirm(`${t.name} is already graded. Re-grade with Claude and replace the existing result? (costs a few cents)`)) return;
            again = true;
        }
        setBusy(t._id);
        try {
            const { res, data } = await call(`/api/admin/assignments/${assignmentId}/claude-grade`, { method: 'POST', body: JSON.stringify({ action: 'now', submissionId: t._id, regrade: again }) });
            if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Grading failed');
            if (data.fallbackToBatch) toast(data.message, { icon: '⏳', duration: 8000 });
            else { const a = data.saved?.aiReview; toast.success(`${t.name}: ✓${a?.correct} ✗${a?.incorrect} ⊘${a?.skippedOrIncomplete}${data.saved?.warning ? ' - warning sent' : ''} ($${(data.costUSD || 0).toFixed(3)})`); onChanged(); }
            tick();
        } catch (e: any) { toast.error(e.message); }
        finally { setBusy(null); }
    };

    const markReviewed = async (body: any) => {
        await call(`/api/admin/assignments/${assignmentId}/claude-log`, { method: 'PATCH', body: JSON.stringify(body) }).catch(() => { });
        loadLog();
    };

    // ---------------------------------------------------------------- locked view
    if (!unlock) {
        return (
            <section className="rounded-xl border border-amber-300/25 bg-amber-400/[0.05] p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-300" />
                    <h3 className="text-sm font-black text-white">Claude API grading</h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-200 border border-amber-300/30">PASSWORD PROTECTED</span>
                </div>
                <p className="text-[11px] sm:text-xs text-violet-200/60">Grade copies automatically with Claude instead of the manual chat steps above. Batch grading is cheap and slower; Grade now is instant.</p>
                {!showPw ? (
                    <button onClick={() => setShowPw(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-black active:scale-95 transition-transform">
                        <Lock className="h-4 w-4" /> Unlock Claude grading
                    </button>
                ) : (
                    <form onSubmit={e => { e.preventDefault(); doUnlock(); }} className="flex flex-col sm:flex-row gap-2">
                        <input type="password" autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="Password"
                            className="flex-1 bg-[#0b0718] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/60" />
                        <button type="submit" disabled={busy === 'unlock' || !pw} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-black disabled:opacity-50">
                            {busy === 'unlock' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />} Unlock
                        </button>
                    </form>
                )}
            </section>
        );
    }

    // ---------------------------------------------------------------- unlocked view
    const c = status?.counts || {};
    const chip = (t: Target) => {
        const j = status?.bySubmission?.[t._id];
        if (j && ['queued', 'preparing'].includes(j.status)) return <span className="text-[10px] font-bold text-sky-300">Queued</span>;
        if (j && ['batched', 'collecting'].includes(j.status)) return <span className="text-[10px] font-bold text-fuchsia-300 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />In Claude batch</span>;
        if (j?.status === 'failed') return <span className="text-[10px] font-bold text-rose-300" title={j.error}>Failed: {j.error.slice(0, 28)}</span>;
        if (j?.status === 'skipped') return <span className="text-[10px] font-bold text-slate-400" title={j.error}>Skipped</span>;
        return t.status === 'CORRECTED' ? <span className="text-[10px] font-bold text-lime-300">Checked</span> : <span className="text-[10px] font-bold text-slate-400">Not checked</span>;
    };
    const money = (n?: number) => `$${(n || 0).toFixed(3)}`;

    return (
        <section className="rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/[0.05] p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <Unlock className="h-4 w-4 text-lime-300" />
                <h3 className="text-sm font-black text-white">Claude API grading</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-400/15 text-fuchsia-200 border border-fuchsia-300/30">{(status?.model || 'claude-sonnet-5-5')}</span>
                <button onClick={lock} className="ml-auto text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1"><Lock className="h-3 w-3" /> Lock</button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {c.queued + (c.preparing || 0) > 0 && <span className="px-2 py-0.5 rounded bg-sky-400/15 text-sky-200 border border-sky-300/25">Queued {(c.queued || 0) + (c.preparing || 0)}</span>}
                {(c.batched || 0) + (c.collecting || 0) > 0 && <span className="px-2 py-0.5 rounded bg-fuchsia-400/15 text-fuchsia-200 border border-fuchsia-300/25">With Claude {(c.batched || 0) + (c.collecting || 0)}</span>}
                <span className="px-2 py-0.5 rounded bg-lime-400/10 text-lime-200 border border-lime-300/25">Graded {c.done || 0}</span>
                {(c.failed || 0) > 0 && <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-200 border border-rose-400/30">Failed {c.failed}</span>}
                <span className="text-violet-200/50">Cost so far {money(status?.costUSD)}</span>
                <button onClick={async () => { setBusy('tick'); await tick(false); setBusy(null); }} disabled={busy === 'tick'}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold">
                    <RefreshCw className={`h-3 w-3 ${busy === 'tick' ? 'animate-spin' : ''}`} /> Check now
                </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <button onClick={startBatch} disabled={busy === 'batch' || targets.length === 0}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white text-sm font-black shadow-lg shadow-fuchsia-500/25 disabled:opacity-50 active:scale-95 transition-transform">
                    {busy === 'batch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                    Grade selected with Claude (batch) · {targets.length}
                </button>
                <label className="flex items-center gap-2 text-[11px] text-violet-200/70 cursor-pointer">
                    <input type="checkbox" checked={regrade} onChange={e => setRegrade(e.target.checked)} className="rounded border-white/20 bg-[#1d1535] text-fuchsia-500" />
                    Also re-grade copies that are already checked
                </label>
            </div>
            <p className="text-[11px] text-violet-200/50">The copies chosen in step 1 are sent together at half price. Claude usually needs a few minutes (sometimes longer); results are saved here automatically while this page is open, or when you come back and press Check now.</p>

            {targets.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                    {targets.map(t => (
                        <div key={t._id} className="flex items-center gap-2 px-3 py-1.5">
                            <span className="flex-1 min-w-0 text-sm text-white truncate">{t.name}</span>
                            {t.board && <span className="text-[10px] text-cyan-200/70 hidden sm:inline">{t.board}</span>}
                            {chip(t)}
                            <button onClick={() => gradeNow(t)} disabled={busy === t._id}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-black text-[11px] font-black disabled:opacity-50 active:scale-95 transition-transform">
                                {busy === t._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Grade now
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Log */}
            <div className="rounded-lg border border-white/10">
                <button onClick={() => setLogOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2 text-left">
                    <span className="flex items-center gap-2 text-sm font-bold text-white"><ClipboardList className="h-4 w-4 text-violet-300" /> Auto-check log</span>
                    {logOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {logOpen && (
                    <div className="border-t border-white/10 p-3 space-y-2">
                        {log && (
                            <p className="text-[11px] text-violet-200/70">
                                {log.totals.checks} checks · <span className="text-rose-300">{log.totals.warnings} warnings</span> · {log.totals.failures} failed/skipped · cost this week {money(log.totals.costWeek)} · total {money(log.totals.costTotal)} · {log.totals.unreviewed} not reviewed
                            </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {(['all', 'warnings', 'failed', 'unreviewed'] as const).map(f => (
                                <button key={f} onClick={() => setLogFilter(f)} className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${logFilter === f ? 'bg-fuchsia-600 text-white' : 'bg-white/5 text-slate-300'}`}>
                                    {f === 'all' ? 'All' : f === 'warnings' ? 'Warnings' : f === 'failed' ? 'Failed' : 'Not reviewed'}
                                </button>
                            ))}
                            <button onClick={() => markReviewed({ all: true })} className="ml-auto text-[11px] font-bold text-lime-300 hover:underline">Mark all reviewed</button>
                        </div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                            {(log?.entries || []).length === 0 && <p className="text-xs text-violet-200/50 py-3">Nothing logged yet.</p>}
                            {(log?.entries || []).map(e => (
                                <div key={e._id} className={`py-2 text-[11px] flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 ${e.warning.triggered ? 'bg-rose-500/[0.07]' : ''}`}>
                                    <div className="sm:w-44 shrink-0">
                                        <p className="font-bold text-white truncate">{e.studentName || e.code}</p>
                                        <p className="text-violet-200/50">{new Date(e.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} · {SOURCE_LABEL[e.source] || e.source}</p>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {e.status === 'done' ? (
                                            <p className="text-slate-200">
                                                <span className="text-lime-300">✓{e.counts.correct}</span> <span className="text-rose-300">✗{e.counts.incorrect}</span> <span className="text-slate-300">⊘{e.counts.skipped}</span>
                                                {' · '}{e.unreadable ? <span className="text-amber-300">unreadable</span> : e.grade}
                                                {e.warning.triggered && <span className="text-rose-300 font-bold"> · ⚠ warning ({e.warning.count}/{e.warning.limit}){e.warning.notified ? ', student told' : ''}</span>}
                                            </p>
                                        ) : (
                                            <p className="text-rose-300 flex items-start gap-1"><AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {e.status}: {e.reason}</p>
                                        )}
                                        {e.costUSD > 0 && <p className="text-violet-200/40">{money(e.costUSD)} · tokens in {e.usage.input} / cached {e.usage.cacheRead} / out {e.usage.output}</p>}
                                    </div>
                                    {e.reviewed?.at
                                        ? <span className="text-lime-300/70 flex items-center gap-1 shrink-0"><CheckCircle2 className="h-3 w-3" /> reviewed</span>
                                        : <button onClick={() => markReviewed({ logId: e._id })} className="text-fuchsia-300 font-bold hover:underline shrink-0">Mark reviewed</button>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
