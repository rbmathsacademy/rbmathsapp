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
    FileText,
    DollarSign,
    BookOpen,
    AlertCircle,
    CheckCircle,
    GraduationCap,
    Laptop,
    ClipboardList,
    LayoutDashboard
} from 'lucide-react';

interface FeeRecord {
    _id: string;
    invoiceNo: string;
    amount: number;
    paymentMode: string;
    entryDate: string;
    feesMonth: string;
    year: number;
    monthIndex: number;
    recordType: 'PAYMENT' | 'NEW_ADMISSION' | 'EXEMPTED';
    batch: string;
}

interface LessonPlanItem {
    date: string;
    type: 'Class' | 'Online' | 'Offline';
    description: string;
}

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function GuardianDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'lesson-plan' | 'fees'>('dashboard');
    const [data, setData] = useState<DashboardData | null>(null);
    const [lessonPlans, setLessonPlans] = useState<LessonPlanItem[]>([]);
    const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [feesLoading, setFeesLoading] = useState(false);
    const [lpLoading, setLpLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLessonPlan = async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.phoneNumber) return;

        setLpLoading(true);
        try {
            const res = await fetch('/api/guardian/lesson-plan', {
                headers: { 'X-User-Phone': user.phoneNumber }
            });
            const result = await res.json();
            if (result.success) {
                setLessonPlans(result.plans);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLpLoading(false);
        }
    };

    const fetchFees = async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.phoneNumber) return;

        setFeesLoading(true);
        try {
            const res = await fetch('/api/guardian/fees', {
                headers: { 'X-User-Phone': user.phoneNumber }
            });
            const result = await res.json();
            if (result.records) {
                setFeeRecords(result.records);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFeesLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'lesson-plan' && lessonPlans.length === 0) fetchLessonPlan();
        if (activeTab === 'fees' && feeRecords.length === 0) fetchFees();
    }, [activeTab]);

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

    const getFeeStatusForMonth = (year: number, monthIndex: number) => {
        // Simplified: using first batch student is in
        const batch = data.student.courses[0];
        const monthRecords = feeRecords.filter(r => r.year === year && r.monthIndex === monthIndex);

        const payment = monthRecords.find(r => r.recordType === 'PAYMENT' || !r.recordType);
        if (payment) return { status: 'PAID', record: payment };

        const exempted = monthRecords.find(r => r.recordType === 'EXEMPTED');
        if (exempted) return { status: 'EXEMPTED', record: exempted };

        const newAdmission = monthRecords.find(r => r.recordType === 'NEW_ADMISSION');
        if (newAdmission) return { status: 'NEW_ADMISSION', record: newAdmission };

        return { status: 'PENDING', record: null };
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Class': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'Online': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'Offline': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    return (
        <div className="pb-12 space-y-8 animate-in fade-in duration-500">
            {/* Student Profile Card */}
            <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
                    {data.student.name[0]}
                </div>
                <div className="flex-1">
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

            {/* Tab Navigation */}
            <div className="flex p-1 bg-slate-900/50 rounded-xl border border-white/5 max-w-md mx-auto sm:mx-0 overflow-x-auto no-scrollbar">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                    { id: 'lesson-plan', label: 'Lesson Plan', icon: Calendar },
                    { id: 'fees', label: 'Fees', icon: DollarSign }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all min-w-[100px] ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-3 md:gap-6">
                        <div className="bg-[#1a1f2e] border border-white/5 p-4 rounded-xl text-center">
                            <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Tests Attempted</p>
                            <p className="text-2xl font-black text-white">{attemptedTests}</p>
                        </div>
                        <div className="bg-[#1a1f2e] border border-white/5 p-4 rounded-xl text-center">
                            <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Tests Missed</p>
                            <p className="text-2xl font-black text-red-400">{missedTests}</p>
                        </div>
                        <div className="bg-[#1a1f2e] border border-white/5 p-4 rounded-xl text-center">
                            <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Avg Score</p>
                            <p className="text-2xl font-black text-blue-400">{avgScore.toFixed(0)}%</p>
                        </div>
                    </div>

                    {/* Test Performance */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-amber-400" /> Test Performance
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.tests.map(test => (
                                <div key={test.testId} className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden shadow-lg">
                                    <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-white/5">
                                        <span className="font-semibold text-gray-200 text-xs truncate max-w-[150px]">{test.title}</span>
                                        {test.status === 'missed' ? (
                                            <span className="bg-red-500/20 text-red-400 text-[8px] uppercase font-bold px-2 py-0.5 rounded border border-red-500/30">Missed</span>
                                        ) : (
                                            <span className="text-[9px] text-slate-500">{new Date(test.deploymentDate).toLocaleDateString()}</span>
                                        )}
                                    </div>

                                    <div className="p-4 grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <p className="text-[9px] text-slate-500 uppercase font-bold">Score</p>
                                            <p className={`text-xl font-black ${test.score === null ? 'text-slate-600' :
                                                parseFloat(test.percentage || '0') >= 75 ? 'text-green-400' :
                                                    parseFloat(test.percentage || '0') >= 40 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {test.score ?? '-'}
                                                <span className="text-[10px] text-slate-500 ml-0.5 font-normal">/{test.totalMarks}</span>
                                            </p>
                                        </div>
                                        <div className="border-l border-white/5">
                                            <p className="text-[9px] text-slate-500 uppercase font-bold">Highest</p>
                                            <p className="text-xl font-bold text-purple-400">{test.highestScore}</p>
                                        </div>
                                        <div className="border-l border-white/5">
                                            <p className="text-[9px] text-slate-500 uppercase font-bold">Avg</p>
                                            <p className="text-xl font-bold text-blue-400">{test.averageScore}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {data.tests.length === 0 && <p className="text-slate-500 text-sm italic">No test records found.</p>}
                        </div>
                    </div>

                    {/* Recent Assignments */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-400" /> Recent Assignments
                        </h2>

                        <div className="space-y-3">
                            {data.assignments.map(assign => (
                                <div key={assign.assignmentId} className="bg-[#1a1f2e] border border-white/5 rounded-xl p-4 flex justify-between items-center group hover:bg-[#252a3b] transition-all">
                                    <div>
                                        <p className="text-sm font-semibold text-white mb-0.5">{assign.title}</p>
                                        <p className="text-[10px] text-slate-500">
                                            Deadline: {new Date(assign.deadline).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        {assign.status === 'submitted' || assign.status === 'graded' ? (
                                            <span className="flex items-center gap-1 text-green-400 text-[10px] font-bold bg-green-500/10 px-2 py-1 rounded border border-green-500/20 uppercase tracking-widest">
                                                <CheckCircle2 className="w-3 h-3" /> Submitted
                                            </span>
                                        ) : assign.status === 'missed' ? (
                                            <span className="flex items-center gap-1 text-red-400 text-[10px] font-bold bg-red-500/10 px-2 py-1 rounded border border-red-500/20 uppercase tracking-widest">
                                                <XCircle className="w-3 h-3" /> Missed
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-amber-400 text-[10px] font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 uppercase tracking-widest">
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
            )}

            {activeTab === 'lesson-plan' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-400" /> Academic Schedule
                    </h2>

                    <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                        {lpLoading ? (
                            <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 text-blue-500 animate-spin" /></div>
                        ) : lessonPlans.length === 0 ? (
                            <div className="py-20 text-center text-slate-500 text-sm">No lesson plans found for this batch.</div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {lessonPlans.map((plan, idx) => (
                                    <div key={idx} className="p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
                                        <div className="min-w-[120px] flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                {new Date(plan.date).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })}
                                            </span>
                                            <span className="text-lg font-black text-white">
                                                {new Date(plan.date).getFullYear()}
                                            </span>
                                            <div className={`mt-2 px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase text-center ${getTypeColor(plan.type)}`}>
                                                {plan.type === 'Online' ? 'Online Test' : plan.type === 'Offline' ? 'Offline Test' : plan.type}
                                            </div>
                                        </div>
                                        <div className="flex-1 text-slate-300 text-sm font-medium leading-relaxed">
                                            {plan.description}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'fees' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-emerald-400" /> Fee Records
                        </h2>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="bg-slate-800 border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                        >
                            {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {MONTHS.map((month, idx) => {
                            const { status, record } = getFeeStatusForMonth(selectedYear, idx);
                            return (
                                <div key={month} className={`p-4 rounded-xl border text-center transition-all ${status === 'PAID' ? 'bg-emerald-500/10 border-emerald-500/30' :
                                    status === 'EXEMPTED' ? 'bg-purple-500/10 border-purple-500/30' :
                                        status === 'NEW_ADMISSION' ? 'bg-amber-500/10 border-amber-500/30' :
                                            'bg-slate-900/40 border-white/5 opacity-50'
                                    }`}>
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">{month}</p>
                                    <div className="flex justify-center mb-1">
                                        {status === 'PAID' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> :
                                            status === 'PENDING' ? <Clock className="h-4 w-4 text-slate-600" /> :
                                                <AlertCircle className="h-4 w-4 text-blue-400" />}
                                    </div>
                                    <p className={`text-[10px] font-bold ${status === 'PAID' ? 'text-emerald-400' :
                                        status === 'PENDING' ? 'text-slate-600' : 'text-blue-400'
                                        }`}>
                                        {status === 'PAID' ? `₹${record?.amount}` : status}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function Loader2({ className }: { className?: string }) {
    return <Clock className={`animate-spin ${className}`} />;
}
