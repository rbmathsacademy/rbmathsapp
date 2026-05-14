'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    BarChart2,
    FileText,
    LogOut,
    Menu,
    X,
    CheckCircle2,
    XCircle,
    Clock,
    Award,
    TrendingUp,
    ClipboardCheck,
    BookOpen,
    Calendar,
    DollarSign,
    Target,
    Trophy,
    Users,
    MessageSquare,
    Medal
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { useStudentProfile } from './StudentProfileContext';

const FREE_BATCH = 'Class XI (Free batch) 2026-27';

interface DashboardData {
    student: {
        name: string;
        phoneNumber: string;
        courses: string[];
        joinedAt: string;
    };
    stats: {
        avgTestPercentage: number;
        testsAttempted: number;
        testsMissed: number;
        assignmentsSubmitted: number;
        assignmentsMissed: number;
    };
    tests: Array<{
        testId: string;
        title: string;
        score: number | null;
        totalMarks: number;
        percentage: number | null;
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
        quality: 'GOOD' | 'SATISFACTORY' | 'POOR' | null;
    }>;
    offlineExams?: Array<{
        examId: string;
        batch: string;
        chapterName: string;
        testDate: string;
        fullMarks: number;
        marksObtained: number;
        percentage: number;
        highestPercentage: number;
        averagePercentage: number;
        rank: number;
        totalStudents: number;
    }>;
}

export default function StudentDashboard() {
    const router = useRouter();
    const { profile: studentProfile, isFreeBatchOnly } = useStudentProfile();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);

    const fetchUnreadStatus = async () => {
        try {
            const res = await fetch('/api/chat/student-status');
            const data = await res.json();
            if (res.ok) setUnreadChatCount(data.unreadCount || 0);
        } catch (e) {}
    };

    useEffect(() => {
        fetchData();
        fetchUnreadStatus();
        const interval = setInterval(fetchUnreadStatus, 120000); // Check every 2 minutes
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/student/dashboard-analytics');
            if (res.ok) {
                const result = await res.json();
                setData(result);
            } else {
                if (res.status === 401) {
                    handleLogout();
                    return;
                }
                toast.error('Failed to load dashboard data');
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        document.cookie = 'auth_token=; Max-Age=0; path=/;';
        localStorage.clear();
        window.location.replace('/student/login');
    };

    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (user) {
            try {
                const parsed = JSON.parse(user);
                setUserRole(parsed.role);
            } catch (e) { }
        }
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050b14] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse"></div>
                <div className="text-blue-400 animate-pulse text-xl font-medium relative z-10 font-sans">Loading your portal...</div>
            </div>
        );
    }

    if (!data) return null;

    const allNavItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Menu, href: '/student', gradient: 'from-blue-600 to-indigo-600' },
        { id: 'online-test', label: 'Online Test', icon: ClipboardCheck, href: '/student/online-test', gradient: 'from-emerald-500 to-teal-500' },
        { id: 'assignments', label: 'Assignment Submission', icon: FileText, href: '/student/assignments', gradient: 'from-blue-500 to-cyan-500' },
        { id: 'question-bank', label: 'Question Bank', icon: BookOpen, href: '/student/question-bank', gradient: 'from-purple-500 to-violet-500' },
        { id: 'chat', label: 'Student Chat', icon: MessageSquare, href: '/student/chat', gradient: 'from-blue-400 to-indigo-400' },
        { id: 'lesson-plan', label: 'Lesson Plan', icon: Calendar, href: '/student/lesson-plan', gradient: 'from-orange-500 to-amber-500' },
        { id: 'fees', label: 'Fees Payment Records', icon: DollarSign, href: '/student/fees', gradient: 'from-pink-500 to-rose-500' },
    ];

    const isFreeBatchOnlyFallback = !!(data.student.courses.length > 0 && data.student.courses.every(c => c.trim().toLowerCase() === 'class xi (free batch) 2026-27'));
    const finalIsFreeBatchOnly = isFreeBatchOnly || isFreeBatchOnlyFallback;

    const navItems = userRole === 'guardian'
        ? allNavItems.filter(item => ['dashboard', 'fees', 'lesson-plan'].includes(item.id))
        : finalIsFreeBatchOnly
            ? allNavItems.filter(item => !['chat', 'fees'].includes(item.id))
            : allNavItems;

    return (
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 relative overflow-hidden selection:bg-blue-500/30">
            <Toaster position="top-center" />

            {/* Background Accents (matching premium feel) */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/5 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/5 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 h-full w-64 bg-[#0a0f1a]/95 backdrop-blur-xl border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="flex flex-col h-full font-sans">
                    <div className="p-4 sm:p-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                                {data.student.name?.[0] || 'S'}
                            </div>
                            <div>
                                <h1 className="text-[13px] font-bold text-white">Student<span className="text-blue-400">Portal</span></h1>
                                <p className="text-[9px] text-slate-500 font-medium">RB Maths Academy</p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    router.push(item.href);
                                    setSidebarOpen(false);
                                }}
                                className={`w-full group relative overflow-hidden rounded-xl p-3.5 transition-all duration-300 border border-transparent hover:border-white/10 active:scale-[0.98] text-left ${item.id === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'hover:bg-white/5 text-slate-400'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-gradient-to-br transition-colors ${item.id === 'dashboard' ? 'bg-white/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                                        <item.icon className="h-4 w-4 text-white" />
                                    </div>
                                    <span className={`text-[13px] font-semibold transition-colors ${item.id === 'dashboard' ? 'text-white' : 'group-hover:text-white'}`}>
                                        {item.label}
                                    </span>
                                    {item.id === 'chat' && unreadChatCount > 0 && (
                                        <div className="ml-auto bg-red-500 text-white text-[9px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 animate-pulse">
                                            {unreadChatCount}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-white/10">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-all text-red-400 text-sm font-bold"
                        >
                            <LogOut className="h-4 w-4" /> Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="lg:ml-64 min-h-screen relative z-10 flex flex-col font-sans">
                {/* Top Header (Mobile) */}
                <header className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/5 bg-[#050b14]/70 px-4 py-3 lg:hidden flex items-center justify-between">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                        <Menu className="h-5 w-5" />
                    </button>
                    <h1 className="text-sm font-bold text-white">Dashboard</h1>
                    <div className="w-9 h-9"></div>
                </header>

                <div className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto p-4 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">

                    {/* Header Card (Matching Admin Analytics Detail Header) */}
                    <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-blue-500/30">
                                {data.student.name?.[0]}
                            </div>
                            <div className="text-center sm:text-left">
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{data.student.name}</h1>
                                    {userRole === 'guardian' && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                            Guardian View
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-medium text-slate-400 mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                    <span>{data.student.phoneNumber}</span>
                                    <span className="hidden sm:inline text-slate-700">•</span>
                                    <span>Joined: {new Date(data.student.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
                                </p>
                                <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
                                    {data.student.courses.map(course => (
                                        <span key={course} className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] uppercase font-bold tracking-wider">
                                            {course}
                                        </span>
                                    ))}
                                </div>
                                {studentProfile?.schoolName && studentProfile?.board && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] uppercase font-bold tracking-wider">
                                            🏫 {studentProfile.schoolName}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-wider">
                                            📋 {studentProfile.board}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Summary Grid (Matching Admin Overview) */}
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pb-4">
                        <div className="bg-[#1a1f2e] border border-white/5 p-4 sm:p-5 rounded-2xl group hover:border-blue-500/30 transition-all duration-300">
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest">Test Average</p>
                                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <TrendingUp className="h-3.5 w-3.5 sm:h-4 w-4" />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                                <p className="text-xl sm:text-3xl font-black text-blue-400">{data.stats.avgTestPercentage}%</p>
                                <p className="text-[9px] sm:text-xs text-slate-500 font-medium tracking-tight">Overall</p>
                            </div>
                        </div>

                        <div className="bg-[#1a1f2e] border border-white/5 p-4 sm:p-5 rounded-2xl group hover:border-emerald-500/30 transition-all duration-300">
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest">Tests Attempted</p>
                                <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                    <Award className="h-3.5 w-3.5 sm:h-4 w-4" />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                                <p className="text-xl sm:text-3xl font-black text-emerald-400">{data.stats.testsAttempted}</p>
                                <p className="text-[9px] sm:text-xs text-slate-500 font-medium tracking-tight">Appearances</p>
                            </div>
                        </div>

                        <div className="bg-[#1a1f2e] border border-white/5 p-4 sm:p-5 rounded-2xl group hover:border-rose-500/30 transition-all duration-300">
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest">Tests Missed</p>
                                <div className="p-1.5 sm:p-2 rounded-lg bg-rose-500/10 text-rose-400">
                                    <XCircle className="h-3.5 w-3.5 sm:h-4 w-4" />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                                <p className="text-xl sm:text-3xl font-black text-rose-400">{data.stats.testsMissed}</p>
                                <p className="text-[9px] sm:text-xs text-slate-500 font-medium tracking-tight">Missed</p>
                            </div>
                        </div>

                        {!finalIsFreeBatchOnly && (
                        <div className="bg-[#1a1f2e] border border-white/5 p-4 sm:p-5 rounded-2xl group hover:border-blue-400/30 transition-all duration-300 cursor-pointer relative overflow-hidden" onClick={() => router.push('/student/chat')}>
                            {unreadChatCount > 0 && (
                                <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg shadow-lg animate-pulse">
                                    {unreadChatCount} NEW
                                </div>
                            )}
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest">Doubts / Chat</p>
                                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-400/10 text-blue-400">
                                    <MessageSquare className="h-3.5 w-3.5 sm:h-4 w-4" />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                                <p className="text-xl sm:text-2xl font-black text-blue-400">Chat Now</p>
                                <p className="text-[9px] sm:text-xs text-slate-500 font-medium tracking-tight">Ask Doubt</p>
                            </div>
                        </div>
                        )}

                        <div className="bg-[#1a1f2e] border border-white/5 p-4 sm:p-5 rounded-2xl group hover:border-purple-500/30 transition-all duration-300">
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest">Assignments Sub</p>
                                <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                    <FileText className="h-3.5 w-3.5 sm:h-4 w-4" />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                                <p className="text-xl sm:text-3xl font-black text-purple-400">{data.stats.assignmentsSubmitted}</p>
                                <p className="text-[9px] sm:text-xs text-slate-500 font-medium tracking-tight">Solved</p>
                            </div>
                        </div>
                    </div>

                    {/* Offline Test Marks Section - Above Test Progress Report */}
                    {data.offlineExams && data.offlineExams.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-lg font-black text-white mb-6 tracking-wide flex items-center gap-3 uppercase">
                                <div className="bg-red-500 text-white px-4 py-1.5 rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-red-500/30 animate-pulse">
                                    Offline Test Marks
                                </div>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {data.offlineExams.map((exam) => (
                                    <div key={exam.examId} className="bg-[#1a1f2e] border border-red-500/20 rounded-2xl overflow-hidden shadow-xl hover:translate-y-[-2px] transition-all duration-300 hover:border-red-500/40">
                                        {/* Header */}
                                        <div className="bg-gradient-to-r from-red-500/15 to-orange-500/10 px-4 sm:px-5 py-2.5 sm:py-3 flex justify-between items-center border-b border-red-500/20">
                                            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-200 min-w-0 flex-1 mr-2">
                                                <BookOpen className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                                <span className="font-bold tracking-tight line-clamp-1">{exam.chapterName}</span>
                                            </div>
                                            <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 tracking-wider font-mono shrink-0">
                                                {new Date(exam.testDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' })}
                                            </span>
                                        </div>

                                        {/* Body */}
                                        <div className="p-3 sm:p-5">
                                            {/* Student Score & Percentage */}
                                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`text-2xl sm:text-3xl font-black ${typeof exam.percentage === 'string' ? "text-blue-400 text-xl" : exam.percentage >= 75 ? 'text-emerald-400' : typeof exam.percentage === 'number' && exam.percentage >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                        {exam.percentage}{typeof exam.percentage === 'number' || (typeof exam.percentage === 'string' && !isNaN(Number(exam.percentage))) ? '%' : ''}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        <span className="text-white font-bold">{exam.marksObtained}</span>
                                                        {typeof exam.marksObtained === 'number' || !isNaN(Number(exam.marksObtained)) ? `/${exam.fullMarks}` : ''}
                                                    </div>
                                                </div>
                                                {(typeof exam.marksObtained === 'number' || !isNaN(Number(exam.marksObtained))) && (
                                                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                                                        <Medal className="w-4 h-4 text-amber-400" />
                                                        <span className="text-sm font-black text-amber-400">#{exam.rank}</span>
                                                        <span className="text-[9px] text-slate-500 font-bold">/{exam.totalStudents}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Stats Row */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex flex-col items-center bg-purple-500/5 border border-purple-500/10 rounded-xl py-2">
                                                    <span className="text-[8px] uppercase font-black text-slate-500 tracking-widest mb-1">Highest</span>
                                                    <span className="text-lg font-black text-purple-400">{exam.highestPercentage}%</span>
                                                </div>
                                                <div className="flex flex-col items-center bg-blue-500/5 border border-blue-500/10 rounded-xl py-2">
                                                    <span className="text-[8px] uppercase font-black text-slate-500 tracking-widest mb-1">Batch Avg</span>
                                                    <span className="text-lg font-black text-blue-400">{exam.averagePercentage}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Progress Reports (Chronological List - exact copy from Admin Analytics Modal) */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-black text-white mb-6 tracking-wide flex items-center gap-3 uppercase">
                                <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
                                <BarChart2 className="w-5 h-5 text-blue-400" />
                                Test Progress Report
                            </h3>

                            <div className="space-y-4">
                                {data.tests.filter(t => t.status !== 'not_enrolled').map((test) => (
                                    <div key={test.testId} className="bg-[#1a1f2e] border border-white/5 rounded-2xl overflow-hidden shadow-xl hover:translate-y-[-2px] transition-all duration-300">
                                        <div className="bg-white/5 px-4 sm:px-5 py-2.5 sm:py-3.5 flex justify-between items-center border-b border-white/5">
                                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-200 min-w-0 flex-1 mr-2">
                                                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                <span className="font-bold tracking-tight line-clamp-1">{test.title}</span>
                                            </div>
                                            {test.status === 'missed' ? (
                                                <span className="bg-rose-500/20 text-rose-400 text-[8px] sm:text-[9px] uppercase font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-rose-500/30 whitespace-nowrap tracking-wider shrink-0">Missed</span>
                                            ) : (
                                                <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 tracking-wider font-mono shrink-0">{new Date(test.deploymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
                                            )}
                                        </div>

                                        <div className="p-3 sm:p-6 grid grid-cols-3 gap-2 sm:gap-6 text-center bg-gradient-to-br from-transparent to-white/[0.02]">
                                            <div className="flex flex-col justify-center items-center">
                                                <span className="text-slate-500 text-[8px] sm:text-[9px] uppercase font-black tracking-widest mb-1 sm:mb-2 flex items-center gap-1 sm:gap-1.5 justify-center">
                                                    <Target className="w-2.5 h-2.5 sm:w-3 h-3 text-emerald-400" /> <span className="hidden sm:inline">Student</span> Score
                                                </span>
                                                <div className="flex items-baseline gap-0.5 sm:gap-1">
                                                    <span className={`text-xl sm:text-3xl font-black ${test.score === null ? 'text-slate-700' :
                                                        (test.percentage || 0) >= 75 ? 'text-emerald-400' :
                                                            (test.percentage || 0) >= 40 ? 'text-amber-400' : 'text-rose-400'
                                                        }`}>
                                                        {test.score !== null ? test.score : '-'}
                                                    </span>
                                                    {test.score !== null && (
                                                        <span className="text-[8px] sm:text-[10px] font-bold text-slate-600">/{test.totalMarks}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col justify-center items-center border-x border-white/5 px-1">
                                                <span className="text-slate-500 text-[8px] sm:text-[9px] uppercase font-black tracking-widest mb-1 sm:mb-2 flex items-center gap-1 sm:gap-1.5 justify-center">
                                                    <Trophy className="w-2.5 h-2.5 sm:w-3 h-3 text-purple-400" /> Highest
                                                </span>
                                                <p className="text-lg sm:text-2xl font-black text-purple-400">{test.highestScore}</p>
                                                <span className="text-[8px] sm:text-[10px] font-bold text-slate-600 tracking-tight mt-0.5">Topper</span>
                                            </div>

                                            <div className="flex flex-col justify-center items-center">
                                                <span className="text-slate-500 text-[8px] sm:text-[9px] uppercase font-black tracking-widest mb-1 sm:mb-2 flex items-center gap-1 sm:gap-1.5 justify-center">
                                                    <Users className="w-2.5 h-2.5 sm:w-3 h-3 text-blue-400" /> Average
                                                </span>
                                                <p className="text-lg sm:text-2xl font-black text-blue-400">{test.averageScore}</p>
                                                <span className="text-[8px] sm:text-[10px] font-bold text-slate-600 tracking-tight mt-0.5">Avg</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {data.tests.length === 0 && (
                                    <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-12 text-center">
                                        <BarChart2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">No test records discovered</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-black text-white mb-6 tracking-wide flex items-center gap-3 uppercase">
                                <div className="h-8 w-1 bg-purple-500 rounded-full"></div>
                                <FileText className="w-5 h-5 text-purple-400" />
                                Assignment Log
                            </h3>

                            <div className="space-y-2 sm:space-y-3">
                                {data.assignments.filter(a => a.status !== 'NOT_ENROLLED').map((assign) => (
                                    <div key={assign.assignmentId} className="bg-[#1a1f2e] border border-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-5 flex justify-between items-center group hover:bg-[#252a3b] transition-all duration-300">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <p className="text-xs sm:text-[13px] font-bold text-slate-200 group-hover:text-blue-400 transition-colors uppercase tracking-tight truncate">{assign.title}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold tracking-tight">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(assign.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            {['SUBMITTED', 'LATE_SUBMITTED', 'CORRECTED'].includes(assign.status) ? (
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                            {assign.status === 'LATE_SUBMITTED' ? 'Late' : 'Done'}
                                                        </span>
                                                    </div>
                                                    {assign.status === 'CORRECTED' && assign.quality && (
                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                                                            assign.quality === 'GOOD' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                                            assign.quality === 'SATISFACTORY' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                                                            'bg-red-500/10 text-red-500 border-red-500/30'
                                                        }`}>
                                                            {assign.quality}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : assign.status === 'MISSED' ? (
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black uppercase tracking-widest text-[10px]">
                                                    <XCircle className="w-3.5 h-3.5" /> Missed
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black uppercase tracking-widest text-[10px]">
                                                    <Clock className="w-3.5 h-3.5" /> Pending
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {data.assignments.length === 0 && (
                                    <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-12 text-center">
                                        <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">No assignments found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 text-center">
                        <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">Designed & Developed by Dr. Ritwick Banerjee</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
