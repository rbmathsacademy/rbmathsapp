'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Copy, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { WeaknessReport, StudentWeakness } from '@/lib/weakness/types';
import { generateWeaknessPDF, buildAIExport } from './generateWeaknessPDF';

const LEVEL_STYLE: Record<string, string> = {
    Critical: 'bg-rose-500/15 text-rose-300 border-rose-400/40',
    Weak: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    Watch: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

export default function StudentWeaknessPanel({ batch }: { batch: string }) {
    const [report, setReport] = useState<WeaknessReport | null>(null);
    const [pending, setPending] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [open, setOpen] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const runId = useRef(0);

    // Loads the analysis. The server summarises a limited number of attempts per call, so keep
    // asking until nothing is pending.
    const load = async (rebuild = false) => {
        const id = ++runId.current;
        setLoading(true);
        setError('');
        try {
            let first = true;
            while (true) {
                const res = await fetch(`/api/admin/analytics/weakness?batch=${encodeURIComponent(batch)}${rebuild && first ? '&rebuild=1' : ''}`);
                first = false;
                const json = await res.json();
                if (id !== runId.current) return; // batch changed meanwhile
                if (!res.ok) throw new Error(json.error || 'Failed');
                setReport(json.report);
                setPending(json.progress.pending);
                setTotal(json.progress.totalAttempts);
                if (json.progress.pending <= 0) break;
            }
        } catch (e: any) {
            if (id === runId.current) setError(e.message || 'Failed to analyse');
        } finally {
            if (id === runId.current) setLoading(false);
        }
    };

    useEffect(() => {
        setReport(null);
        load();
        return () => { runId.current++; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batch]);

    const students: StudentWeakness[] = (report?.students || [])
        .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    const copyAI = async (onlyId?: string) => {
        if (!report) return;
        try {
            await navigator.clipboard.writeText(buildAIExport(report, onlyId));
            toast.success('Copied. Paste it into your AI along with your request.');
        } catch {
            toast.error('Could not copy to clipboard');
        }
    };

    const pdf = (onlyId?: string) => {
        if (!report) return;
        try { generateWeaknessPDF(report, onlyId); } catch (e) { console.error(e); toast.error('PDF generation failed'); }
    };

    return (
        <div className="space-y-4">
            {/* Header card: title + actions (actions become an even 3-up grid on phones) */}
            <div className="relative sd-gborder sd-card bg-[#140d27]/90 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between overflow-hidden">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(60%_80%_at_0%_0%,rgba(244,63,94,0.16),transparent_60%)]" />
                <div className="relative min-w-0">
                    <h2 className="text-base sm:text-lg font-black sd-title">Student Weakness Analysis</h2>
                    <p className="text-[11px] sm:text-xs text-violet-200/50 mt-1">
                        Built from every online test question (by topic and sub-topic) and the teacher ratings on assignments.
                    </p>
                </div>
                <div className="relative grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                    <button onClick={() => pdf()} disabled={!report || loading}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-fuchsia-500/25 disabled:opacity-50 active:scale-95 transition-transform">
                        <Download className="w-4 h-4 shrink-0" /> <span className="truncate">PDF<span className="hidden sm:inline"> (all)</span></span>
                    </button>
                    <button onClick={() => copyAI()} disabled={!report || loading}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs sm:text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform">
                        <Copy className="w-4 h-4 shrink-0" /> <span className="truncate">JSON<span className="hidden sm:inline"> for AI</span></span>
                    </button>
                    <button onClick={() => load(true)} disabled={loading} title="Re-read all test attempts from scratch"
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs sm:text-sm disabled:opacity-50 active:scale-95 transition-transform">
                        <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`} /> <span className="truncate">Refresh</span>
                    </button>
                </div>
            </div>

            {loading && (
                <div className="text-xs sm:text-sm text-fuchsia-200 bg-fuchsia-500/10 border border-fuchsia-400/20 rounded-xl px-4 py-3">
                    Analysing test attempts{total > 0 ? ` (${Math.max(0, total - pending)} of ${total} read)` : ''}... the first run for a batch is slow; later runs are quick.
                    {total > 0 && (
                        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 transition-[width] duration-500" style={{ width: `${Math.round(((total - pending) / total) * 100)}%` }} />
                        </div>
                    )}
                </div>
            )}
            {error && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {report && (
                <>
                    {report.notes.length > 0 && (
                        <ul className="text-[11px] sm:text-xs text-violet-200/50 list-disc pl-5 space-y-1">
                            {report.notes.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                    )}
                    <input
                        value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..."
                        className="w-full sm:w-72 bg-[#0b0718] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500/50"
                    />
                    <div className="space-y-2">
                        {students.map(s => {
                            const isOpen = open === s.studentId;
                            const counts = { Critical: 0, Weak: 0, Watch: 0 } as Record<string, number>;
                            s.weaknesses.forEach(w => counts[w.level]++);
                            return (
                                <div key={s.studentId} className={`relative sd-card bg-[#140d27]/90 rounded-2xl overflow-hidden ${isOpen ? 'sd-gborder' : 'sd-gborder sd-gborder-soft'}`}>
                                    <button onClick={() => setOpen(isOpen ? null : s.studentId)} className="w-full flex items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 text-left">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-white truncate">{s.name}</p>
                                            <p className="text-[11px] sm:text-xs text-violet-200/50">
                                                {s.overall.testsTaken} tests{s.overall.avgTestPct != null ? ` | avg ${s.overall.avgTestPct}%` : ''}
                                            </p>
                                            {/* Level counts wrap under the name on phones */}
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 sm:hidden">
                                                {(['Critical', 'Weak', 'Watch'] as const).map(l => counts[l] > 0 && (
                                                    <span key={l} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${LEVEL_STYLE[l]}`}>{counts[l]} {l}</span>
                                                ))}
                                                {s.weaknesses.length === 0 && <span className="text-[10px] text-lime-300">No weak areas</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="hidden sm:flex items-center gap-2">
                                                {(['Critical', 'Weak', 'Watch'] as const).map(l => counts[l] > 0 && (
                                                    <span key={l} className={`text-[11px] font-bold px-2 py-0.5 rounded border ${LEVEL_STYLE[l]}`}>{counts[l]} {l}</span>
                                                ))}
                                                {s.weaknesses.length === 0 && <span className="text-[11px] text-lime-300">No weak areas</span>}
                                            </div>
                                            {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                        </div>
                                    </button>
                                    {isOpen && (
                                        <div className="border-t border-white/5 p-3.5 sm:p-4 space-y-4">
                                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                                                <button onClick={() => pdf(s.studentId)} className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-transform">
                                                    <Download className="w-3.5 h-3.5" /> PDF for this student
                                                </button>
                                                <button onClick={() => copyAI(s.studentId)} className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-bold active:scale-95 transition-transform">
                                                    <Copy className="w-3.5 h-3.5" /> Copy JSON
                                                </button>
                                            </div>
                                            {s.weaknesses.length > 0 ? (
                                                <>
                                                    {/* Phones: one card per weak area */}
                                                    <div className="space-y-2 md:hidden">
                                                        {s.weaknesses.map((w, i) => (
                                                            <div key={i} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] uppercase tracking-wider font-bold text-violet-200/50 truncate">{w.topic}</p>
                                                                        <p className="text-sm font-bold text-white leading-snug">{w.category}</p>
                                                                    </div>
                                                                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${LEVEL_STYLE[w.level]}`}>{w.level}</span>
                                                                </div>
                                                                {w.source !== 'assignments' && (
                                                                    <div className="mt-2 space-y-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] text-violet-200/50 w-12 shrink-0">Student</span>
                                                                            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                                                <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500" style={{ width: `${Math.max(w.accuracy, 2)}%` }} />
                                                                            </div>
                                                                            <span className="text-[11px] font-bold text-white w-9 text-right">{w.accuracy}%</span>
                                                                        </div>
                                                                        {w.batchAccuracy != null && (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] text-violet-200/50 w-12 shrink-0">Batch</span>
                                                                                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                                                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500" style={{ width: `${Math.max(w.batchAccuracy, 2)}%` }} />
                                                                                </div>
                                                                                <span className="text-[11px] font-bold text-cyan-200 w-9 text-right">{w.batchAccuracy}%</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {w.reasons.length > 0 && <p className="mt-2 text-[11px] text-violet-100/60 leading-relaxed">{w.reasons.join('; ')}</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {/* Tablets and desktop: compact table */}
                                                    <div className="hidden md:block overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="text-xs uppercase text-violet-200/50 text-left">
                                                                    <th className="py-1 pr-3">Topic &gt;&gt; Sub-topic</th>
                                                                    <th className="py-1 pr-3">Level</th>
                                                                    <th className="py-1 pr-3">Accuracy</th>
                                                                    <th className="py-1 pr-3">Batch</th>
                                                                    <th className="py-1">Evidence</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-white/5">
                                                                {s.weaknesses.map((w, i) => (
                                                                    <tr key={i}>
                                                                        <td className="py-2 pr-3 text-gray-200"><span className="text-violet-200/50">{w.topic} &gt;&gt;</span> {w.category}</td>
                                                                        <td className="py-2 pr-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${LEVEL_STYLE[w.level]}`}>{w.level}</span></td>
                                                                        <td className="py-2 pr-3 text-gray-200 font-bold">{w.source === 'assignments' ? '-' : `${w.accuracy}%`}</td>
                                                                        <td className="py-2 pr-3 text-cyan-200/70">{w.batchAccuracy != null ? `${w.batchAccuracy}%` : '-'}</td>
                                                                        <td className="py-2 text-xs text-violet-100/60">{w.reasons.join('; ')}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-sm text-violet-200/50">No consistent weak area found yet.</p>
                                            )}
                                            {s.strengths.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="text-[11px] font-bold text-lime-300 mr-1">Strong:</span>
                                                    {s.strengths.slice(0, 6).map((t, i) => (
                                                        <span key={i} className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-lg bg-lime-400/10 border border-lime-300/25 text-lime-200">
                                                            {t.topic} &gt; {t.category} ({t.accuracy}%)
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {students.length === 0 && <p className="text-sm text-violet-200/50 py-6 text-center">No students found.</p>}
                    </div>
                </>
            )}
        </div>
    );
}
