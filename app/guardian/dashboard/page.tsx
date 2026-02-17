'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    BarChart2,
    Calendar,
    Target,
    Trophy,
    Users,
    CheckCircle2,
    XCircle,
    Clock,
    FileText
} from 'lucide-react';

interface DashboardData {
    student: {
        name: string;
        phoneNumber: string;
        courses: string[];
    };
    tests: Array<{
        testId: string;
        title: string;
        score: number | null;
        totalMarks: number;
        percentage: string | null;
        highestScore: number;
        averageScore: number;
        status: string;
        deploymentDate: string;
    }>;
    assignments: Array<{
        assignmentId: string;
        title: string;
        deadline: string;
        status: string;
        submittedAt: string | null;
    }>;
}

export default function GuardianDashboard() {
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.role !== 'guardian') {
                router.push('/admin/login');
                return;
            }
            fetchData(user.phoneNumber);
        } else {
            router.push('/admin/login');
        }
    }, []);

    const fetchData = async (phone: string) => {
        try {
            const res = await fetch('/api/guardian/analytics', {
                headers: { 'X-User-Phone': phone }
            });
            if (res.ok) {
                const result = await res.json();
                setData(result);
            } else {
                // Check if it was a 401 or 404
                console.error("Failed to fetch guardian data", res.status);
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center text-white">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) return <div className="text-white text-center mt-20">Failed to load data.</div>;

    const attemptedTests = data.tests.filter(t => t.score !== null).length;
    const missedTests = data.tests.filter(t => t.status === 'missed').length;
    const avgScore = data.tests.reduce((acc, curr) => acc + (parseFloat(curr.percentage || '0')), 0) / (attemptedTests || 1);

    return (
        <div className="pb-12 space-y-8">
            {/* Student Profile Card */}
            <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
                    {data.student.name[0]}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">{data.student.name}</h1>
                    <p className="text-slate-400 text-sm mt-1 flex flex-col sm:flex-row gap-1 sm:gap-3 items-center sm:items-start">
                        <span>{data.student.phoneNumber}</span>
                        <span className="hidden sm:inline text-slate-600">•</span>
                        <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-xs font-medium border border-blue-500/20">
                            {data.student.courses.join(', ')}
                        </span>
                    </p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 md:gap-6">
                <div className="bg-[#1a1f2e] border border-white/5 p-4 rounded-xl text-center">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Tests Attempted</p>
                    <p className="text-2xl font-black text-white">{attemptedTests}</p>
                </div>
                <div className="bg-[#1a1f2e] border border-white/5 p-4 rounded-xl text-center">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Tests Missed</p>
                    <p className="text-2xl font-black text-red-400">{missedTests}</p>
                </div>
                <div className="bg-[#1a1f2e] border border-white/5 p-4 rounded-xl text-center">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Avg Score</p>
                    <p className="text-2xl font-black text-blue-400">{avgScore.toFixed(0)}%</p>
                </div>
            </div>

            {/* Tab/Section: Recent Tests */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-amber-400" /> Test Performance
                </h2>

                <div className="space-y-4">
                    {data.tests.map(test => (
                        <div key={test.testId} className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden shadow-lg">
                            <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-white/5">
                                <span className="font-semibold text-gray-200 text-sm">{test.title}</span>
                                {test.status === 'missed' ? (
                                    <span className="bg-red-500/20 text-red-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-red-500/30">Missed</span>
                                ) : (
                                    <span className="text-[10px] text-slate-500">{new Date(test.deploymentDate).toLocaleDateString()}</span>
                                )}
                            </div>

                            <div className="p-4 grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase">Score</p>
                                    <p className={`text-xl font-bold ${test.score === null ? 'text-slate-600' :
                                        parseFloat(test.percentage || '0') >= 75 ? 'text-green-400' :
                                            parseFloat(test.percentage || '0') >= 40 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>
                                        {test.score ?? '-'}
                                        <span className="text-[10px] text-slate-500 ml-0.5 font-normal">/{test.totalMarks}</span>
                                    </p>
                                </div>
                                <div className="border-l border-white/5">
                                    <p className="text-[10px] text-slate-500 uppercase">Highest</p>
                                    <p className="text-xl font-bold text-purple-400">{test.highestScore}</p>
                                </div>
                                <div className="border-l border-white/5">
                                    <p className="text-[10px] text-slate-500 uppercase">Avg</p>
                                    <p className="text-xl font-bold text-blue-400">{test.averageScore}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {data.tests.length === 0 && <p className="text-slate-500 text-sm italic">No test records found.</p>}
                </div>
            </div>

            {/* Tab/Section: Assignments */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" /> Recent Assignments
                </h2>

                <div className="space-y-3">
                    {data.assignments.map(assign => (
                        <div key={assign.assignmentId} className="bg-[#1a1f2e] border border-white/5 rounded-xl p-4 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-semibold text-white mb-0.5">{assign.title}</p>
                                <p className="text-[10px] text-slate-500">
                                    Deadline: {new Date(assign.deadline).toLocaleDateString()}
                                </p>
                            </div>
                            <div>
                                {assign.status === 'submitted' || assign.status === 'graded' ? (
                                    <span className="flex items-center gap-1 text-green-400 text-xs font-bold bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                                        <CheckCircle2 className="w-3 h-3" /> Submitted
                                    </span>
                                ) : assign.status === 'missed' ? (
                                    <span className="flex items-center gap-1 text-red-400 text-xs font-bold bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                                        <XCircle className="w-3 h-3" /> Missed
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                        <Clock className="w-3 h-3" /> Pending
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                    {data.assignments.length === 0 && <p className="text-slate-500 text-sm italic">No assignment records found.</p>}
                </div>
            </div>
        </div>
    );
}
