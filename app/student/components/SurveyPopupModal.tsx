'use client';

import { useState } from 'react';
import { Star, CheckCircle2, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface SurveyPopupModalProps {
    survey: any;
    onComplete: () => void;
}

export default function SurveyPopupModal({ survey, onComplete }: SurveyPopupModalProps) {
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleOptionSelect = (questionId: string, optionIndex: number, type: 'mcq' | 'checkbox') => {
        setAnswers(prev => {
            if (type === 'mcq') {
                return { ...prev, [questionId]: optionIndex };
            } else {
                const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
                if (current.includes(optionIndex)) {
                    return { ...prev, [questionId]: current.filter((i: number) => i !== optionIndex) };
                } else {
                    return { ...prev, [questionId]: [...current, optionIndex] };
                }
            }
        });
    };

    const handleTextChange = (questionId: string, text: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: text }));
    };

    const handleRatingSelect = (questionId: string, rating: number) => {
        setAnswers(prev => ({ ...prev, [questionId]: rating }));
    };

    const isQuestionAnswered = (q: any) => {
        const ans = answers[q.id];
        if (ans === undefined || ans === null) return false;
        if (q.type === 'text' && String(ans).trim() === '') return false;
        if (q.type === 'checkbox' && (!Array.isArray(ans) || ans.length === 0)) return false;
        return true;
    };

    const allRequiredAnswered = survey.questions.every((q: any) => !q.required || isQuestionAnswered(q));

    const handleSubmit = async () => {
        if (!allRequiredAnswered) {
            return toast.error('Please answer all required questions.');
        }

        const formattedAnswers = Object.keys(answers).map(qId => ({
            questionId: qId,
            answer: answers[qId]
        }));

        setSubmitting(true);
        try {
            const res = await fetch(`/api/student/surveys/${survey._id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: formattedAnswers })
            });

            if (!res.ok) throw new Error((await res.json()).error);
            
            setSuccess(true);
            setTimeout(() => {
                onComplete();
            }, 1500);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit survey');
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
                <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 animate-[pulse_2s_infinite]">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 mb-2 text-center animate-in slide-in-from-bottom-4">
                    Thank you!
                </h2>
                <p className="text-slate-400 text-center max-w-md animate-in slide-in-from-bottom-4 delay-100">
                    Your response has been recorded successfully.
                </p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-lg flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
            <div className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl bg-[#0f172a] md:rounded-3xl border-0 md:border border-white/10 flex flex-col overflow-hidden shadow-2xl">
                
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-white/10 bg-gradient-to-b from-blue-500/10 to-transparent shrink-0">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="w-5 h-5 text-blue-400" />
                        <span className="text-xs font-black text-blue-400 uppercase tracking-wider">Required Feedback</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white mb-2">{survey.title}</h2>
                    {survey.description && (
                        <p className="text-sm text-slate-400">{survey.description}</p>
                    )}
                </div>

                {/* Questions Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                    {survey.questions.map((q: any, index: number) => {
                        const isAnswered = isQuestionAnswered(q);
                        const hasError = q.required && !isAnswered && submitting;

                        return (
                            <div key={q.id} className={`p-5 rounded-2xl border transition-colors ${hasError ? 'bg-red-500/5 border-red-500/30' : 'bg-white/5 border-white/5'}`}>
                                <div className="flex gap-3 mb-4">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isAnswered ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white flex items-start gap-1">
                                            {q.text}
                                            {q.required && <span className="text-red-500 text-lg leading-none">*</span>}
                                        </h3>
                                    </div>
                                </div>

                                <div className="pl-9">
                                    {q.type === 'mcq' && (
                                        <div className="space-y-2">
                                            {q.options?.map((opt: string, oIdx: number) => {
                                                const selected = answers[q.id] === oIdx;
                                                return (
                                                    <label key={oIdx} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selected ? 'bg-blue-500/10 border-blue-500/50' : 'bg-slate-900 border-white/5 hover:bg-white/5'}`}>
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-blue-500' : 'border-slate-500'}`}>
                                                            {selected && <div className="w-2 h-2 rounded-full bg-blue-500"/>}
                                                        </div>
                                                        <span className={`text-sm ${selected ? 'text-white font-bold' : 'text-slate-300'}`}>{opt}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {q.type === 'checkbox' && (
                                        <div className="space-y-2">
                                            {q.options?.map((opt: string, oIdx: number) => {
                                                const selected = Array.isArray(answers[q.id]) && answers[q.id].includes(oIdx);
                                                return (
                                                    <label key={oIdx} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selected ? 'bg-purple-500/10 border-purple-500/50' : 'bg-slate-900 border-white/5 hover:bg-white/5'}`}>
                                                        <div className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${selected ? 'border-purple-500 bg-purple-500' : 'border-slate-500'}`}>
                                                            {selected && <CheckCircle2 className="w-3 h-3 text-white"/>}
                                                        </div>
                                                        <span className={`text-sm ${selected ? 'text-white font-bold' : 'text-slate-300'}`}>{opt}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {q.type === 'rating' && (
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap gap-2">
                                                {Array.from({ length: q.ratingMax || 5 }).map((_, i) => {
                                                    const val = i + 1;
                                                    const selected = answers[q.id] === val;
                                                    return (
                                                        <button key={val} onClick={() => handleRatingSelect(q.id, val)}
                                                            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-sm font-bold border transition-all ${selected ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/20' : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                                                            {val}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-500 px-1 font-medium">
                                                <span>{q.ratingLabels?.low || '1'}</span>
                                                <span>{q.ratingLabels?.high || String(q.ratingMax)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {q.type === 'text' && (
                                        <textarea
                                            value={answers[q.id] || ''}
                                            onChange={e => handleTextChange(q.id, e.target.value)}
                                            placeholder="Type your answer here..."
                                            className="w-full p-4 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-[100px] resize-y"
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer with Submit Button */}
                <div className="p-4 md:p-6 border-t border-white/10 bg-[#0f172a] shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={!allRequiredAnswered || submitting}
                        className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all ${
                            allRequiredAnswered && !submitting
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/20'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        {submitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                        ) : (
                            <>Submit Response <ChevronRight className="w-5 h-5" /></>
                        )}
                    </button>
                    {!allRequiredAnswered && (
                        <p className="text-center text-xs text-red-400 mt-3 font-medium">
                            Please answer all required questions (*) to continue.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
