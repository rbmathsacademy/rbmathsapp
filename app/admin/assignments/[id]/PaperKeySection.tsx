'use client';

import { useState } from 'react';
import Latex from 'react-latex-next';
import { toast } from 'react-hot-toast';
import { KeyRound, Copy, Braces, ExternalLink, Loader2, Save, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import {
    buildPreparePaperPrompt, parsePaperKeyReply, PAPER_KEY_RESPONSE_SCHEMA,
    type ParsedPaperKey, type PaperKeyQuestion, type TaxonomyTopic,
} from '@/lib/aiGrading';

export interface PaperKey { board: string; questions: PaperKeyQuestion[]; solutionsUrl?: string; savedAt?: string }
export interface PaperInfo { board: string; label: string; url: string | null }

const AI_STUDIO_URL = 'https://aistudio.google.com/prompts/new_chat';

const authHeaders = (): Record<string, string> => {
    try {
        const t = localStorage.getItem('adminToken');
        return t ? { Authorization: `Bearer ${t}` } : {};
    } catch { return {}; }
};

async function copyText(text: string, okMsg: string) {
    try { await navigator.clipboard.writeText(text); toast.success(okMsg); }
    catch { toast.error('Could not copy to clipboard'); }
}

/**
 * Step 0 of AI checking: a fixed, teacher-approved question list (number, topic, sub-topic,
 * expected answer) for each paper, prepared once with one AI chat, plus an optional link to the
 * teacher's own solutions. Every batch then uses the same count, topics and key.
 */
export default function PaperKeySection({ assignmentId, title, papers, keys, taxonomy, onSaved }: {
    assignmentId: string;
    title: string;
    papers: PaperInfo[];
    keys: PaperKey[];
    taxonomy: TaxonomyTopic[];
    onSaved: (keys: PaperKey[]) => void;
}) {
    // Once every paper (all boards) has its answers saved, the section stays folded and green
    const allSaved = papers.length > 0 && papers.every(p => (keys.find(k => (k.board || '') === p.board)?.questions.length || 0) > 0);
    const [expanded, setExpanded] = useState(!allSaved);
    return (
        <section className={`space-y-3 ${allSaved ? 'rounded-xl border border-lime-400/40 bg-lime-400/[0.05] p-3 shadow-[0_0_22px_-10px_rgba(163,230,53,0.6)]' : ''}`}>
            <button type="button" onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between gap-2 text-left">
                <span className={`text-sm font-black flex items-center gap-2 ${allSaved ? 'text-lime-300' : 'text-white'}`}>
                    {allSaved ? <CheckCircle2 className="h-4 w-4" /> : <KeyRound className="h-4 w-4 text-amber-300" />} 0 · Prepare the paper (once per paper){allSaved ? ' - done' : ''}
                </span>
                {allSaved && <span className="text-[11px] font-bold text-lime-300 shrink-0">{expanded ? 'Hide' : 'Show / edit'}</span>}
            </button>
            {expanded && <>
            <div>
                <p className="text-[11px] sm:text-xs text-violet-200/60 leading-relaxed mt-1">
                    Gives every batch the same fixed question list, topics and answer key, so the AI checks against a key instead of solving everything itself.
                    In <a href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer" className="text-fuchsia-300 underline inline-flex items-center gap-0.5">AI Studio <ExternalLink className="h-3 w-3" /></a>{' '}
                    attach only the question paper, paste the prompt, check the answers it gives, and save. Optionally add a Drive link to your own solutions PDF.
                </p>
            </div>
            {papers.length === 0 && <p className="text-xs text-violet-200/50">No question paper link on this assignment.</p>}
            {papers.map(p => (
                <PaperCard key={p.board || 'ALL'} assignmentId={assignmentId} title={title} paper={p} multi={papers.length > 1}
                    current={keys.find(k => (k.board || '') === p.board) || null} taxonomy={taxonomy} onSaved={onSaved} />
            ))}
            </>}
        </section>
    );
}

function PaperCard({ assignmentId, title, paper, multi, current, taxonomy, onSaved }: {
    assignmentId: string; title: string; paper: PaperInfo; multi: boolean;
    current: PaperKey | null; taxonomy: TaxonomyTopic[]; onSaved: (keys: PaperKey[]) => void;
}) {
    const [pasted, setPasted] = useState('');
    const [parsed, setParsed] = useState<ParsedPaperKey | null>(null);
    const [saving, setSaving] = useState(false);
    const [showList, setShowList] = useState(false);
    const [solutionsUrl, setSolutionsUrl] = useState(current?.solutionsUrl || '');
    const count = current?.questions.length || 0;

    const put = async (body: Record<string, unknown>, okMsg: string) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/assignments/${assignmentId}/paper-key`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ board: paper.board, ...body }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            onSaved(data.paperKeys || []);
            toast.success(okMsg);
            return true;
        } catch (e: any) {
            toast.error(e.message || 'Could not save');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const saveList = async () => {
        if (!parsed || parsed.questions.length === 0) return;
        if (await put({ questions: parsed.questions }, `Question list saved (${parsed.questions.length} questions)`)) {
            setPasted('');
            setParsed(null);
        }
    };

    const list = parsed?.questions.length ? parsed.questions : showList ? current?.questions || [] : [];
    const ready = count > 0 || !!current?.solutionsUrl;

    return (
        <div className={`rounded-xl p-3 space-y-3 border transition-colors ${ready
            ? 'bg-lime-400/[0.07] border-lime-300/50 shadow-[0_0_0_1px_rgba(163,230,53,0.15),0_10px_30px_-18px_rgba(132,204,22,0.6)]'
            : 'bg-white/[0.04] border-white/[0.07]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                        {multi ? paper.label : 'Question list & answer key'}
                        {ready ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-lime-400/20 text-lime-200 border border-lime-300/40">
                                ✓ KEY SET{count ? ` · ${count} Q` : ''}{current?.solutionsUrl ? ' · SOLUTIONS PDF' : ''}
                            </span>
                        ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-200 border border-amber-300/30">NOT SET</span>
                        )}
                    </p>
                    {count > 0 ? (
                        <button onClick={() => setShowList(v => !v)} className="text-[11px] text-lime-300 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Saved: {count} questions ({Array.from(new Set(current!.questions.map(q => q.topic))).join(', ')})
                            {showList ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                    ) : (
                        <p className="text-[11px] text-amber-200">Not prepared yet - the AI will solve the paper on its own in every batch.</p>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex">
                    {paper.url && (
                        <a href={paper.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold">
                            <ExternalLink className="h-3.5 w-3.5" /> Paper
                        </a>
                    )}
                    <button onClick={() => copyText(buildPreparePaperPrompt({ title, board: paper.board || null, taxonomy }), 'Prepare-paper prompt copied')}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold active:scale-95 transition-transform">
                        <Copy className="h-3.5 w-3.5" /> Prompt
                    </button>
                    <button onClick={() => copyText(JSON.stringify(PAPER_KEY_RESPONSE_SCHEMA, null, 2), 'Schema copied - AI Studio: Run settings > Structured output > Edit')}
                        title="Optional: response schema for AI Studio's Structured output"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold">
                        <Braces className="h-3.5 w-3.5" /> Schema
                    </button>
                </div>
            </div>

            <textarea
                value={pasted}
                onChange={e => { setPasted(e.target.value); setParsed(e.target.value.trim() ? parsePaperKeyReply(e.target.value) : null); }}
                placeholder={count ? 'Paste a new reply to replace the saved list' : "Paste the AI's JSON reply (the question list)"}
                rows={3}
                className="w-full bg-[#0b0718] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400/50"
            />
            {parsed && (
                <div className="space-y-1">
                    {parsed.errors.map((e, i) => <p key={i} className="text-xs text-rose-300 flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{e}</p>)}
                    {parsed.warnings.map((w, i) => <p key={i} className="text-xs text-amber-200 flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}</p>)}
                    {parsed.questions.length > 0 && (
                        <p className="text-xs text-lime-300">{parsed.questions.length} questions read. Check the answers below, then save.</p>
                    )}
                </div>
            )}

            {list.length > 0 && (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                    {list.map((q, i) => (
                        <div key={i} className="px-3 py-2 text-xs flex gap-3">
                            <span className="font-black text-white w-8 shrink-0">Q{q.question}</span>
                            <div className="min-w-0 flex-1">
                                <p className="text-violet-200/60">{q.topic}{q.subtopic ? ` > ${q.subtopic}` : ''}</p>
                                {q.answer && <div className="text-slate-100 break-words"><Latex>{q.answer}</Latex></div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {parsed && parsed.questions.length > 0 && (
                <button onClick={saveList} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 text-white text-xs font-black disabled:opacity-60 active:scale-95 transition-transform">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save question list
                </button>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Link2 className="h-3.5 w-3.5 text-violet-200/50 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input value={solutionsUrl} onChange={e => setSolutionsUrl(e.target.value)}
                        placeholder="Optional: Google Drive link to your solutions PDF (shared 'Anyone with the link')"
                        className="w-full bg-[#0b0718] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400/50" />
                </div>
                <button onClick={() => put({ solutionsUrl }, solutionsUrl ? 'Solutions link saved - it is added to every batch PDF' : 'Solutions link removed')}
                    disabled={saving || solutionsUrl === (current?.solutionsUrl || '')}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold disabled:opacity-40">
                    {solutionsUrl ? 'Save link' : current?.solutionsUrl ? 'Remove link' : 'Save link'}
                </button>
            </div>
        </div>
    );
}
