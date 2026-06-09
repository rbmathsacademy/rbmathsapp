'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar, Search, ArrowLeft, Download, Users } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function TimeTrackingDashboard() {
    const router = useRouter();
    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string>('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/admin/courses')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setBatches(data);
            })
            .catch(() => toast.error('Failed to load batches'));
    }, []);

    const fetchData = async () => {
        if (!selectedBatch) return toast.error('Please select a batch');
        if (!startDate || !endDate) return toast.error('Please select a date range');

        setLoading(true);
        try {
            const res = await fetch(`/api/admin/analytics/time-tracking?batch=${encodeURIComponent(selectedBatch)}&startDate=${startDate}&endDate=${endDate}`);
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            setData(result.data || []);
        } catch (error: any) {
            toast.error(error.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds) return '0 mins';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h} hrs ${m} mins`;
        return `${m} mins`;
    };

    const filteredData = data.filter(d => 
        d.studentName.toLowerCase().includes(search.toLowerCase()) || 
        d.studentPhone.includes(search)
    );

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto min-h-screen text-gray-200">
            <Toaster position="top-center" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/admin/analytics')} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                            <ArrowLeft className="h-5 w-5 text-gray-400" />
                        </button>
                        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            Screen Time Analytics
                        </h1>
                    </div>
                    <p className="text-gray-400 mt-1 ml-11">Track how much time students spend studying.</p>
                </div>
            </div>

            <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl p-6 mb-8 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Batch</label>
                    <select
                        value={selectedBatch}
                        onChange={(e) => setSelectedBatch(e.target.value)}
                        className="w-full bg-[#0a0f1a] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="">Select Batch...</option>
                        {batches.map(batch => (
                            <option key={batch} value={batch}>{batch}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Start Date</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-[#0a0f1a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">End Date</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-[#0a0f1a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading || !selectedBatch}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl disabled:opacity-50 transition-colors h-[42px] flex items-center gap-2"
                >
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                    Analyze
                </button>
            </div>

            {data.length > 0 && (
                <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-400" /> Time Report
                        </h2>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search student..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-[#0a0f1a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/10 text-left">
                                    <th className="px-6 py-4 font-bold text-gray-400">Student</th>
                                    <th className="px-6 py-4 font-bold text-gray-400">Assignments Page</th>
                                    <th className="px-6 py-4 font-bold text-gray-400">Question Bank Page</th>
                                    <th className="px-6 py-4 font-bold text-blue-400">Total Active Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredData.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">No data found.</td></tr>
                                ) : filteredData.map((d, idx) => (
                                    <tr key={idx} className="hover:bg-white/[0.02]">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white">{d.studentName}</div>
                                            <div className="text-xs text-gray-500">{d.studentPhone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">{formatTime(d.assignmentsTime)}</td>
                                        <td className="px-6 py-4 text-gray-300">{formatTime(d.questionBankTime)}</td>
                                        <td className="px-6 py-4">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                                                <Clock className="w-3.5 h-3.5" />
                                                {formatTime(d.totalTime)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
