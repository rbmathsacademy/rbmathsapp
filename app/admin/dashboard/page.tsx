'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, FileQuestion, Upload, ClipboardCheck, BarChart3, TrendingUp, CheckCircle2 } from 'lucide-react';

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalQuestions: 0,
        activeTests: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            fetchStats(user.email);
        }
    }, []);

    const fetchStats = async (email: string) => {
        try {
            const res = await fetch('/api/admin/dashboard/stats', {
                headers: { 'X-User-Email': email },
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            title: 'Total Students',
            value: stats.totalStudents,
            icon: Users,
            gradient: 'from-blue-500 to-cyan-500',
            href: null, // Not clickable
        },
        {
            title: 'Question Bank',
            value: stats.totalQuestions,
            icon: FileQuestion,
            gradient: 'from-purple-500 to-violet-500',
            href: '/admin/questions',
        },
        {
            title: 'Active Tests',
            value: stats.activeTests,
            icon: ClipboardCheck,
            gradient: 'from-emerald-500 to-teal-500',
            href: '/admin/online-tests',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400">
                    Dashboard
                </h1>
                <p className="text-slate-400 text-sm mt-1">Welcome back! Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    const isClickable = !!stat.href;
                    return (
                        <div
                            key={index}
                            onClick={() => isClickable && router.push(stat.href!)}
                            className={`bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6 transition-all duration-300 group ${isClickable
                                    ? 'hover:border-white/20 cursor-pointer hover:scale-[1.02]'
                                    : ''
                                }`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                                    <Icon className="h-6 w-6 text-white" />
                                </div>
                                {loading && (
                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                )}
                            </div>

                            <h3 className="text-sm text-slate-400 font-medium mb-1">{stat.title}</h3>

                            {loading ? (
                                <div className="h-10 bg-white/5 rounded animate-pulse"></div>
                            ) : (
                                <p className="text-4xl font-black text-white">{stat.value.toLocaleString()}</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Recent Activity</h2>
                        <BarChart3 className="h-5 w-5 text-slate-400" />
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse"></div>
                                ))}
                            </>
                        ) : (
                            <>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="p-2 rounded-lg bg-green-500/20">
                                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-white">New assignment submitted</p>
                                        <p className="text-xs text-slate-400">Student batch: Class 12 - 5 minutes ago</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="p-2 rounded-lg bg-blue-500/20">
                                        <Upload className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-white">Questions deployed</p>
                                        <p className="text-xs text-slate-400">45 questions added - 2 hours ago</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="p-2 rounded-lg bg-purple-500/20">
                                        <TrendingUp className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-white">Performance improved</p>
                                        <p className="text-xs text-slate-400">Class 11 average: +15% - Today</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Quick Actions</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => router.push('/admin/questions')}
                            className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 hover:border-blue-500/50 transition-all text-left group"
                        >
                            <FileQuestion className="h-6 w-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                            <p className="text-sm font-bold text-white">Add Questions</p>
                        </button>

                        <button
                            onClick={() => router.push('/admin/online-tests/create')}
                            className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 hover:border-emerald-500/50 transition-all text-left group"
                        >
                            <ClipboardCheck className="h-6 w-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                            <p className="text-sm font-bold text-white">Create Test</p>
                        </button>

                        <button
                            onClick={() => router.push('/admin/deploy')}
                            className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/10 border border-purple-500/30 hover:border-purple-500/50 transition-all text-left group"
                        >
                            <Upload className="h-6 w-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                            <p className="text-sm font-bold text-white">Deploy</p>
                        </button>

                        <button
                            onClick={() => router.push('/admin/online-tests')}
                            className="p-4 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 hover:border-orange-500/50 transition-all text-left group"
                        >
                            <BarChart3 className="h-6 w-6 text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
                            <p className="text-sm font-bold text-white">View Reports</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
