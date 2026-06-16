'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, Search, Edit3, Trash2, Copy, Eye, Send, XCircle, AlertTriangle, Bell, X } from 'lucide-react';
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

interface NotificationItem {
    _id: string;
    title: string;
    message: string;
    targetBatches: string[];
    startDate?: string;
    endDate?: string;
    createdAt: string;
    readBy: string[];
}

export default function SurveysList() {
    const router = useRouter();
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'draft' | 'deployed' | 'closed'>('all');

    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [editNotificationId, setEditNotificationId] = useState<string | null>(null);
    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [notifHeader, setNotifHeader] = useState('');
    const [notifBody, setNotifBody] = useState('');
    const [notifStartDate, setNotifStartDate] = useState('');
    const [notifEndDate, setNotifEndDate] = useState('');
    const [notifSending, setNotifSending] = useState(false);

    const openEditNotification = (notif: NotificationItem) => {
        setNotifHeader(notif.title);
        setNotifBody(notif.message);
        setNotifStartDate(notif.startDate ? new Date(notif.startDate).toISOString().slice(0, 16) : '');
        setNotifEndDate(notif.endDate ? new Date(notif.endDate).toISOString().slice(0, 16) : '');
        setSelectedBatches(notif.targetBatches || []);
        setEditNotificationId(notif._id);
        setShowNotificationModal(true);
    };

    const openCreateNotification = () => {
        setNotifHeader('');
        setNotifBody('');
        setNotifStartDate('');
        setNotifEndDate('');
        setSelectedBatches([]);
        setEditNotificationId(null);
        setShowNotificationModal(true);
    };

    const fetchBatches = async () => {
        try {
            const res = await fetch('/api/admin/fees/batches', {
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            if (res.ok) {
                const data = await res.json();
                setBatches(data.batches || []);
            }
        } catch (error) {
            console.error('Failed to fetch batches:', error);
        }
    };

    const handleSendNotification = async () => {
        if (!notifHeader || !notifBody || !notifEndDate || selectedBatches.length === 0) return toast.error('Header, body, batches, and End Date are required');
        setNotifSending(true);
        try {
            const method = editNotificationId ? 'PUT' : 'POST';
            const bodyPayload = {
                ...(editNotificationId && { _id: editNotificationId }),
                title: notifHeader,
                message: notifBody,
                startDate: notifStartDate ? new Date(notifStartDate) : new Date(),
                endDate: new Date(notifEndDate),
                targetBatches: selectedBatches
            };

            const res = await fetch('/api/admin/notifications', {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : ''
                },
                body: JSON.stringify(bodyPayload)
            });
            if (!res.ok) throw new Error('Failed to save notification');
            toast.success(editNotificationId ? 'Notification updated!' : 'Notification pushed successfully!');
            setShowNotificationModal(false);
            fetchSurveysAndNotifications();
        } catch (e) {
            toast.error('Failed to save notification');
        } finally {
            setNotifSending(false);
        }
    };

    const fetchSurveysAndNotifications = async () => {
        setLoading(true);
        try {
            const [resSurveys, resNotifs] = await Promise.all([
                fetch(`/api/admin/surveys${filter !== 'all' ? `?status=${filter}` : ''}`, {
                    headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
                }),
                fetch('/api/admin/notifications', {
                    headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
                })
            ]);
            
            if (resSurveys.ok) {
                const data = await resSurveys.json();
                setSurveys(data.surveys || []);
            }
            if (resNotifs.ok) {
                const notifData = await resNotifs.json();
                setNotifications(notifData || []);
            }
        } catch (error: any) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSurveysAndNotifications(); fetchBatches(); }, [filter]);

    const handleDeleteNotification = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete notification "${title}"?`)) return;
        const toastId = toast.loading('Deleting notification...');
        try {
            const res = await fetch(`/api/admin/notifications?id=${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            if (!res.ok) throw new Error('Failed to delete');
            toast.success('Notification deleted', { id: toastId });
            fetchSurveysAndNotifications();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete notification', { id: toastId });
        }
    };

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
            fetchSurveysAndNotifications();
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
            fetchSurveysAndNotifications();
        } catch (error: any) {
            toast.error(error.message || 'Failed to close survey', { id: toastId });
        }
    };

    const filteredSurveys = surveys.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));
    const filteredNotifications = notifications.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.message.toLowerCase().includes(search.toLowerCase()));

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
                <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={openCreateNotification} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 text-orange-400 font-bold hover:bg-orange-500/20 transition-all border border-orange-500/20 shadow-lg shadow-orange-500/5">
                        <Bell className="h-5 w-5" /> Push Notification
                    </button>
                    <Link href="/admin/surveys/create" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/20">
                        <Plus className="h-5 w-5" /> Create New Survey
                    </Link>
                </div>
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
            ) : (
                <>
                    {/* Surveys Section */}
                    {filteredSurveys.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <ClipboardList className="h-5 w-5 text-blue-400" /> Active Surveys
                            </h2>
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
                        </div>
                    )}

                    {/* Notifications Section */}
                    {filteredNotifications.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Bell className="h-5 w-5 text-orange-400" /> Push Notifications
                            </h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredNotifications.map(notif => (
                                    <div key={notif._id} className="bg-orange-950/20 border border-orange-500/20 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all flex flex-col">
                                        <div className="p-5 flex-1">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/20">
                                                    Notification
                                                </span>
                                                <div className="text-[10px] text-orange-500/50 font-medium">
                                                    {new Date(notif.createdAt).toLocaleDateString('en-GB')}
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{notif.title}</h3>
                                            <p className="text-xs text-orange-200/60 mb-4 line-clamp-2">{notif.message}</p>
                                            
                                            {notif.targetBatches && notif.targetBatches.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-[10px] text-orange-500/60 font-bold uppercase mb-1.5 tracking-wider">Targeted Batches:</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {notif.targetBatches.slice(0, 3).map((b: string) => (
                                                            <span key={b} className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] border border-orange-500/20 truncate max-w-[120px]">{b}</span>
                                                        ))}
                                                        {notif.targetBatches.length > 3 && (
                                                            <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400/50 text-[10px] border border-orange-500/10">+{notif.targetBatches.length - 3}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 border-t border-orange-500/20 bg-orange-500/5 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => openEditNotification(notif)} className="p-2 rounded-lg text-orange-400/70 hover:text-orange-300 hover:bg-orange-500/20 transition-colors" title="Edit Notification">
                                                    <Edit3 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => handleDeleteNotification(notif._id, notif.title)} className="p-2 rounded-lg text-orange-400/50 hover:text-red-400 hover:bg-red-500/20 transition-colors" title="Delete Notification">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {filteredSurveys.length === 0 && filteredNotifications.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-white/5 rounded-3xl border border-white/10 border-dashed">
                            <ClipboardList className="h-16 w-16 mb-4 opacity-20" />
                            <p className="text-lg font-bold text-white mb-1">No items found</p>
                            <p className="text-sm">Create a new survey or push notification</p>
                        </div>
                    )}
                </>
            )}

            {/* General Notification Modal */}
            {showNotificationModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Bell className="h-5 w-5 text-orange-400" /> {editNotificationId ? 'Edit' : 'Push Broadcast'} Notification
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

                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2">Target Batches <span className="text-red-400">*</span></label>
                                <div className="max-h-40 overflow-y-auto bg-[#0a0f1a] border border-white/10 rounded-xl p-2 space-y-1">
                                    {batches.map(batch => (
                                        <label key={batch} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedBatches.includes(batch)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedBatches(prev => [...prev, batch]);
                                                    else setSelectedBatches(prev => prev.filter(b => b !== batch));
                                                }}
                                                className="w-4 h-4 rounded border-white/20 bg-black/50 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                                            />
                                            <span className="text-sm font-medium text-gray-300">{batch}</span>
                                        </label>
                                    ))}
                                    {batches.length === 0 && (
                                        <p className="text-sm text-gray-500 text-center py-2">Loading batches...</p>
                                    )}
                                </div>
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
                                disabled={notifSending || !notifHeader || !notifBody || !notifEndDate || selectedBatches.length === 0}
                                className="w-full mt-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
                            >
                                {notifSending ? 'Saving...' : (editNotificationId ? 'Update Notification' : 'Push Notification')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
