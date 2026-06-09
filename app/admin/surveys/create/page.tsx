'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Plus, Trash2, GripVertical, CheckSquare, AlignLeft, Star, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Question {
    id: string;
    text: string;
    type: 'mcq' | 'checkbox' | 'text' | 'rating';
    options?: string[];
    ratingMax?: number;
    ratingLabels?: { low: string; high: string };
    required: boolean;
}

function CreateSurveyInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams?.get('id');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [endDate, setEndDate] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editId) {
            setLoading(true);
            fetch(`/api/admin/surveys?status=draft`, {
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            })
            .then(res => res.json())
            .then(data => {
                const survey = data.surveys?.find((s: any) => s._id === editId);
                if (survey) {
                    setTitle(survey.title);
                    setDescription(survey.description || '');
                    if (survey.endDate) setEndDate(new Date(survey.endDate).toISOString().slice(0, 16));
                    setQuestions(survey.questions || []);
                } else {
                    toast.error('Survey not found or not a draft');
                    router.push('/admin/surveys');
                }
            })
            .catch(() => toast.error('Failed to load survey'))
            .finally(() => setLoading(false));
        }
    }, [editId, router]);

    const addQuestion = (type: Question['type']) => {
        const newQ: Question = {
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            text: '',
            type,
            required: true
        };
        if (type === 'mcq' || type === 'checkbox') newQ.options = ['Option 1', 'Option 2'];
        if (type === 'rating') {
            newQ.ratingMax = 5;
            newQ.ratingLabels = { low: 'Poor', high: 'Excellent' };
        }
        setQuestions([...questions, newQ]);
    };

    const updateQuestion = (id: string, updates: Partial<Question>) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const removeQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const moveQuestion = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === questions.length - 1) return;
        const newQuestions = [...questions];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newQuestions[index], newQuestions[swapIndex]] = [newQuestions[swapIndex], newQuestions[index]];
        setQuestions(newQuestions);
    };

    const handleSave = async () => {
        if (!title.trim()) return toast.error('Title is required');
        if (questions.length === 0) return toast.error('At least one question is required');
        
        for (let i=0; i<questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) return toast.error(`Question ${i+1} text is empty`);
            if ((q.type === 'mcq' || q.type === 'checkbox') && (!q.options || q.options.length < 2)) {
                return toast.error(`Question ${i+1} must have at least 2 options`);
            }
        }

        setSaving(true);
        const toastId = toast.loading('Saving draft...');
        try {
            const url = '/api/admin/surveys';
            const method = editId ? 'PUT' : 'POST';
            const body = {
                id: editId || undefined,
                title, description, questions,
                endDate: endDate ? new Date(endDate).toISOString() : undefined
            };

            const res = await fetch(url, {
                method,
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' 
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error((await res.json()).error);
            toast.success('Survey saved successfully', { id: toastId });
            router.push('/admin/surveys');
        } catch (error: any) {
            toast.error(error.message || 'Failed to save', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-500">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <Toaster position="top-center" />

            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <ChevronLeft className="h-6 w-6 text-slate-400" />
                </button>
                <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400">
                    {editId ? 'Edit Survey' : 'Create New Survey'}
                </h1>
            </div>

            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Survey Title *</label>
                    <input
                        type="text" value={title} onChange={e => setTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-lg font-bold"
                        placeholder="e.g., Mid-Term Feedback Form"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                    <textarea
                        value={description} onChange={e => setDescription(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none h-24"
                        placeholder="Optional instructions for students..."
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Auto-Close Date (Optional)</label>
                    <input
                        type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="w-full md:w-1/2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                    <p className="text-xs text-slate-500 mt-1">Survey will automatically close and disappear from popups after this date.</p>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-400" /> Questions
                </h2>

                {questions.map((q, index) => (
                    <div key={q.id} className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 relative group">
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button disabled={index === 0} onClick={() => moveQuestion(index, 'up')} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                            <button disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 'down')} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                        </div>

                        <div className="pl-6 space-y-4">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs font-black text-slate-500 uppercase">Q{index + 1}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border
                                            ${q.type === 'mcq' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            q.type === 'checkbox' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                            q.type === 'rating' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                            {q.type === 'text' ? 'Free Text' : q.type}
                                        </span>
                                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer ml-auto">
                                            <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} className="rounded bg-white/5 border-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900" />
                                            Required
                                        </label>
                                    </div>
                                    <textarea
                                        value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none h-14"
                                        placeholder="Type your question here..."
                                    />
                                </div>
                                <button onClick={() => removeQuestion(q.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mt-6">
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>

                            {(q.type === 'mcq' || q.type === 'checkbox') && (
                                <div className="space-y-2 ml-4 border-l-2 border-white/5 pl-4">
                                    {q.options?.map((opt, oIndex) => (
                                        <div key={oIndex} className="flex items-center gap-2">
                                            {q.type === 'mcq' ? <div className="w-3 h-3 rounded-full border border-slate-500 shrink-0"/> : <div className="w-3 h-3 rounded-[2px] border border-slate-500 shrink-0"/>}
                                            <input
                                                type="text" value={opt}
                                                onChange={e => {
                                                    const newOpts = [...(q.options || [])];
                                                    newOpts[oIndex] = e.target.value;
                                                    updateQuestion(q.id, { options: newOpts });
                                                }}
                                                className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-transparent text-sm text-white focus:outline-none focus:border-blue-500/50"
                                                placeholder={`Option ${oIndex + 1}`}
                                            />
                                            <button onClick={() => {
                                                const newOpts = [...(q.options || [])];
                                                newOpts.splice(oIndex, 1);
                                                updateQuestion(q.id, { options: newOpts });
                                            }} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="h-3 w-3"/></button>
                                        </div>
                                    ))}
                                    <button onClick={() => updateQuestion(q.id, { options: [...(q.options || []), `Option ${(q.options?.length||0)+1}`] })}
                                        className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 mt-2">
                                        <Plus className="h-3 w-3" /> Add Option
                                    </button>
                                </div>
                            )}

                            {q.type === 'rating' && (
                                <div className="flex flex-wrap items-end gap-4 ml-4 border-l-2 border-white/5 pl-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Scale</label>
                                        <input type="number" min="2" max="10" value={q.ratingMax} onChange={e => updateQuestion(q.id, { ratingMax: parseInt(e.target.value) || 5 })}
                                            className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Low Label</label>
                                        <input type="text" value={q.ratingLabels?.low} onChange={e => updateQuestion(q.id, { ratingLabels: { ...q.ratingLabels!, low: e.target.value } })}
                                            className="w-32 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Poor" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">High Label</label>
                                        <input type="text" value={q.ratingLabels?.high} onChange={e => updateQuestion(q.id, { ratingLabels: { ...q.ratingLabels!, high: e.target.value } })}
                                            className="w-32 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Excellent" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                <div className="bg-slate-900/40 border border-white/5 border-dashed rounded-2xl p-6 flex flex-wrap gap-3 justify-center">
                    <button onClick={() => addQuestion('mcq')} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-300 transition-colors flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-blue-400 rounded-full" /> Add Single Choice
                    </button>
                    <button onClick={() => addQuestion('checkbox')} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-300 transition-colors flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-purple-400" /> Add Multiple Choice
                    </button>
                    <button onClick={() => addQuestion('rating')} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-300 transition-colors flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-400" /> Add Rating Scale
                    </button>
                    <button onClick={() => addQuestion('text')} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-300 transition-colors flex items-center gap-2">
                        <AlignLeft className="h-4 w-4 text-emerald-400" /> Add Free Text
                    </button>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f172a]/90 backdrop-blur-md border-t border-white/10 flex justify-end md:pl-64 z-50">
                <div className="max-w-4xl w-full mx-auto flex justify-end gap-3 px-4 md:px-0">
                    <button onClick={() => router.back()} className="px-6 py-2.5 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                    <button disabled={saving} onClick={handleSave} className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2">
                        {saving ? 'Saving...' : editId ? 'Update Draft' : 'Save as Draft'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CreateSurveyPage() {
    return (
        <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading...</div>}>
            <CreateSurveyInner />
        </Suspense>
    );
}
