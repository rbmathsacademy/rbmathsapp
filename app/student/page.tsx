'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import {
    LogOut,
    BookOpen,
    FileText,
    Calendar,
    DollarSign,
    ClipboardCheck,
    Menu,
    X,
    TrendingUp,
    CheckCircle,
    Clock,
    BarChart3,
    Award
} from 'lucide-react';

export default function StudentDashboard() {
    const router = useRouter();
    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Dashboard data states
    const [testData, setTestData] = useState<any>(null);
    const [assignmentData, setAssignmentData] = useState<any>(null);
    const [attendanceData, setAttendanceData] = useState<any>(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string>('');

    useEffect(() => {
        fetchProfile();
        fetchDashboardData();

        // Auto-refresh data every 60 seconds
        const interval = setInterval(() => {
            fetchDashboardData();
        }, 60000);

        return () => clearInterval(interval);
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

    const fetchDashboardData = async (batch?: string) => {
        setDataLoading(true);
        try {
            // Fetch test data (with optional batch filter)
            const batchParam = batch || selectedBatch;
            const url = batchParam ? `/api/student/analytics?batch=${encodeURIComponent(batchParam)}` : '/api/student/analytics';
            const testRes = await fetch(url);
            if (testRes.ok) {
                const data = await testRes.json();
                setTestData(data);
                // Set batches/selectedBatch on first load, then re-fetch for first batch
                if (data.batches && data.batches.length > 0 && batches.length === 0) {
                    setBatches(data.batches);
                    const firstBatch = data.batches[0];
                    setSelectedBatch(firstBatch);
                    // Re-fetch scoped to the first batch
                    if (!batch && data.batches.length > 1) {
                        const batchRes = await fetch(`/api/student/analytics?batch=${encodeURIComponent(firstBatch)}`);
                        if (batchRes.ok) {
                            const batchData = await batchRes.json();
                            setTestData(batchData);
                        }
                    }
                }
            }

            // Fetch assignment data
            const assignmentRes = await fetch('/api/student/assignments');
            if (assignmentRes.ok) {
                const assignments = await assignmentRes.json();
                const pending = assignments.filter((a: any) => !a.completed).length;
                const completed = assignments.filter((a: any) => a.completed).length;
                setAssignmentData({ pending, completed, total: assignments.length });
            }

            // Fetch attendance data (placeholder - will need actual endpoint)
            // const attendanceRes = await fetch('/api/student/attendance');
            // if (attendanceRes.ok) setAttendanceData(await attendanceRes.json());

            // Note: Attendance data is still mocked as requested only test analytics to be real for now.
            setAttendanceData({
                percentage: 92,
                present: 46,
                total: 50,
                thisWeek: 5
            });
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setDataLoading(false);
        }
    };

    const handleLogout = () => {
        document.cookie = 'auth_token=; Max-Age=0; path=/;';
        router.push('/student/login');
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Menu, href: '/student', gradient: 'from-blue-600 to-indigo-600' },
        { id: 'online-test', label: 'Online Test', icon: ClipboardCheck, href: '/student/online-test', gradient: 'from-emerald-500 to-teal-500' },
        { id: 'assignments', label: 'Assignment Submission', icon: FileText, href: '/student/assignments', gradient: 'from-blue-500 to-cyan-500' },
        { id: 'question-bank', label: 'Question Bank', icon: BookOpen, href: '/student/question-bank', gradient: 'from-purple-500 to-violet-500' },
        { id: 'lesson-plan', label: 'Lesson Plan', icon: Calendar, href: '/student/lesson-plan', gradient: 'from-orange-500 to-amber-500' },
        { id: 'fees', label: 'Fees Payment Records', icon: DollarSign, href: '/student/fees', gradient: 'from-pink-500 to-rose-500' },
    ];

    // ... (skipping unchanged code)

    // ... (skipping unchanged code)


    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse"></div>
                <div className="text-blue-400 animate-pulse text-xl font-medium relative z-10">Loading your portal...</div>
            </div>
        );
    }

    if (!student) return null;

    return (
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 relative overflow-hidden selection:bg-blue-500/30">
            <Toaster position="top-center" />

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 h-full w-64 bg-[#0a0f1a]/95 backdrop-blur-xl border-r border-white/10 z-50
                transform transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
            `}>
                <div className="flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                                    {student.studentName?.[0] || 'S'}
                                </div>
                                <div>
                                    <h2 className="text-[13px] font-bold text-white">Student<span className="text-blue-400">Portal</span></h2>
                                    <p className="text-[9px] text-slate-500">{student.studentName?.split(' ')[0]}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    router.push(item.href);
                                    setSidebarOpen(false);
                                }}
                                className="w-full group relative overflow-hidden rounded-xl p-3.5 transition-all duration-300 hover:bg-white/5 border border-transparent hover:border-white/10 active:scale-[0.98] touch-manipulation text-left"
                            >
                                <div className="flex items-center gap-3 text-left">
                                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${item.gradient} shadow-lg shrink-0`}>
                                        <item.icon className="h-4 w-4 text-white" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">
                                        {item.label}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="p-4 border-t border-white/10">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-all text-red-400"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="text-sm font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="lg:ml-64 min-h-screen relative z-10">
                {/* Top Header (Mobile) */}
                <header className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/5 bg-[#050b14]/70 px-4 py-3 lg:hidden">
                    <div className="flex items-center justify-between relative">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors relative z-10"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <h1 className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white pointer-events-none">Dashboard</h1>
                        <div className="w-9 h-9 relative z-10"></div> {/* Placeholder to keep balance */}
                    </div>
                </header>

                {/* Dashboard Content */}
                <div className="p-4 lg:p-8">
                    {/* Greeting Section */}
                    <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
                        <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mb-1">{getGreeting()}</p>
                        <h2 className="text-lg sm:text-2xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400">
                            {student?.studentName || 'Student'}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Welcome to your learning dashboard</p>
                    </div>

                    {/* Batch Tabs */}
                    {batches.length > 0 && (
                        <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-700" style={{ animationDelay: '200ms' }}>
                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 flex-nowrap snap-x">
                                {batches.map((batch) => (
                                    <button
                                        key={batch}
                                        onClick={() => {
                                            setSelectedBatch(batch);
                                            fetchDashboardData(batch);
                                        }}
                                        className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border snap-center ${selectedBatch === batch
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500/50 shadow-lg shadow-blue-500/20 active:scale-95'
                                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
                                            }`}
                                    >
                                        {batch}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dashboard Widgets Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                        {/* Test Marks & Performance Widget */}
                        <div className="bg-gradient-to-br from-purple-900/40 via-violet-900/20 to-indigo-900/10 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-30">
                                <Award className="h-12 w-12 text-purple-500/10 rotate-12" />
                            </div>

                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/20">
                                        <Award className="h-4 w-4 text-white" />
                                    </div>
                                    <h3 className="text-sm font-bold text-white">Test Performance</h3>
                                </div>
                                {dataLoading ? (
                                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${testData?.trend === 'up' ? 'text-emerald-400' : testData?.trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
                                        <TrendingUp className="h-2.5 w-2.5" />
                                        <span className="text-[10px] font-bold">{testData?.trend === 'up' ? 'Improving' : testData?.trend === 'down' ? 'Declining' : 'Stable'}</span>
                                    </div>
                                )}
                            </div>

                            {dataLoading ? (
                                <div className="space-y-4">
                                    <div className="h-12 bg-white/5 rounded-xl animate-pulse"></div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="h-10 bg-white/5 rounded-lg animate-pulse"></div>
                                        <div className="h-10 bg-white/5 rounded-lg animate-pulse"></div>
                                        <div className="h-10 bg-white/5 rounded-lg animate-pulse"></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4 bg-white/5 p-3 rounded-xl border border-white/5">
                                        <div className="text-left">
                                            <div className="text-[10px] text-purple-300 font-bold tracking-wider uppercase mb-0.5">Avg Score</div>
                                            <div className="text-xl font-black text-white drop-shadow-glow">
                                                {testData?.averageScore || 0}%
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-0.5">Latest Score</div>
                                            <div className={`text-xl font-black ${(testData?.recentScore || 0) >= 80 ? 'text-emerald-400' :
                                                (testData?.recentScore || 0) >= 60 ? 'text-amber-400' :
                                                    'text-red-400'
                                                }`}>{testData?.recentScore || 0}%</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white/5 rounded-lg py-2 text-center border border-white/5">
                                            <div className="text-sm font-bold text-white">{testData?.totalTests || 0}</div>
                                            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Attempted</div>
                                        </div>
                                        <div className="bg-white/5 rounded-lg py-2 text-center border border-white/5">
                                            <div className="text-sm font-bold text-red-400">{testData?.missed || 0}</div>
                                            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Missed</div>
                                        </div>
                                        <div className="bg-white/5 rounded-lg py-2 text-center border border-white/5">
                                            <div className="text-sm font-bold text-amber-400">{testData?.pending || 0}</div>
                                            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Pending</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Assignment Submission Record Widget */}
                        <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/10 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-4 sm:p-5 relative">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg">
                                        <FileText className="h-4 w-4 text-white" />
                                    </div>
                                    <h3 className="text-sm font-bold text-white">Assignment Status</h3>
                                </div>
                                {dataLoading && (
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                )}
                            </div>

                            {dataLoading ? (
                                <div className="space-y-2">
                                    <div className="h-10 bg-white/5 rounded animate-pulse"></div>
                                    <div className="h-4 bg-white/5 rounded animate-pulse w-2/3"></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl border border-white/5">
                                        <div className="text-center">
                                            <div className="text-2xl font-black text-white">{assignmentData?.pending || 0}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending</div>
                                        </div>
                                        <div className="h-8 w-px bg-white/10"></div>
                                        <div className="text-center">
                                            <div className="text-2xl font-black text-green-400">{assignmentData?.completed || 0}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Completed</div>
                                        </div>
                                        <div className="h-8 w-px bg-white/10"></div>
                                        <div className="text-center">
                                            <div className="text-2xl font-black text-blue-400">{assignmentData?.total || 0}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>


                <div className="mt-12 text-center text-xs text-slate-600">
                    <p>Designed and Developed by Dr. Ritwick Banerjee</p>
                </div>
            </main >
        </div >
    );
}
