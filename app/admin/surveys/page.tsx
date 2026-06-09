'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, Search, Edit3, Trash2, Copy, Eye, Send, XCircle, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Survey {
    _id: string;
    title: string;
    description?: string;
    questions: any[];
    deployment?: { batches: string[]; deployedAt: string };
    endDate?: string;
    status: 'draft' | 'deployed' | 'closed';
    createdAt: string;
    responseCount: number;
}

export default function SurveysList() {
    const router = useRouter();
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'draft' | 'deployed' | 'closed'>('all');

    const fetchSurveys = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/surveys${filter !== 'all' ? `?status=${filter}` : ''}`, {
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            if (!res.ok) throw new Error('Failed to fetch surveys');
            const data = await res.json();
            setSurveys(data.surveys);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load surveys');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSurveys(); }, [filter]);

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"? This will also delete ALL responses. This cannot be undone.`)) return;
        const toastId = toast.loading('Deleting survey...');
        try {
            const res = await fetch(`/api/admin/surveys?id=${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            if (!res.ok) throw new Error('Failed to delete');
            toast.success('Survey deleted successfully', { id: toastId });
            fetchSurveys();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete survey', { id: toastId });
        }
    };

    const handleClose = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to close "${title}"? Students will no longer see this survey.`)) return;
        const toastId = toast.loading('Closing survey...');
        try {
            const res = await fetch(`/api/admin/surveys/${id}/close`, {
                method: 'POST',
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            if (!res.ok) throw new Error('Failed to close');
            toast.success('Survey closed successfully', { id: toastId });
            fetchSurveys();
        } catch (error: any) {
            toast.error(error.message || 'Failed to close survey', { id: toastId });
        }
    };

    const filteredSurveys = surveys.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6">
            <Toaster position="top-center" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400">
                        Surveys & Polls
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Create and manage mandatory student questionnaires</p>
                </div>
                <Link href="/admin/surveys/create" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/20">
                    <Plus className="h-5 w-5" /> Create New Survey
                </Link>
            </div>

            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search surveys by title..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto">
                    {['all', 'draft', 'deployed', 'closed'].map(t => (
                        <button key={t} onClick={() => setFilter(t as any)} className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-colors whitespace-nowrap ${filter === t ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p>Loading surveys...</p>
                </div>
            ) : filteredSurveys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-white/5 rounded-3xl border border-white/10 border-dashed">
                    <ClipboardList className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-bold text-white mb-1">No surveys found</p>
                    <p className="text-sm">Create a new survey to gather student feedback</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredSurveys.map(survey => (
                        <div key={survey._id} className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all flex flex-col">
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                        survey.status === 'deployed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                        survey.status === 'closed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                    }`}>
                                        {survey.status}
                                    </span>
                                    <div className="text-[10px] text-slate-500 font-medium">
                                        {new Date(survey.createdAt).toLocaleDateString('en-GB')}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{survey.title}</h3>
                                {survey.description && (
                                    <p className="text-xs text-slate-400 mb-4 line-clamp-2">{survey.description}</p>
                                )}
                                
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                                        <div className="text-xl font-black text-white">{survey.questions.length}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Questions</div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                                        <div className="text-xl font-black text-blue-400">{survey.responseCount}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Responses</div>
                                    </div>
                                </div>

                                {survey.deployment?.batches && survey.deployment.batches.length > 0 && (
                                    <div className="mt-4">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1.5 tracking-wider">Deployed To:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {survey.deployment.batches.slice(0, 3).map(b => (
                                                <span key={b} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px] border border-blue-500/20 truncate max-w-[120px]">{b}</span>
                                            ))}
                                            {survey.deployment.batches.length > 3 && (
                                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400 text-[10px] border border-white/10">+{survey.deployment.batches.length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                    {survey.status === 'draft' && (
                                        <Link href={`/admin/surveys/create?id=${survey._id}`} className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Edit">
                                            <Edit3 className="h-4 w-4" />
                                        </Link>
                                    )}
                                    {survey.status === 'draft' && (
                                        <Link href={`/admin/surveys/deploy/${survey._id}`} className="p-2 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors" title="Deploy">
                                            <Send className="h-4 w-4" />
                                        </Link>
                                    )}
                                    {survey.status !== 'draft' && (
                                        <Link href={`/admin/surveys/monitor/${survey._id}`} className="p-2 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors flex items-center gap-2 px-3">
                                            <Eye className="h-4 w-4" /> <span className="text-xs font-bold">Monitor</span>
                                        </Link>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {survey.status === 'deployed' && (
                                        <button onClick={() => handleClose(survey._id, survey.title)} className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors" title="Close Survey">
                                            <XCircle className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(survey._id, survey.title)} className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
