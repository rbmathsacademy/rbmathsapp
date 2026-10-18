'use client';

import { useState, useLayoutEffect } from 'react';
import { readCache, writeCache } from '@/lib/studentCache';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown, CheckCircle, Target, Award, BookOpen, Medal, Star } from 'lucide-react';
import BatchTabSwitcher from '../../components/BatchTabSwitcher';

export default function PerformanceOverviewPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

    // Same response as the dashboard, so its cached copy paints instantly; the request refreshes it
    useLayoutEffect(() => {
        const cached = readCache<any>('dash:');
        if (cached) {
            setData(cached.data);
            if (cached.data.student?.courses?.length > 0) setSelectedBatch(cached.data.student.courses[0]);
            setLoading(false);
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/student/dashboard-analytics');
            if (res.ok) {
                const json = await res.json();
                writeCache('dash:', json);
                setData(json);
                if (json.student?.courses && json.student.courses.length > 0) {
                    // keep the student's tab choice if they already switched while this loaded
                    setSelectedBatch(prev => (prev && json.student.courses.includes(prev)) ? prev : json.student.courses[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-[#0b0718]">
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) return <div className="text-white p-8">Failed to load data.</div>;

    const schoolExams = data.schoolExams?.filter((e: any) => e.batch === selectedBatch) || [];

    return (
        <div className="min-h-screen sd-bg text-slate-200 font-sans pb-20">
            <header className="sd-header sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
                    <button 
                        onClick={() => router.push('/student')}
                        className="p-2 -ml-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black sd-title tracking-tight">Performance Overview</h1>
                    </div>
                </div>
                
                {data.student?.courses && data.student.courses.length > 1 && (
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
                        <BatchTabSwitcher 
                            batches={data.student.courses} 
                            selectedBatch={selectedBatch || ''} 
                            onSelect={setSelectedBatch} 
                        />
                    </div>
                )}
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6 mb-8 flex items-start gap-4">
                    <div className="bg-violet-500/20 p-3 rounded-xl text-violet-400 shrink-0">
                        <Medal className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-violet-200 text-sm font-medium leading-relaxed">
                            Here is a comparison between the system's marks prediction (based on your online tests, offline tests, and assignments) vs your actual school marks.
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    {schoolExams.length === 0 ? (
                        <div className="relative bg-[#151029] rounded-3xl sd-gborder sd-gborder-soft sd-card p-12 text-center">
                            <Award className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No school exam records found for this batch yet.</p>
                        </div>
                    ) : (
                        schoolExams.map((exam: any, idx: number) => {
                            const isImproved = exam.syncStatus === 'IMPROVED';
                            const isDeteriorated = exam.syncStatus === 'DETERIORATED';
                            const isInSync = exam.syncStatus === 'IN_SYNC';

                            return (
                                <div key={exam._id || idx} className={`bg-[#151029] border-2 rounded-2xl overflow-hidden shadow-xl ${
                                    isImproved ? 'border-emerald-500/30 shadow-emerald-500/10' :
                                    isDeteriorated ? 'border-orange-500/30 shadow-orange-500/10' :
                                    'border-sky-500/30 shadow-fuchsia-500/10'
                                }`}>
                                    
                                    {/* 1. School Marks */}
                                    <div className={`px-5 py-4 border-b flex justify-between items-center ${
                                        isImproved ? 'bg-emerald-500/10 border-emerald-500/20' :
                                        isDeteriorated ? 'bg-orange-500/10 border-orange-500/20' :
                                        'bg-sky-500/10 border-sky-500/20'
                                    }`}>
                                        <div>
                                            <h3 className="text-lg font-black text-white">{exam.examName}</h3>
                                            <p className="text-xs font-medium text-slate-400 mt-0.5">
                                                {new Date(exam.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <div className="flex items-end gap-1">
                                                <span className={`text-3xl font-black ${
                                                    isImproved ? 'text-emerald-400' :
                                                    isDeteriorated ? 'text-orange-400' :
                                                    'text-sky-400'
                                                }`}>{exam.marksObtained}</span>
                                                <span className="text-sm font-bold text-slate-500 mb-1">/{exam.fullMarks}</span>
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest text-white/50">{exam.percentage.toFixed(1)}%</span>
                                        </div>
                                    </div>

                                    {/* 2. System Prediction Highlight */}
                                    <div className="px-5 py-3 bg-violet-950/40 border-b border-violet-500/20 flex justify-between items-center">
                                        <h4 className="text-violet-300 font-bold text-sm flex items-center gap-2">
                                            <Target className="w-4 h-4" /> System Predicted Marks
                                        </h4>
                                        <div className="text-xl font-black text-violet-300 bg-violet-500/10 px-3 py-1 rounded-lg border border-violet-500/20">
                                            {exam.priorSystemAvg}%
                                        </div>
                                    </div>
                                    
                                    {/* 3. Marks Breakdown */}
                                    <div className="px-5 py-5 border-b border-white/5 bg-[#151029]">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-black/20 rounded-xl p-3 text-center border border-white/5">
                                                <Target className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                                                <p className="text-xs text-slate-400 mb-1">Online</p>
                                                <p className="text-lg font-black text-white">{exam.priorAvgOnline > 0 ? `${exam.priorAvgOnline}%` : 'N/A'}</p>
                                            </div>
                                            <div className="bg-black/20 rounded-xl p-3 text-center border border-white/5">
                                                <BookOpen className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                                                <p className="text-xs text-slate-400 mb-1">Offline</p>
                                                <p className="text-lg font-black text-white">{exam.priorAvgOffline > 0 ? `${exam.priorAvgOffline}%` : 'N/A'}</p>
                                            </div>
                                            <div className="bg-black/20 rounded-xl p-3 text-center border border-white/5">
                                                <Star className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                                                <p className="text-xs text-slate-400 mb-1">Assign.</p>
                                                <p className="text-lg font-black text-white">{exam.priorAssignmentScore > 0 ? `${exam.priorAssignmentScore}%` : 'N/A'}</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-3 text-center italic">
                                            * These marks are generated based on the tests you appeared before your school exam date.
                                        </p>
                                    </div>

                                    {/* 4. Insight */}
                                    <div className="px-5 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center border-4 ${
                                                isImproved ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                                                isDeteriorated ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' :
                                                'bg-sky-500/20 border-sky-500/30 text-sky-400'
                                            }`}>
                                                {isImproved && <TrendingUp className="w-7 h-7" />}
                                                {isDeteriorated && <TrendingDown className="w-7 h-7" />}
                                                {isInSync && <CheckCircle className="w-7 h-7" />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Insight</p>
                                                <h4 className={`text-sm font-black leading-tight ${
                                                    isImproved ? 'text-emerald-400' :
                                                    isDeteriorated ? 'text-orange-400' :
                                                    'text-sky-400'
                                                }`}>
                                                    {isImproved && "Exceeded Expectations! 🎉"}
                                                    {isDeteriorated && "Underperformed — Let's bounce back! 💪"}
                                                    {isInSync && "In Sync — Consistent Performer! 🌟"}
                                                </h4>
                                                <p className="text-xs font-medium text-slate-400 mt-1 leading-snug">
                                                    System predicted ~{exam.priorSystemAvg}%. You scored {exam.percentage.toFixed(1)}%.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            );
                        })
                    )}
                </div>
                
                {schoolExams.length > 0 && (
                    <div className="mt-8 bg-violet-500/5 border border-violet-500/10 rounded-2xl p-5 text-center max-w-3xl mx-auto">
                        <p className="text-xs text-violet-200/60 leading-relaxed font-medium">
                            Note: The system average is calculated for all the online, offline tests, and the assignments the student has submitted before the exam date. The average is calculated by taking 35% of online test + 60% offline test and 5% of assignment rating.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}