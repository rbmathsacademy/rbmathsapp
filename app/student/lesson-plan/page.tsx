'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Sparkles } from 'lucide-react';

export default function LessonPlan() {
    const router = useRouter();
    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/student/me');
            if (!res.ok) throw new Error('Unauthorized');
            const data = await res.json();
            setStudent(data);
        } catch (error) {
            router.push('/student/login');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-blue-400 animate-pulse">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/10 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#050b14]/70 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <button
                        onClick={() => router.push('/student')}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <h1 className="text-sm font-bold text-white">Lesson<span className="text-orange-400">Plan</span></h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-12 relative z-10">
                <div className="max-w-2xl mx-auto text-center">
                    {/* Icon */}
                    <div className="mb-8 flex justify-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                            <div className="relative p-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 shadow-2xl">
                                <Calendar className="h-16 w-16 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 mb-4">
                        Lesson Plan
                    </h2>

                    <p className="text-lg text-slate-400 mb-8">
                        This feature is currently under development and will be available soon!
                    </p>

                    {/* Coming Soon Badge */}
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 mb-8">
                        <Sparkles className="h-5 w-5 text-orange-400" />
                        <span className="text-sm font-bold text-orange-300">Coming Soon</span>
                    </div>

                    {/* Features List */}
                    <div className="bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-left">
                        <h3 className="text-xl font-bold text-white mb-4">Upcoming Features:</h3>
                        <ul className="space-y-3 text-slate-300">
                            <li className="flex items-start gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                                <span>View daily and weekly lesson schedules</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                                <span>Access course syllabi and learning objectives</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                                <span>Track completed topics and upcoming lessons</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                                <span>Receive notifications for lesson updates</span>
                            </li>
                        </ul>
                    </div>

                    {/* Back Button */}
                    <button
                        onClick={() => router.push('/student')}
                        className="mt-8 px-6 py-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/50 text-orange-300 font-medium transition-all"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </main>
        </div>
    );
}
