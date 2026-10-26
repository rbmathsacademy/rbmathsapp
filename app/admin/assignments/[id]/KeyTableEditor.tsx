'use client';

import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2, X, Copy } from 'lucide-react';
import type { PaperKeyQuestion, TaxonomyTopic } from '@/lib/aiGrading';

const OTHER = '__other__';

/** A dropdown of known names with an "Other..." escape that turns into a text box. */
function NameSelect({ value, options, placeholder, onChange }: { value: string; options: string[]; placeholder: string; onChange: (v: string) => void }) {
    const [typing, setTyping] = useState(false);
    const custom = typing || (value !== '' && !options.includes(value));
    if (custom) {
        return (
            <div className="flex gap-1">
                <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={typing}
                    className="min-w-0 flex-1 bg-[#0b0718] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400/50" />
                {options.length > 0 && (
                    <button type="button" onClick={() => { setTyping(false); onChange(''); }} title="Back to the list"
                        className="px-1.5 rounded-lg bg-white/10 text-violet-200/70 hover:bg-white/15"><X className="h-3 w-3" /></button>
                )}
            </div>
        );
    }
    return (
        <select value={value} onChange={e => { if (e.target.value === OTHER) { setTyping(true); onChange(''); } else onChange(e.target.value); }}
            className="w-full bg-[#0b0718] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400/50">
            <option value="">{placeholder}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
            <option value={OTHER}>✎ Other (type a new name)...</option>
        </select>
    );
}

/**
 * Manual question list / answer key editor: one row per question with label, topic, sub-topic (both
 * picked from the batch's question bank names) and the expected answer. Rows can be added, removed
 * and reordered, or copied from another board's key.
 */
export default function KeyTableEditor({ initial, taxonomy, copySources, saving, onSave, onCancel }: {
    initial: PaperKeyQuestion[];
    taxonomy: TaxonomyTopic[];
    copySources: { label: string; questions: PaperKeyQuestion[] }[];
    saving: boolean;
    onSave: (rows: PaperKeyQuestion[]) => void;
    onCancel: () => void;
}) {
    const blank = (n: number): PaperKeyQuestion => ({ question: String(n), topic: '', subtopic: '', answer: '' });
    const [rows, setRows] = useState<PaperKeyQuestion[]>(initial.length ? initial.map(r => ({ ...r })) : [blank(1)]);
    const topics = taxonomy.map(t => t.topic);

    const set = (i: number, patch: Partial<PaperKeyQuestion>) => setRows(prev => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    const move = (i: number, d: number) => setRows(prev => {
        const j = i + d; if (j < 0 || j >= prev.length) return prev;
        const next = prev.slice(); [next[i], next[j]] = [next[j], next[i]]; return next;
    });
    const addRow = () => setRows(prev => {
        const last = prev[prev.length - 1];
        const num = last && /^\d+$/.test(last.question) ? String(Number(last.question) + 1) : String(prev.length + 1);
        return [...prev, { ...blank(0), question: num, topic: last?.topic || '' }];
    });

    const labels = rows.map(r => r.question.trim().toUpperCase());
    const dup = labels.filter((l, i) => l && labels.indexOf(l) !== i);
    const missingTopic = rows.filter(r => r.question.trim() && !r.topic.trim()).length;
    const valid = rows.some(r => r.question.trim()) && dup.length === 0;

    return (
        <div className="space-y-2 rounded-xl border border-amber-300/30 bg-black/20 p-2 sm:p-3">
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-black text-white flex-1">Question list &amp; answer key ({rows.filter(r => r.question.trim()).length} questions)</p>
                {copySources.map(c => (
                    <button key={c.label} type="button"
                        onClick={() => { if (!rows.some(r => r.answer || r.topic) || window.confirm('Replace the rows below with the key of ' + c.label + '?')) setRows(c.questions.map(q => ({ ...q }))); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white">
                        <Copy className="h-3 w-3" /> Copy from {c.label}
                    </button>
                ))}
            </div>
            {dup.length > 0 && <p className="text-xs text-rose-300">Duplicate question labels: {Array.from(new Set(dup)).join(', ')}. Each question needs a unique label (e.g. A1, B1 when sections restart).</p>}
            {missingTopic > 0 && <p className="text-[11px] text-amber-200">{missingTopic} question(s) have no topic yet - they will be left out of the weakness analysis.</p>}

            <div className="max-h-[28rem] overflow-y-auto space-y-2 pr-1">
                {rows.map((r, i) => {
                    const subs = taxonomy.find(t => t.topic === r.topic)?.subtopics || [];
                    return (
                        <div key={i} className="rounded-lg bg-white/[0.04] border border-white/[0.07] p-2 grid grid-cols-[3.5rem_1fr_auto] sm:grid-cols-[4rem_1fr_1fr_auto] gap-2 items-start">
                            <input value={r.question} onChange={e => set(i, { question: e.target.value })} placeholder="No."
                                className="bg-[#0b0718] border border-white/10 rounded-lg px-2 py-1.5 text-xs font-black text-white text-center focus:outline-none focus:border-amber-400/50" />
                            <div className="min-w-0 space-y-1.5 sm:contents">
                                <NameSelect value={r.topic} options={topics} placeholder="Topic" onChange={v => set(i, { topic: v, subtopic: v === r.topic ? r.subtopic : '' })} />
                                <NameSelect value={r.subtopic} options={subs} placeholder="Sub-topic" onChange={v => set(i, { subtopic: v })} />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-1 row-span-1">
                                <button type="button" onClick={() => move(i, -1)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15" title="Move up"><ArrowUp className="h-3 w-3 text-white" /></button>
                                <button type="button" onClick={() => move(i, 1)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15" title="Move down"><ArrowDown className="h-3 w-3 text-white" /></button>
                                <button type="button" onClick={() => setRows(prev => prev.filter((_, k) => k !== i))} className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30" title="Delete this question"><Trash2 className="h-3 w-3 text-rose-300" /></button>
                            </div>
                            <textarea value={r.answer} onChange={e => set(i, { answer: e.target.value })} rows={2} placeholder="Expected answer (LaTeX between single $ signs is fine)"
                                className="col-span-3 sm:col-span-4 bg-[#0b0718] border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400/50" />
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addRow} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" /> Add question</button>
                <button type="button" onClick={() => onSave(rows.filter(r => r.question.trim()))} disabled={!valid || saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 text-white text-xs font-black disabled:opacity-50 active:scale-95 transition-transform">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save this key
                </button>
                <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white">Cancel</button>
            </div>
        </div>
    );
}
