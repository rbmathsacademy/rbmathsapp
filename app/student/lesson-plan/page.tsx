'use client';

import { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon, BookText, GraduationCap,
    Laptop, ClipboardList, ChevronLeft, Loader2, ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LessonPlanItem {
    date: string;
    type: 'Class' | 'Online' | 'Offline';
    description: string;
}

export default function StudentLessonPlan() {
    const router = useRouter();
    const [plans, setPlans] = useState<LessonPlanItem[]>([]);
    const [currentBatch, setCurrentBatch] = useState('');
    const [batches, setBatches] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLessonPlan();
    }, []);

    const fetchLessonPlan = async (batch?: string) => {
        setLoading(true);
        try {
            const url = batch ? `/api/student/lesson-plan?batch=${encodeURIComponent(batch)}` : '/api/student/lesson-plan';
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setPlans(data.plans);
                setCurrentBatch(data.currentBatch);
                setBatches(data.availableBatches || []);
            }
        } catch (e) {
            console.error('Error fetching lesson plan:', e);
        } finally {
            setLoading(false);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Class': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'Online': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'Offline': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Class': return <GraduationCap className="h-4 w-4" />;
            case 'Online': return <Laptop className="h-4 w-4" />;
            case 'Offline': return <ClipboardList className="h-4 w-4" />;
            default: return null;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-IN', { month: 'short' });
        const year = date.getFullYear();
        const weekday = date.toLocaleDateString('en-IN', { weekday: 'long' });

        const getOrdinal = (n: number) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        return `${getOrdinal(day)} ${month} ${year} (${weekday})`;
    };

    return (
        <div className="min-h-screen bg-[#050b14] text-slate-200 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                        onClick={() => router.push('/student')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group self-start"
                    >
                        <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Dashboard
                    </button>

                    <div className="text-center sm:text-right">
                        <h1 className="text-2xl font-black text-white flex items-center gap-2 justify-center sm:justify-end">
                            <CalendarIcon className="h-6 w-6 text-blue-500" />
                            Lesson Plan
                        </h1>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Academic Schedule & Progress</p>
                    </div>
                </div>

                {/* Batch Context / Selection */}
                {batches.length > 1 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                        {batches.map(b => (
                            <button
                                key={b}
                                onClick={() => fetchLessonPlan(b)}
                                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${currentBatch === b ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 border-white/5 text-slate-400 hover:border-white/20'}`}
                            >
                                {b}
                            </button>
                        ))}
                    </div>
                )}

                {/* Content Area */}
                <div className="bg-[#1a1f2e] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between bg-slate-800/20">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <BookText className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-tight">Schedule for <span className="text-blue-400">{currentBatch || 'Your Batch'}</span></h2>
                                <p className="text-[10px] text-slate-500">Academic curriculum & examination schedule</p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                            <p className="text-slate-500 text-xs animate-pulse">Synchronizing your schedule...</p>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="py-20 text-center space-y-4 px-6">
                            <div className="h-16 w-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto">
                                <CalendarIcon className="h-8 w-8 text-slate-600" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-white font-bold">No Schedule Found</h3>
                                <p className="text-slate-500 text-xs">A lesson plan hasn't been uploaded for your batch yet.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {plans.map((plan, idx) => (
                                <div key={idx} className="p-4 sm:p-6 hover:bg-white/[0.02] transition-all group">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                    <CalendarIcon className="h-4 w-4 text-blue-400" />
                                                </div>
                                                <span className="text-sm font-bold text-white tracking-tight">
                                                    {formatDate(plan.date)}
                                                </span>
                                            </div>
                                            <div className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 shrink-0 ${getTypeColor(plan.type)}`}>
                                                {getTypeIcon(plan.type)}
                                                <span className="text-[9px] font-black uppercase tracking-widest leading-none">{plan.type}</span>
                                            </div>
                                        </div>

                                        <div className="pl-10">
                                            <p className="text-slate-400 text-sm leading-relaxed">
                                                {plan.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-center pt-4">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                        RB Maths Academy &bull; Real-time Schedule Sync
                    </p>
                </div>
            </div>
        </div>
    );
}
