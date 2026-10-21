'use client';

import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import { ERROR_TYPE_LABEL, type AiReview } from '@/lib/aiGrading';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
    INCORRECT: { label: 'Incorrect', cls: 'bg-rose-500/15 text-rose-300 border-rose-400/40' },
    PARTIAL: { label: 'Partly correct', cls: 'bg-amber-400/15 text-amber-200 border-amber-300/40' },
    INCOMPLETE: { label: 'Incomplete', cls: 'bg-sky-400/15 text-sky-200 border-sky-300/40' },
    SKIPPED: { label: 'Skipped', cls: 'bg-white/10 text-slate-300 border-white/15' },
};

/** Correct / incorrect / skipped counts as three compact chips. */
export function AiScoreChips({ review, compact = false }: { review: AiReview; compact?: boolean }) {
    const chip = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${chip} rounded-lg font-bold bg-lime-400/15 text-lime-300 border border-lime-300/30`} title="Correct">✓ {review.correct}</span>
            <span className={`${chip} rounded-lg font-bold bg-rose-500/15 text-rose-300 border border-rose-400/30`} title="Incorrect">✗ {review.incorrect}</span>
            <span className={`${chip} rounded-lg font-bold bg-white/10 text-slate-300 border border-white/15`} title="Skipped or incomplete">⊘ {review.skippedOrIncomplete}</span>
            {!compact && <span className="text-[11px] text-violet-200/50 ml-1">of {review.totalQuestions} questions</span>}
        </div>
    );
}

/** Full question-wise feedback (comments may contain inline LaTeX in $...$). */
export default function AiFeedbackView({ review }: { review: AiReview }) {
    return (
        <div className="space-y-3">
            <AiScoreChips review={review} />
            {review.unreadable && (
                <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
                    ⚠ Handwriting / pages could not be read clearly{review.unreadableNote ? `: ${review.unreadableNote}` : ''}
                </div>
            )}
            {review.summary && (
                <div className="text-sm text-violet-100/80 leading-relaxed">
                    <Latex>{review.summary}</Latex>
                </div>
            )}
            {review.feedback.length > 0 ? (
                <div className="space-y-2">
                    {review.feedback.map((f, i) => {
                        const st = STATUS_STYLE[f.status] || STATUS_STYLE.INCORRECT;
                        return (
                            <div key={i} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-xs font-black text-white">Q{f.question.replace(/^Q\s*/i, '')}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                                    {f.errorType && f.errorType !== 'NOT_ATTEMPTED' && f.errorType !== 'OTHER' && (
                                        <span className="text-[10px] text-violet-200/60">{ERROR_TYPE_LABEL[f.errorType]}</span>
                                    )}
                                </div>
                                {f.comment && (
                                    <div className="text-[13px] text-slate-200 leading-relaxed break-words">
                                        <Latex>{f.comment}</Latex>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                !review.unreadable && <p className="text-xs text-lime-300">Every question is correct. Great work! 🌟</p>
            )}
        </div>
    );
}
