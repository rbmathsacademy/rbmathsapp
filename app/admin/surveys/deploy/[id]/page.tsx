'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Send, Users, AlertCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function DeploySurveyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [survey, setSurvey] = useState<any>(null);
    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [deploying, setDeploying] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const headers = { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' };
                
                // Fetch survey
                const sRes = await fetch(`/api/admin/surveys?status=draft`, { headers });
                const sData = await sRes.json();
                const foundSurvey = sData.surveys?.find((s: any) => s._id === id);
                if (!foundSurvey) {
                    toast.error('Survey not found or already deployed');
                    return router.push('/admin/surveys');
                }
                setSurvey(foundSurvey);
                if (foundSurvey.endDate) setEndDate(new Date(foundSurvey.endDate).toISOString().slice(0, 16));

                // Fetch batches
                const bRes = await fetch('/api/admin/fees/batches');
                const bData = await bRes.json();
                setBatches(bData.batches || []);
            } catch (error) {
                toast.error('Failed to load data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, router]);

    const toggleBatch = (batch: string) => {
        const next = new Set(selectedBatches);
        if (next.has(batch)) next.delete(batch);
        else next.add(batch);
        setSelectedBatches(next);
    };

    const selectAll = () => setSelectedBatches(new Set(batches));
    const deselectAll = () => setSelectedBatches(new Set());

    const handleDeploy = async () => {
        if (selectedBatches.size === 0) return toast.error('Please select at least one batch');

        const toastId = toast.loading('Deploying survey...');
        setDeploying(true);

        try {
            const res = await fetch(`/api/admin/surveys/${id}/deploy`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : ''
                },
                body: JSON.stringify({
                    batches: Array.from(selectedBatches),
                    endDate: endDate ? new Date(endDate).toISOString() : undefined
                })
            });

            if (!res.ok) throw new Error((await res.json()).error);
            toast.success('Survey deployed successfully!', { id: toastId });
            router.push(`/admin/surveys/monitor/${id}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to deploy', { id: toastId });
            setDeploying(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-500">Loading...</div>;
    if (!survey) return null;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <Toaster position="top-center" />

            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <ChevronLeft className="h-6 w-6 text-slate-400" />
                </button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                        Deploy Survey
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">{survey.title}</p>
                </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <h3 className="text-amber-400 font-bold text-sm">Deployment is final</h3>
                    <p className="text-amber-400/80 text-xs mt-1">Once deployed, students will start seeing this survey immediately upon login. You cannot edit questions after deployment, but you can exclude specific students or close the survey early.</p>
                </div>
            </div>

            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-400" /> Select Target Batches
                </h2>

                <div className="flex gap-2 mb-4">
                    <button onClick={selectAll} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors">Select All</button>
                    <button onClick={deselectAll} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-400 transition-colors">Deselect All</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {batches.map(batch => (
                        <label key={batch} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedBatches.has(batch) ? 'bg-blue-500/10 border-blue-500/30 text-white' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}>
                            <input
                                type="checkbox"
                                checked={selectedBatches.has(batch)}
                                onChange={() => toggleBatch(batch)}
                                className="rounded bg-slate-900 border-white/20 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                            />
                            <span className="text-sm font-medium">{batch}</span>
                        </label>
                    ))}
                </div>
                
                {selectedBatches.size > 0 && (
                    <p className="mt-4 text-sm font-bold text-blue-400 text-center">
                        {selectedBatches.size} batch(es) selected
                    </p>
                )}
            </div>

            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                <label className="block text-sm font-bold text-white mb-2">Auto-Close Date (Optional)</label>
                <p className="text-xs text-slate-400 mb-4">Survey will automatically close and disappear from popups after this date.</p>
                <input
                    type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full md:w-1/2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                />
            </div>

            <button
                disabled={selectedBatches.size === 0 || deploying}
                onClick={handleDeploy}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-lg hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
                <Send className="h-5 w-5" />
                {deploying ? 'Deploying...' : `Deploy to ${selectedBatches.size} Batch${selectedBatches.size === 1 ? '' : 'es'}`}
            </button>
        </div>
    );
}
