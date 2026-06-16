'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, BarChart3, Users, Clock, Search, Trash2, Copy, Download, UserX, XCircle, FileJson, Send, Plus, X, Bell } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function SurveyMonitorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [batchFilter, setBatchFilter] = useState('');
    const [excludePhones, setExcludePhones] = useState<string[]>([]);
    const [searchStudent, setSearchStudent] = useState('');
    const [filterQuestionId, setFilterQuestionId] = useState('');
    const [filterAnswer, setFilterAnswer] = useState('');
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [availableTests, setAvailableTests] = useState<any[]>([]);

    const [notifHeader, setNotifHeader] = useState('');
    const [notifBody, setNotifBody] = useState('');
    const [notifStartDate, setNotifStartDate] = useState('');
    const [notifEndDate, setNotifEndDate] = useState('');
    const [notifSending, setNotifSending] = useState(false);

    const handleSendNotification = async () => {
        if (!notifHeader || !notifBody || !notifEndDate) return toast.error('Header, body, and End Date are required');
        setNotifSending(true);
        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : ''
                },
                body: JSON.stringify({
                    title: notifHeader,
                    message: notifBody,
                    startDate: notifStartDate ? new Date(notifStartDate) : new Date(),
                    endDate: new Date(notifEndDate),
                    targetStudents: filteredResponses.map((r: any) => ({
                        phoneNumber: r.studentPhone,
                        studentName: r.studentName,
                        batchName: r.batchName
                    }))
                })
            });
            if (!res.ok) throw new Error('Failed to send notification');
            toast.success('Notification pushed successfully!');
            setShowNotificationModal(false);
            setNotifHeader('');
            setNotifBody('');
            setNotifStartDate('');
            setNotifEndDate('');
        } catch (e) {
            toast.error('Failed to send notification');
        } finally {
            setNotifSending(false);
        }
    };

    const fetchData = async () => {
        try {
            const url = new URL(`/api/admin/surveys/${id}/responses`, window.location.origin);
            if (search) url.searchParams.set('search', search);
            if (batchFilter) url.searchParams.set('batch', batchFilter);

            const res = await fetch(url.toString(), {
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            if (!res.ok) throw new Error('Failed to fetch data');
            const json = await res.json();
            setData(json);
        } catch (error) {
            toast.error('Failed to load monitor data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(() => { fetchData(); }, search ? 300 : 0);
        return () => clearTimeout(t);
    }, [id, search, batchFilter]);

    const handleDeleteResponse = async (phone: string, name: string) => {
        if (!confirm(`Delete response from ${name}? The survey popup will reappear for them.`)) return;
        const toastId = toast.loading('Deleting response...');
        try {
            const res = await fetch(`/api/admin/surveys/${id}/responses/${phone}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success('Response deleted', { id: toastId });
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete', { id: toastId });
        }
    };

    const handleExclude = async () => {
        if (excludePhones.length === 0) return;
        const toastId = toast.loading('Excluding students...');
        try {
            const res = await fetch(`/api/admin/surveys/${id}/exclude`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' 
                },
                body: JSON.stringify({ phones: excludePhones })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success('Students excluded', { id: toastId });
            setExcludePhones([]);
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to exclude', { id: toastId });
        }
    };

    const handleInclude = async (phone: string) => {
        const toastId = toast.loading('Re-including student...');
        try {
            const res = await fetch(`/api/admin/surveys/${id}/exclude`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' 
                },
                body: JSON.stringify({ phone })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success('Student re-included', { id: toastId });
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to re-include', { id: toastId });
        }
    };

    const handleClose = async () => {
        if (!confirm(`Close "${data.survey.title}"? Students will no longer see this survey.`)) return;
        const toastId = toast.loading('Closing survey...');
        try {
            const res = await fetch(`/api/admin/surveys/${id}/close`, {
                method: 'POST',
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            if (!res.ok) throw new Error('Failed to close');
            toast.success('Survey closed successfully', { id: toastId });
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to close survey', { id: toastId });
        }
    };

    const copyTSV = () => {
        if (!data || !data.responses || data.responses.length === 0) return toast.error('No data to copy');
        
        const qHeaders = data.survey.questions.map((q: any) => q.text.replace(/\t/g, ' '));
        const header = ['Name', 'Phone', 'Batch', ...qHeaders, 'Submitted At'].join('\t');
        
        const rows = data.responses.map((r: any) => {
            const answers = data.survey.questions.map((q: any) => {
                const ansObj = r.answers.find((a: any) => a.questionId === q.id);
                if (!ansObj) return 'N/A';
                if (q.type === 'mcq') return q.options[ansObj.answer] || 'Unknown';
                if (q.type === 'checkbox') return Array.isArray(ansObj.answer) ? ansObj.answer.map((idx: number) => q.options[idx]).join(', ') : 'Unknown';
                return String(ansObj.answer).replace(/\t/g, ' ').replace(/\n/g, ' ');
            });
            return [r.studentName, r.studentPhone, r.batchName, ...answers, new Date(r.submittedAt).toLocaleString()].join('\t');
        });

        navigator.clipboard.writeText([header, ...rows].join('\n'));
        toast.success('Data copied to clipboard! You can paste this into Excel/Sheets or AI tools.');
    };

    const copyJSON = () => {
        if (!data || !data.responses) return;
        navigator.clipboard.writeText(JSON.stringify(data.responses, null, 2));
        toast.success('Raw JSON copied to clipboard');
    };

    const openDeployModal = async () => {
        if (!filteredResponses || filteredResponses.length === 0) return toast.error('No students to deploy to');
        
        try {
            const res = await fetch('/api/admin/online-tests', {
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            const tests = await res.json();
            setAvailableTests(tests.filter((t: any) => t.status === 'draft'));
            setShowDeployModal(true);
        } catch (e) {
            toast.error('Failed to fetch tests');
        }
    };

    const handleDeployExisting = (testId: string) => {
        const studentsToDeploy = filteredResponses.map((r: any) => ({
            phoneNumber: r.studentPhone,
            studentName: r.studentName,
            batchName: r.batchName
        }));
        sessionStorage.setItem('surveyDeployStudents', JSON.stringify(studentsToDeploy));
        router.push(`/admin/online-tests/deploy/${testId}`);
    };

    const handleCreateNewTest = () => {
        const studentsToDeploy = filteredResponses.map((r: any) => ({
            phoneNumber: r.studentPhone,
            studentName: r.studentName,
            batchName: r.batchName
        }));
        sessionStorage.setItem('surveyDeployStudents', JSON.stringify(studentsToDeploy));
        
        let optionText = filterAnswer;
        if (filterQuestionId && filterAnswer !== '') {
            const q = data.survey.questions.find((q: any) => q.id === filterQuestionId);
            if (q && (q.type === 'mcq' || q.type === 'checkbox')) {
                optionText = q.options[parseInt(filterAnswer)] || filterAnswer;
            }
        }
        const title = encodeURIComponent(`${optionText ? optionText + ' || ' : ''}Exam Practice Test`);
        router.push(`/admin/online-tests/create?title=${title}`);
    };

    if (loading && !data) return <div className="text-center py-20 text-slate-500">Loading monitor data...</div>;
    if (!data || !data.survey) return null;

    const { survey, analytics, responses, availableStudents = [] } = data;

    const filteredResponses = responses.filter((r: any) => {
        if (!filterQuestionId || filterAnswer === '') return true;
        const ansObj = r.answers.find((a: any) => a.questionId === filterQuestionId);
        if (!ansObj) return false;
        
        const q = survey.questions.find((q: any) => q.id === filterQuestionId);
        if (q.type === 'checkbox' && Array.isArray(ansObj.answer)) {
            return ansObj.answer.map(String).includes(String(filterAnswer));
        }
        return String(ansObj.answer) === String(filterAnswer);
    });

    const filteredStudents = availableStudents.filter((s: any) => 
        !survey.excludedStudents?.includes(s.phone) &&
        (s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.phone.includes(searchStudent))
    );

    return (
        <div className="space-y-6">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <ChevronLeft className="h-6 w-6 text-slate-400" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-black text-white">{survey.title}</h1>
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                survey.status === 'deployed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                survey.status === 'closed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            }`}>
                                {survey.status}
                            </span>
                        </div>
                        <p className="text-slate-400 text-sm mt-1">{analytics.totalResponses} responses out of {analytics.totalStudents} total students ({analytics.responseRate}%)</p>
                    </div>
                </div>
                {survey.status === 'deployed' && (
                    <button onClick={handleClose} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold text-sm border border-red-500/20 transition-colors">
                        Close Survey
                    </button>
                )}
            </div>

            {/* Batch Breakdown Stats */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Batch Completion Rates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(analytics.batchBreakdown).map(([batch, stats]: [string, any]) => {
                        const pct = stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0;
                        return (
                            <div key={batch} className="bg-white/5 border border-white/5 rounded-xl p-4">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-bold text-white truncate pr-2">{batch}</span>
                                    <span className="text-xs text-slate-400 shrink-0">{stats.responded} / {stats.total}</span>
                                </div>
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${pct}%` }}></div>
                                </div>
                                <div className="text-right mt-1 text-[10px] font-bold text-blue-400">{pct}%</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Per-Question Analytics */}
            <h2 className="text-xl font-black text-white mt-8 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-400" /> Analytics
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analytics.questionAnalytics.map((qa: any, idx: number) => (
                    <div key={qa.questionId} className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 flex flex-col h-full">
                        <div className="mb-6">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-2 block">Question {idx + 1}</span>
                            <h3 className="text-lg font-bold text-white">{qa.text}</h3>
                            <p className="text-xs text-slate-500 mt-1">{qa.totalResponses} responses</p>
                        </div>

                        {(qa.type === 'mcq' || qa.type === 'checkbox') && (
                            <div className="space-y-3 mt-auto">
                                {qa.options.map((opt: string, oIdx: number) => {
                                    const count = qa.optionCounts[oIdx];
                                    const pct = qa.totalResponses > 0 ? Math.round((count / qa.totalResponses) * 100) : 0;
                                    const isWinner = count > 0 && count === Math.max(...qa.optionCounts);
                                    
                                    return (
                                        <div key={oIdx} className="relative">
                                            <div className="flex justify-between text-xs mb-1 relative z-10 px-2">
                                                <span className={`font-bold ${isWinner ? 'text-white' : 'text-slate-300'}`}>{opt}</span>
                                                <span className="text-slate-400">{count} ({pct}%)</span>
                                            </div>
                                            <div className="h-8 w-full bg-slate-800/50 rounded-lg overflow-hidden relative">
                                                <div 
                                                    className={`absolute top-0 left-0 h-full transition-all duration-1000 ${isWinner ? 'bg-blue-500/40 border-r-2 border-blue-400' : 'bg-slate-700/50'}`}
                                                    style={{ width: `${pct}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {qa.type === 'rating' && (
                            <div className="mt-auto flex flex-col items-center">
                                <div className="text-5xl font-black text-amber-400 mb-2">{qa.averageRating}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">Average Rating (out of {qa.ratingMax})</div>
                                
                                <div className="w-full space-y-2">
                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                        <span>{qa.ratingLabels?.low || '1'}</span>
                                        <span>{qa.ratingLabels?.high || String(qa.ratingMax)}</span>
                                    </div>
                                    {[...qa.distribution].reverse().map((count: number, rIdx: number) => {
                                        const ratingVal = qa.ratingMax - rIdx;
                                        const pct = qa.totalResponses > 0 ? Math.round((count / qa.totalResponses) * 100) : 0;
                                        return (
                                            <div key={ratingVal} className="flex items-center gap-2 text-xs">
                                                <span className="w-4 text-right text-slate-400">{ratingVal}</span>
                                                <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }}></div>
                                                </div>
                                                <span className="w-8 text-right text-slate-500">{pct}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {qa.type === 'text' && (
                            <div className="mt-auto max-h-[250px] overflow-y-auto custom-scrollbar pr-2 space-y-2 border-t border-white/5 pt-4">
                                {qa.textAnswers?.length === 0 ? (
                                    <p className="text-center text-slate-500 py-4">No text responses yet.</p>
                                ) : qa.textAnswers?.map((ans: any, tIdx: number) => (
                                    <div key={tIdx} className="bg-white/5 rounded-xl p-3 flex justify-between items-start gap-4">
                                        <p className="text-sm text-slate-300 flex-1">{ans.text}</p>
                                        <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-slate-800 text-[10px] font-bold text-slate-400 min-w-[30px]">{ans.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Responses Table */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden mt-8">
                <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-400" /> Individual Responses
                    </h2>
                    
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setShowNotificationModal(true)} className="px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-xs font-bold border border-orange-500/20 transition-colors flex items-center gap-1.5">
                            <Bell className="h-3.5 w-3.5" /> Push Notification
                        </button>
                        <button onClick={openDeployModal} className="px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-bold border border-blue-500/20 transition-colors flex items-center gap-1.5">
                            <Send className="h-3.5 w-3.5" /> Deploy Test ({filteredResponses.length})
                        </button>
                        <button onClick={copyTSV} className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20 transition-colors flex items-center gap-1.5">
                            <Copy className="h-3.5 w-3.5" /> Copy Data (AI)
                        </button>
                        <button onClick={copyJSON} className="px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-xs font-bold border border-purple-500/20 transition-colors flex items-center gap-1.5">
                            <FileJson className="h-3.5 w-3.5" /> Raw JSON
                        </button>
                    </div>
                </div>

                <div className="p-4 border-b border-white/10 bg-black/20 flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text" placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <select
                        value={batchFilter} onChange={e => setBatchFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="">All Batches</option>
                        {Object.keys(analytics.batchBreakdown).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    
                    <select
                        value={filterQuestionId}
                        onChange={e => { setFilterQuestionId(e.target.value); setFilterAnswer(''); }}
                        className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500 max-w-xs truncate"
                    >
                        <option value="">All Questions</option>
                        {survey.questions.map((q: any) => <option key={q.id} value={q.id}>{q.text}</option>)}
                    </select>

                    {filterQuestionId && (
                        <select
                            value={filterAnswer}
                            onChange={e => setFilterAnswer(e.target.value)}
                            className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500 max-w-xs truncate"
                        >
                            <option value="">Any Answer</option>
                            {(() => {
                                const q = survey.questions.find((q: any) => q.id === filterQuestionId);
                                if (!q) return null;
                                if (q.type === 'mcq' || q.type === 'checkbox') {
                                    return q.options.map((opt: string, idx: number) => <option key={idx} value={idx}>{opt}</option>);
                                } else {
                                    const uniqueAns = Array.from(new Set<string>(responses.map((r: any) => {
                                        const a = r.answers.find((ans: any) => ans.questionId === filterQuestionId);
                                        return a ? String(a.answer) : null;
                                    }).filter(Boolean) as string[]));
                                    return uniqueAns.map(ans => <option key={ans} value={ans}>{ans}</option>);
                                }
                            })()}
                        </select>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                                <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-xs">Student</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-xs">Batch</th>
                                {survey.questions.slice(0, 3).map((q: any) => (
                                    <th key={q.id} className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-xs max-w-[200px] truncate" title={q.text}>{q.text}</th>
                                ))}
                                {survey.questions.length > 3 && <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-xs">...</th>}
                                <th className="px-4 py-3 text-right font-bold text-slate-400 uppercase tracking-wider text-xs">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResponses.length === 0 ? (
                                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No responses match your filters.</td></tr>
                            ) : filteredResponses.map((r: any) => (
                                <tr key={r._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-white">{r.studentName}</div>
                                        <div className="text-[10px] text-slate-500">{r.studentPhone}</div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-300"><span className="px-2 py-0.5 rounded bg-white/5 text-[10px]">{r.batchName}</span></td>
                                    
                                    {survey.questions.slice(0, 3).map((q: any) => {
                                        const ansObj = r.answers.find((a: any) => a.questionId === q.id);
                                        let display = 'N/A';
                                        if (ansObj) {
                                            if (q.type === 'mcq') display = q.options[ansObj.answer] || 'Unknown';
                                            else if (q.type === 'checkbox') display = Array.isArray(ansObj.answer) ? ansObj.answer.map((idx: number) => q.options[idx]).join(', ') : 'Unknown';
                                            else display = String(ansObj.answer);
                                        }
                                        return <td key={q.id} className="px-4 py-3 text-slate-400 max-w-[200px] truncate" title={display}>{display}</td>;
                                    })}
                                    {survey.questions.length > 3 && <td className="px-4 py-3 text-slate-500">...</td>}
                                    
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-[10px] text-slate-500 mr-2" title={new Date(r.submittedAt).toLocaleString()}>
                                                {new Date(r.submittedAt).toLocaleDateString()}
                                            </span>
                                            <button onClick={() => handleDeleteResponse(r.studentPhone, r.studentName)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete Response (will reopen popup for student)">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Excluded Students */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 mt-8">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <UserX className="h-5 w-5 text-red-400" /> Excluded Students
                </h2>
                <p className="text-sm text-slate-400 mb-4">These students will not see the survey popup even if their batch is deployed.</p>
                
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                type="text" placeholder="Search student to exclude..." value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-red-500"
                            />
                        </div>
                        <div className="bg-black/20 border border-white/5 rounded-xl h-[200px] overflow-y-auto p-2 custom-scrollbar space-y-1">
                            {filteredStudents.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-4">No students found.</p>
                            ) : filteredStudents.map((s: any) => {
                                const isSelected = excludePhones.includes(s.phone);
                                return (
                                    <label key={s.phone} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-red-500/10 border border-red-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            onChange={(e) => {
                                                if (e.target.checked) setExcludePhones(prev => [...prev, s.phone]);
                                                else setExcludePhones(prev => prev.filter(p => p !== s.phone));
                                            }}
                                            className="rounded border-white/20 bg-slate-800 text-red-500 focus:ring-red-500/20"
                                        />
                                        <div>
                                            <div className="text-sm font-bold text-slate-300">{s.name}</div>
                                            <div className="text-[10px] text-slate-500">{s.phone} • {s.courses?.join(', ')}</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        <button onClick={handleExclude} disabled={excludePhones.length === 0} className="w-full mt-3 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                            Exclude Selected ({excludePhones.length})
                        </button>
                    </div>
                </div>

                {survey.excludedStudents && survey.excludedStudents.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {survey.excludedStudents.map((phone: string) => (
                            <div key={phone} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {phone}
                                <button onClick={() => handleInclude(phone)} className="hover:text-red-300 p-0.5 rounded-full hover:bg-red-500/20 transition-colors"><XCircle className="h-3.5 w-3.5" /></button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 italic">No students are excluded.</p>
                )}
            </div>

            {/* Deploy Modal */}
            {showDeployModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-xl shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Send className="h-5 w-5 text-blue-400" /> Deploy Test to {filteredResponses.length} Students
                            </h3>
                            <button onClick={() => setShowDeployModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar max-h-[60vh]">
                            <button
                                onClick={handleCreateNewTest}
                                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 transition-colors font-bold"
                            >
                                <Plus className="h-5 w-5" /> Create New Test
                            </button>
                            
                            {availableTests.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Or choose existing draft</h4>
                                    <div className="space-y-2">
                                        {availableTests.map(t => (
                                            <div key={t._id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/20 transition-colors">
                                                <div>
                                                    <div className="font-bold text-slate-200">{t.title}</div>
                                                    <div className="text-xs text-slate-500">{t.questions?.length || 0} questions • {t.totalMarks || 0} marks</div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeployExisting(t._id)}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors"
                                                >
                                                    Select
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Modal */}
            {showNotificationModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Bell className="h-5 w-5 text-orange-400" /> Push Notification to {filteredResponses.length} Students
                            </h3>
                            <button onClick={() => setShowNotificationModal(false)} className="text-gray-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-1">Header Title <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    value={notifHeader}
                                    onChange={(e) => setNotifHeader(e.target.value)}
                                    placeholder="e.g. Important Update for Tomorrow"
                                    className="w-full bg-[#0a0f1a] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-1">Body Message <span className="text-red-400">*</span></label>
                                <textarea
                                    value={notifBody}
                                    onChange={(e) => setNotifBody(e.target.value)}
                                    placeholder="Enter the main message details here..."
                                    rows={4}
                                    className="w-full bg-[#0a0f1a] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-300 mb-1">Start Date</label>
                                    <input
                                        type="datetime-local"
                                        value={notifStartDate}
                                        onChange={(e) => setNotifStartDate(e.target.value)}
                                        className="w-full bg-[#0a0f1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Leave blank to show immediately</p>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-300 mb-1">End Date <span className="text-red-400">*</span></label>
                                    <input
                                        type="datetime-local"
                                        value={notifEndDate}
                                        onChange={(e) => setNotifEndDate(e.target.value)}
                                        className="w-full bg-[#0a0f1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSendNotification}
                                disabled={notifSending || !notifHeader || !notifBody || !notifEndDate}
                                className="w-full mt-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
                            >
                                {notifSending ? 'Pushing...' : 'Push Notification'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
