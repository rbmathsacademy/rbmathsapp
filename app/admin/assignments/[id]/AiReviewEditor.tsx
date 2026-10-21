'use client';

import { useState } from 'react';
import Latex from 'react-latex-next';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import { computeGrade, ERROR_TYPES, ERROR_TYPE_LABEL, type AiReview, type AiFeedbackItem, type ErrorType, type FeedbackStatus } from '@/lib/aiGrading';

const STATUSES: { value: FeedbackStatus; label: string }[] = [
    { value: 'INCORRECT', label: 'Incorrect' },
    { value: 'PARTIAL', label: 'Partly correct' },
    { value: 'INCOMPLETE', label: 'Incomplete' },
    { value: 'SKIPPED', label: 'Skipped' },
];

const EMPTY: AiReview = {
    totalQuestions: 0, correct: 0, incorrect: 0, skippedOrIncomplete: 0,
    unreadable: false, unreadableNote: '', summary: '', feedback: [], aiGrade: null,
};

const input = 'w-full bg-[#0b0718] border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500/60';

/**
 * Manual editor for one student's review: counts, grade, summary and question-wise feedback.
 * Comments accept inline LaTeX ($...$) and show a live preview.
 */
export default function AiReviewEditor({ assignmentId, submissionId, review, currentQuality, onSaved, onCancel }: {
    assignmentId: string;
    submissionId: string;
    review: AiReview | null | undefined;
    currentQuality?: string | null;
    onSaved: (r: { status: 'PENDING' | 'CORRECTED'; quality: any; aiReview: AiReview }) => void;
    onCancel: () => void;
}) {
    const [r, setR] = useState<AiReview>(() => JSON.parse(JSON.stringify(review || EMPTY)));
    const autoGrade = computeGrade(r);
    // Keep a grade the admin had chosen by hand (if it differs from the rule); otherwise follow the rule
    const [grade, setGrade] = useState<string>(() => (currentQuality && review && currentQuality !== computeGrade(review)) ? currentQuality : 'AUTO');
    const [saving, setSaving] = useState(false);

    const set = <K extends keyof AiReview>(k: K, v: AiReview[K]) => setR(prev => ({ ...prev, [k]: v }));
    const num = (k: 'totalQuestions' | 'correct' | 'incorrect' | 'skippedOrIncomplete') => (e: React.ChangeEvent<HTMLInputElement>) =>
        set(k, Math.max(0, Math.round(Number(e.target.value) || 0)));
    const setItem = (i: number, patch: Partial<AiFeedbackItem>) =>
        setR(prev => ({ ...prev, feedback: prev.feedback.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));

    const sum = r.correct + r.incorrect + r.skippedOrIncomplete;
    const mismatch = r.totalQuestions > 0 && sum !== r.totalQuestions;

    const save = async () => {
        setSaving(true);
        try {
            const token = (() => { try { return localStorage.getItem('adminToken'); } catch { return null; } })();
            const res = await fetch(`/api/admin/assignments/${assignmentId}/ai-grades`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    submissionId,
                    grade,
                    review: { ...r, totalQuestions: r.totalQuestions || sum, feedback: r.feedback.filter(f => f.question.trim() || f.comment.trim()) },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            toast.success('Feedback saved');
            onSaved({ status: data.status, quality: data.quality, aiReview: data.aiReview });
        } catch (e: any) {
            toast.error(e.message || 'Could not save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Counts */}
            <section className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-violet-200/70">Question counts</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="space-y-1"><span className="text-[11px] text-lime-300 font-bold">Correct</span><input type="number" min={0} value={r.correct} onChange={num('correct')} className={input} /></label>
                    <label className="space-y-1"><span className="text-[11px] text-rose-300 font-bold">Incorrect</span><input type="number" min={0} value={r.incorrect} onChange={num('incorrect')} className={input} /></label>
                    <label className="space-y-1"><span className="text-[11px] text-slate-300 font-bold">Skipped / incomplete</span><input type="number" min={0} value={r.skippedOrIncomplete} onChange={num('skippedOrIncomplete')} className={input} /></label>
                    <label className="space-y-1"><span className="text-[11px] text-violet-200/70 font-bold">Total questions</span><input type="number" min={0} value={r.totalQuestions} onChange={num('totalQuestions')} className={input} /></label>
                </div>
                {mismatch && <p className="text-[11px] text-amber-200">The three counts add up to {sum}, but the total is {r.totalQuestions}.</p>}
            </section>

            {/* Grade + flag */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                    <span className="text-[11px] text-violet-200/70 font-bold">Grade</span>
                    <select value={grade} onChange={e => setGrade(e.target.value)} className={input}>
                        <option value="AUTO">Automatic by rule ({autoGrade})</option>
                        <option value="GOOD">Good</option>
                        <option value="SATISFACTORY">Satisfactory</option>
                        <option value="POOR">Poor</option>
                    </select>
                </label>
                <div className="space-y-1">
                    <label className="flex items-center gap-2 text-sm text-white mt-5 cursor-pointer">
                        <input type="checkbox" checked={r.unreadable} onChange={e => set('unreadable', e.target.checked)} className="rounded border-white/20 bg-[#1d1535] text-amber-500" />
                        Handwriting unreadable (keeps the copy unchecked)
                    </label>
                    {r.unreadable && <input value={r.unreadableNote} onChange={e => set('unreadableNote', e.target.value)} placeholder="Note (e.g. pages 3-4 blurred)" className={input} />}
                </div>
            </section>

            {/* Summary */}
            <section className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-violet-200/70">Summary for the student</h4>
                <textarea value={r.summary} onChange={e => set('summary', e.target.value)} rows={2} className={input} />
            </section>

            {/* Question-wise feedback */}
            <section className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-violet-200/70">Question feedback</h4>
                    <button onClick={() => set('feedback', [...r.feedback, { question: '', status: 'INCORRECT', comment: '' }])}
                        className="flex items-center gap-1 text-xs font-bold text-fuchsia-300 hover:text-fuchsia-200">
                        <Plus className="h-3.5 w-3.5" /> Add question
                    </button>
                </div>
                {r.feedback.length === 0 && <p className="text-xs text-violet-200/50">No question feedback.</p>}
                {r.feedback.map((f, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <input value={f.question} onChange={e => setItem(i, { question: e.target.value })} placeholder="Q no." className={`${input} w-20 shrink-0`} />
                            <select value={f.status} onChange={e => setItem(i, { status: e.target.value as FeedbackStatus })} className={`${input} flex-1 min-w-0`}>
                                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <select value={f.errorType || ''} onChange={e => setItem(i, { errorType: (e.target.value || undefined) as ErrorType | undefined })} className={`${input} flex-1 min-w-0`} title="Kind of mistake">
                                <option value="">Kind of mistake...</option>
                                {ERROR_TYPES.map(t => <option key={t} value={t}>{ERROR_TYPE_LABEL[t]}</option>)}
                            </select>
                            <button onClick={() => set('feedback', r.feedback.filter((_, j) => j !== i))} title="Remove"
                                className="p-2 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 shrink-0"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <textarea value={f.comment} onChange={e => setItem(i, { comment: e.target.value })} rows={2}
                            placeholder="Feedback - write maths in LaTeX between $ signs, e.g. $\frac{dy}{dx}$" className={`${input} font-mono text-xs`} />
                        {f.comment.includes('$') && (
                            <div className="text-[13px] text-slate-200 px-1"><span className="text-[10px] text-violet-200/50 mr-1">Preview:</span><Latex>{f.comment}</Latex></div>
                        )}
                    </div>
                ))}
            </section>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold">Cancel</button>
                <button onClick={save} disabled={saving}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white text-sm font-black shadow-lg shadow-fuchsia-500/25 disabled:opacity-60">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
                </button>
            </div>
        </div>
    );
}
