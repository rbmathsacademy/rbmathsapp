'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
    Medal,
    ChevronRight,
    ListChecks
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { useStudentProfile } from './StudentProfileContext';
import BatchTabSwitcher from '../components/BatchTabSwitcher';
import { readCache, writeCache, clearStudentCache } from '@/lib/studentCache';

const FREE_BATCH = 'Class XI (Free batch) 2026-27';
const FREE_BATCH_LOWER = FREE_BATCH.trim().toLowerCase();

// Visual styles (sd-* classes) live in app/portal-theme.css, shared by the student and admin portals.

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
    schoolExams?: any[];
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
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
    const [batchesReady, setBatchesReady] = useState(false);

    const fetchUnreadStatus = async () => {
        try {
            const res = await fetch('/api/chat/student-status');
            const data = await res.json();
            if (res.ok) {
                setUnreadChatCount(data.unreadCount || 0);
                writeCache('chat-unread', data.unreadCount || 0);
            }
        } catch (e) {}
    };

    // Paint the last-seen dashboard before the first frame (fresh data replaces it right after)
    useLayoutEffect(() => {
        const cached = readCache<DashboardData>('dash:');
        if (cached) {
            setData(cached.data);
            setLoading(false);
        }
        const cachedChat = readCache<number>('chat-unread');
        if (cachedChat) setUnreadChatCount(cachedChat.data);
    }, []);

    // Warm up the other portal pages' code so switching to them is instant
    useEffect(() => {
        ['/student/online-test', '/student/assignments', '/student/question-bank', '/student/chat', '/student/lesson-plan', '/student/fees', '/student/performance-overview']
            .forEach(href => { try { router.prefetch(href); } catch { } });
    }, [router]);

    useEffect(() => {
        fetchData(); // also brings the unread chat count
        // Unread badge: every 2 minutes, but only while the student is actually using the page
        // (visible and touched in the last 10 minutes). Coming back after a break checks at once.
        const IDLE_MS = 10 * 60 * 1000;
        let lastActive = Date.now();
        let lastCheck = Date.now();
        const check = () => { lastCheck = Date.now(); fetchUnreadStatus(); };
        const onActivity = () => {
            const wasIdle = Date.now() - lastActive > IDLE_MS;
            lastActive = Date.now();
            if (wasIdle && document.visibilityState === 'visible' && Date.now() - lastCheck > 120000) check();
        };
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            lastActive = Date.now();
            if (Date.now() - lastCheck > 120000) check();
        };
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible' && Date.now() - lastActive < IDLE_MS) check();
        }, 120000);
        const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
        events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            events.forEach(e => window.removeEventListener(e, onActivity));
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    // Once data loads, set default selected batch (first non-free batch)
    useEffect(() => {
        if (data && !batchesReady) {
            const nonFreeBatches = (data.student.courses || []).filter(c => c.trim().toLowerCase() !== FREE_BATCH_LOWER);
            if (nonFreeBatches.length > 1) {
                setSelectedBatch(nonFreeBatches[0]);
            }
            setBatchesReady(true);
        }
    }, [data, batchesReady]);

    // Re-fetch when selectedBatch changes (after initial load)
    useEffect(() => {
        if (batchesReady && selectedBatch) {
            fetchData(selectedBatch);
        }
    }, [selectedBatch]);

    // Only the most recent request may update the screen (avoids an older response overwriting a newer batch)
    const fetchSeq = useRef(0);

    const fetchData = async (batch?: string) => {
        const seq = ++fetchSeq.current;
        const cacheKey = `dash:${batch || ''}`;
        if (batch) {
            const cached = readCache<DashboardData>(cacheKey);
            if (cached) setData(cached.data);
        }
        try {
            const url = batch
                ? `/api/student/dashboard-analytics?batch=${encodeURIComponent(batch)}`
                : '/api/student/dashboard-analytics';
            const res = await fetch(url);
            if (res.ok) {
                const result = await res.json();
                writeCache(cacheKey, result);
                if (typeof result.unreadChat === 'number') { setUnreadChatCount(result.unreadChat); writeCache('chat-unread', result.unreadChat); }
                if (seq === fetchSeq.current) setData(result);
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
        clearStudentCache();
        localStorage.clear();
        window.location.replace('/student/login');
    };

    const formatScore = (val: any) => (val !== null && val !== undefined && !isNaN(val)) ? Number(Number(val).toFixed(2)) : val;

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
            <div className="min-h-screen sd-bg flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 sd-grid pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="relative h-14 w-28 sd-float">
                        <Image src="/rb-logo.png" alt="" fill className="object-contain" priority />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-fuchsia-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <div className="text-sm font-semibold tracking-wide font-sans text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-violet-200 to-cyan-300">Loading your portal...</div>
                </div>
            </div>
        );
    }

    if (!data) return null;

            const allNavItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Menu, href: '/student', gradient: 'from-fuchsia-500 to-violet-600' },
        ...(data.schoolExams && data.schoolExams.length > 0 ? [{ id: 'performance', label: 'Performance Overview', icon: TrendingUp, href: '/student/performance-overview', gradient: 'from-amber-400 to-orange-500' }] : []),
        { id: 'online-test', label: 'Online Test', icon: ClipboardCheck, href: '/student/online-test', gradient: 'from-lime-400 to-emerald-500' },
        { id: 'assignments', label: 'Assignment Submission', icon: FileText, href: '/student/assignments', gradient: 'from-sky-400 to-blue-600' },
        { id: 'question-bank', label: 'Question Bank', icon: BookOpen, href: '/student/question-bank', gradient: 'from-violet-400 to-purple-600' },
        { id: 'chat', label: 'Student Chat', icon: MessageSquare, href: '/student/chat', gradient: 'from-cyan-400 to-teal-500' },
        { id: 'lesson-plan', label: 'Lesson Plan', icon: Calendar, href: '/student/lesson-plan', gradient: 'from-orange-400 to-rose-500' },
        { id: 'fees', label: 'Fees Payment Records', icon: DollarSign, href: '/student/fees', gradient: 'from-pink-400 to-rose-600' },
    ];

    const isFreeBatchOnlyFallback = !!(data.student.courses.length > 0 && data.student.courses.every(c => c.trim().toLowerCase() === 'class xi (free batch) 2026-27'));
    const finalIsFreeBatchOnly = isFreeBatchOnly || isFreeBatchOnlyFallback;

    const navItems = userRole === 'guardian'
        ? allNavItems.filter(item => ['dashboard', 'fees', 'lesson-plan'].includes(item.id))
        : finalIsFreeBatchOnly
            ? allNavItems.filter(item => !['chat', 'fees'].includes(item.id))
            : allNavItems;

    // Purely decorative: an emoji "vibe" for the overall test average
    const avgPct = Number(data.stats.avgTestPercentage) || 0;
    const vibe = avgPct >= 75 ? '🔥' : avgPct >= 40 ? '⚡' : '💪';
    const ringOffset = 226.2 * (1 - Math.min(Math.max(avgPct, 0), 100) / 100);

    return (
        <div className="min-h-screen sd-bg font-sans text-slate-200 relative overflow-x-hidden selection:bg-fuchsia-500/30">
            <Toaster position="top-center" />

            {/* Static neon backdrop: coloured light pools + a fading grid. Nothing here animates. */}
            <div className="fixed inset-0 pointer-events-none z-0 sd-bg" style={{ transform: 'translateZ(0)' }}>
                <div className="absolute inset-0 sd-grid" />
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/70 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 h-full w-64 bg-[#0c0919] border-r border-fuchsia-500/15 shadow-[8px_0_40px_-12px_rgba(168,85,247,0.35)] z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(80%_35%_at_0%_0%,rgba(217,70,239,0.16),transparent_70%),radial-gradient(80%_30%_at_100%_100%,rgba(34,211,238,0.10),transparent_70%)]" />
                <div className="relative flex flex-col h-full font-sans">
                    <div className="p-4 sm:p-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="relative h-10 shrink-0 rounded-lg ring-1 ring-fuchsia-400/30 shadow-lg shadow-fuchsia-500/25 bg-[#120d22] px-1.5 flex items-center">
                                <Image src="/rb-logo.png" alt="RB Maths Academy" width={720} height={350} className="h-8 w-auto object-contain" priority />
                            </div>
                            <div>
                                <h1 className="text-[13px] font-black text-white tracking-tight">Student<span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-300">Portal</span></h1>
                                <p className="text-[9px] text-violet-300/60 font-bold uppercase tracking-wider">RB Maths Academy</p>
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
                                className={`w-full group relative overflow-hidden rounded-xl p-3.5 transition-all duration-300 border active:scale-[0.98] text-left ${item.id === 'dashboard' ? 'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-fuchsia-500/30 border-white/15' : 'border-transparent hover:border-white/10 hover:bg-white/5 text-slate-300'}`}
                            >
                                {item.id === 'dashboard' && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-white/80" />
                                )}
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient} transition-transform duration-300 shadow-md ${item.id === 'dashboard' ? 'ring-1 ring-white/30' : 'group-hover:scale-110 group-active:scale-95'}`}>
                                        <item.icon className="h-4 w-4 text-white drop-shadow-sm" />
                                    </div>
                                    <span className={`text-[13px] font-bold transition-colors ${item.id === 'dashboard' ? 'text-white' : 'group-hover:text-white'}`}>
                                        {item.label}
                                    </span>
                                    {item.id === 'chat' && unreadChatCount > 0 && (
                                        <div className="ml-auto bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[9px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/40 animate-pulse">
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
                            className="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-500/50 transition-all text-rose-300 text-sm font-bold active:scale-[0.98]"
                        >
                            <LogOut className="h-4 w-4" /> Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="lg:ml-64 min-h-screen relative z-10 flex flex-col font-sans">
                {/* Top Header (Mobile) */}
                <header className="sticky top-0 z-30 bg-[#0b0818]/95 px-4 py-3 lg:hidden flex items-center justify-between">
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-400/60 to-cyan-400/0" />
                    <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 ring-1 ring-fuchsia-400/30 text-fuchsia-100 active:scale-95 transition-transform">
                        <Menu className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="relative h-6 shrink-0">
                            <Image src="/rb-logo.png" alt="" width={720} height={350} className="h-6 w-auto object-contain" />
                        </div>
                        <h1 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-white to-cyan-300 tracking-tight">Dashboard</h1>
                    </div>
                    <div className="w-9 h-9"></div>
                </header>

                <div className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto p-4 lg:p-8 space-y-8">

                    {/* Header Card */}
                    <div className="sd-gborder sd-rise bg-[#120c24]/90 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 relative z-10 shadow-[0_18px_50px_-18px_rgba(217,70,239,0.45)] overflow-hidden">
                        {/* Neon washes, light sweep and sparkles (all absolutely positioned: no size change) */}
                        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(70%_80%_at_0%_0%,rgba(217,70,239,0.28),transparent_60%),radial-gradient(60%_80%_at_100%_100%,rgba(34,211,238,0.20),transparent_60%)]" />
                        <div className="sd-shine" />
                        <span className="sd-twinkle absolute top-4 right-6 text-[10px] text-amber-200 pointer-events-none">✦</span>
                        <span className="sd-twinkle absolute top-10 right-14 text-[8px] text-fuchsia-200 pointer-events-none" style={{ animationDelay: '0.9s' }}>✦</span>
                        <span className="sd-twinkle absolute bottom-5 left-6 text-[9px] text-cyan-200 pointer-events-none" style={{ animationDelay: '1.7s' }}>✦</span>
                        <span className="sd-twinkle absolute bottom-10 right-8 text-[7px] text-violet-200 pointer-events-none" style={{ animationDelay: '2.3s' }}>✦</span>

                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
                            {/* Avatar wrapped in a test-average progress ring */}
                            <div className="relative h-20 w-20 rounded-2xl shrink-0">
                                <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full -rotate-90">
                                    <defs>
                                        <linearGradient id="sdRingGrad" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor="#e879f9" />
                                            <stop offset="50%" stopColor="#fbbf24" />
                                            <stop offset="100%" stopColor="#22d3ee" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                                    <circle cx="40" cy="40" r="36" fill="none" stroke="url(#sdRingGrad)" strokeWidth="4" strokeLinecap="round"
                                        strokeDasharray="226.2" strokeDashoffset={ringOffset} className="sd-ring" />
                                </svg>
                                <div className="absolute inset-[8px] rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-[0_0_24px_rgba(217,70,239,0.55)]">
                                    {data.student.name?.[0]}
                                </div>
                                <span className="sd-float absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#120c24] ring-2 ring-fuchsia-400/60 flex items-center justify-center text-sm shadow-lg">
                                    {vibe}
                                </span>
                            </div>
                            <div className="text-center sm:text-left">
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                    <h1 className="sd-name text-2xl sm:text-3xl font-black tracking-tight">{data.student.name}</h1>
                                    {userRole === 'guardian' && (
                                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400/25 to-orange-500/25 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-widest">
                                            Guardian View
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-violet-200/60 mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                    <span>{data.student.phoneNumber}</span>
                                    <span className="hidden sm:inline text-fuchsia-400/50">•</span>
                                    <span>Joined: {new Date(data.student.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
                                </p>
                                <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
                                    {data.student.courses.map(course => (
                                        <span key={course} className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-fuchsia-500/20 to-violet-500/20 border border-fuchsia-400/30 text-fuchsia-200 text-[10px] uppercase font-bold tracking-wider">
                                            {course}
                                        </span>
                                    ))}
                                </div>
                                {studentProfile?.schoolName && studentProfile?.board && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                                        <span className="px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-200 text-[10px] uppercase font-bold tracking-wider">
                                            🏫 {studentProfile.schoolName}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-lg bg-cyan-400/15 border border-cyan-400/30 text-cyan-200 text-[10px] uppercase font-bold tracking-wider">
                                            📋 {studentProfile.board}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Batch Switcher */}
                    {data.student.courses.filter(c => c.trim().toLowerCase() !== FREE_BATCH_LOWER).length > 1 && (
                        <div className="relative z-10">
                            <BatchTabSwitcher
                                batches={data.student.courses}
                                selectedBatch={selectedBatch || data.student.courses.filter(c => c.trim().toLowerCase() !== FREE_BATCH_LOWER)[0]}
                                onSelect={(batch) => setSelectedBatch(batch)}
                            />
                        </div>
                    )}

                    {/* Stats Summary Grid — every tile is a tappable shortcut to its section */}
                    {(() => {
                        type StatCard = {
                            id: string;
                            label: string;
                            value: React.ReactNode;
                            sub: string;
                            icon: typeof TrendingUp;
                            accent: string;
                            onClick: () => void;
                            badge?: number;
                        };

                        const cards: StatCard[] = [
                            {
                                id: 'test-avg',
                                label: 'Test Average',
                                value: `${formatScore(data.stats.avgTestPercentage)}%`,
                                sub: `Overall ${vibe}`,
                                icon: TrendingUp,
                                accent: 'blue',
                                onClick: () => router.push('/student/online-test'),
                            },
                            {
                                id: 'tests-attempted',
                                label: 'Tests Attempted',
                                value: data.stats.testsAttempted,
                                sub: 'Appearances',
                                icon: Award,
                                accent: 'emerald',
                                onClick: () => router.push('/student/online-test'),
                            },
                            {
                                id: 'tests-missed',
                                label: 'Tests Missed',
                                value: data.stats.testsMissed,
                                sub: 'Catch up 👀',
                                icon: XCircle,
                                accent: 'rose',
                                onClick: () => router.push('/student/online-test'),
                            },
                            {
                                id: 'assignments-submitted',
                                label: 'Assignments Sub',
                                value: data.stats.assignmentsSubmitted,
                                sub: 'Solved ✅',
                                icon: ListChecks,
                                accent: 'purple',
                                onClick: () => router.push('/student/assignments'),
                            },
                            {
                                id: 'assignments-missed',
                                label: 'Assignments Missed',
                                value: data.stats.assignmentsMissed,
                                sub: 'Catch up 👀',
                                icon: FileText,
                                accent: 'amber',
                                onClick: () => router.push('/student/assignments'),
                            },
                            ...(!finalIsFreeBatchOnly ? [{
                                id: 'chat',
                                label: 'Doubts / Chat',
                                value: 'Chat Now',
                                sub: 'Ask a doubt 💬',
                                icon: MessageSquare,
                                accent: 'cyan',
                                onClick: () => router.push('/student/chat'),
                                badge: unreadChatCount,
                            } as StatCard] : []),
                        ];

                        // icon: solid gradient bubble · value: gradient text · tint: card wash · border: hairline gradient · glow: shadow
                        const accentMap: Record<string, { icon: string; value: string; tint: string; border: string; glow: string }> = {
                            blue: { icon: 'from-sky-400 to-blue-600', value: 'from-sky-300 to-blue-400', tint: 'rgba(56,189,248,0.20)', border: 'linear-gradient(135deg, rgba(56,189,248,0.75), rgba(56,189,248,0.05) 60%)', glow: 'shadow-[0_12px_30px_-14px_rgba(56,189,248,0.7)]' },
                            emerald: { icon: 'from-lime-300 to-emerald-500', value: 'from-lime-300 to-emerald-400', tint: 'rgba(132,204,22,0.18)', border: 'linear-gradient(135deg, rgba(163,230,53,0.75), rgba(163,230,53,0.05) 60%)', glow: 'shadow-[0_12px_30px_-14px_rgba(132,204,22,0.7)]' },
                            rose: { icon: 'from-rose-400 to-pink-600', value: 'from-rose-300 to-pink-400', tint: 'rgba(244,63,94,0.20)', border: 'linear-gradient(135deg, rgba(251,113,133,0.75), rgba(251,113,133,0.05) 60%)', glow: 'shadow-[0_12px_30px_-14px_rgba(244,63,94,0.7)]' },
                            purple: { icon: 'from-fuchsia-400 to-violet-600', value: 'from-fuchsia-300 to-violet-300', tint: 'rgba(217,70,239,0.20)', border: 'linear-gradient(135deg, rgba(232,121,249,0.75), rgba(232,121,249,0.05) 60%)', glow: 'shadow-[0_12px_30px_-14px_rgba(217,70,239,0.7)]' },
                            amber: { icon: 'from-amber-300 to-orange-500', value: 'from-amber-200 to-orange-400', tint: 'rgba(251,191,36,0.18)', border: 'linear-gradient(135deg, rgba(252,211,77,0.75), rgba(252,211,77,0.05) 60%)', glow: 'shadow-[0_12px_30px_-14px_rgba(251,146,60,0.7)]' },
                            cyan: { icon: 'from-cyan-300 to-teal-500', value: 'from-cyan-200 to-teal-300', tint: 'rgba(34,211,238,0.20)', border: 'linear-gradient(135deg, rgba(103,232,249,0.75), rgba(103,232,249,0.05) 60%)', glow: 'shadow-[0_12px_30px_-14px_rgba(34,211,238,0.7)]' },
                        };

                        const isOddCount = cards.length % 2 === 1;

                        return (
                            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pb-4 relative z-10">
                                {cards.map((card, idx) => {
                                    const a = accentMap[card.accent];
                                    const isLastOdd = isOddCount && idx === cards.length - 1;
                                    return (
                                        <button
                                            key={card.id}
                                            onClick={card.onClick}
                                            className={`sd-gborder sd-rise text-left bg-[#110b20]/90 p-4 sm:p-5 rounded-3xl group transition-transform duration-200 ${a.glow} active:scale-[0.96] relative overflow-hidden ${isLastOdd ? 'col-span-2' : ''}`}
                                            style={{
                                                animationDelay: `${80 + idx * 60}ms`,
                                                ['--sd-border' as any]: a.border,
                                                backgroundImage: `radial-gradient(90% 90% at 100% 0%, ${a.tint}, transparent 65%)`,
                                            }}
                                        >
                                            {!!card.badge && card.badge > 0 && (
                                                <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg shadow-lg animate-pulse">
                                                    {card.badge} NEW
                                                </div>
                                            )}

                                            <div className="flex justify-between items-start mb-2 sm:mb-3 relative z-10">
                                                <p className="text-[9px] sm:text-[10px] text-slate-300/80 font-black uppercase tracking-widest">{card.label}</p>
                                                <div className={`p-1.5 sm:p-2 rounded-xl bg-gradient-to-br ${a.icon} text-white shadow-md ring-1 ring-white/20 shrink-0 group-active:scale-90 transition-transform duration-200`}>
                                                    <card.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                </div>
                                            </div>
                                            <div className="flex items-end justify-between relative z-10">
                                                <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                                                    <p className={`text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r ${a.value}`}>{card.value}</p>
                                                    <p className="text-[9px] sm:text-xs text-slate-400 font-semibold tracking-tight">{card.sub}</p>
                                                </div>
                                                <ChevronRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all shrink-0" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* Offline Test Marks Section - Above Test Progress Report */}
                    {data.offlineExams && data.offlineExams.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-lg font-black text-white mb-6 tracking-wide flex items-center gap-3 uppercase">
                                <div className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 text-white px-4 py-1.5 rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-orange-500/30">
                                    Offline Test Marks 📝
                                </div>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {data.offlineExams.map((exam, idx) => (
                                    <div key={exam.examId} className="relative sd-gborder sd-rise sd-card bg-[#120b1c]/90 rounded-3xl overflow-hidden shadow-[0_14px_34px_-16px_rgba(249,115,22,0.55)]"
                                        style={{ animationDelay: `${120 + idx * 50}ms`, ['--sd-border' as any]: 'linear-gradient(135deg, rgba(251,113,133,0.7), rgba(251,146,60,0.15) 55%, rgba(252,211,77,0.5))' }}>
                                        {/* Header */}
                                        <div className="bg-gradient-to-r from-rose-500/20 via-orange-500/10 to-transparent px-4 sm:px-5 py-2.5 sm:py-3 flex justify-between items-center border-b border-orange-400/15">
                                            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-100 min-w-0 flex-1 mr-2">
                                                <BookOpen className="w-3.5 h-3.5 text-orange-300 shrink-0" />
                                                <span className="font-bold tracking-tight line-clamp-1">{exam.chapterName}</span>
                                            </div>
                                            <span className="text-[8px] sm:text-[10px] font-bold text-orange-200/60 tracking-wider font-mono shrink-0">
                                                {new Date(exam.testDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' })}
                                            </span>
                                        </div>

                                        {/* Body */}
                                        <div className="p-3 sm:p-5">
                                            {/* Student Score & Percentage */}
                                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`text-2xl sm:text-3xl font-black ${typeof exam.percentage === 'string' ? "text-sky-300 text-xl" : exam.percentage >= 75 ? 'text-lime-300' : typeof exam.percentage === 'number' && exam.percentage >= 40 ? 'text-amber-300' : 'text-rose-400'}`}>
                                                        {formatScore(exam.percentage)}{typeof exam.percentage === 'number' || (typeof exam.percentage === 'string' && !isNaN(Number(exam.percentage))) ? '%' : ''}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        <span className="text-white font-bold">{formatScore(exam.marksObtained)}</span>
                                                        {typeof exam.marksObtained === 'number' || !isNaN(Number(exam.marksObtained)) ? `/${exam.fullMarks}` : ''}
                                                    </div>
                                                </div>
                                                {(typeof exam.marksObtained === 'number' || !isNaN(Number(exam.marksObtained))) && (
                                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${exam.rank === 1 ? 'bg-gradient-to-r from-amber-300/30 to-yellow-500/20 border-amber-300/50 shadow-[0_0_18px_rgba(251,191,36,0.35)]' : 'bg-amber-400/10 border-amber-400/25'}`}>
                                                        <Medal className="w-4 h-4 text-amber-300" />
                                                        <span className="text-sm font-black text-amber-200">#{exam.rank}</span>
                                                        <span className="text-[9px] text-amber-100/50 font-bold">/{exam.totalStudents}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Stats Row */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex flex-col items-center bg-fuchsia-500/10 border border-fuchsia-400/20 rounded-xl py-2">
                                                    <span className="text-[8px] uppercase font-black text-fuchsia-200/60 tracking-widest mb-1">Highest</span>
                                                    <span className="text-lg font-black text-fuchsia-300">{formatScore(exam.highestPercentage)}%</span>
                                                </div>
                                                <div className="flex flex-col items-center bg-cyan-500/10 border border-cyan-400/20 rounded-xl py-2">
                                                    <span className="text-[8px] uppercase font-black text-cyan-200/60 tracking-widest mb-1">Batch Avg</span>
                                                    <span className="text-lg font-black text-cyan-300">{formatScore(exam.averagePercentage)}%</span>
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
                                <div className="h-8 w-1 bg-gradient-to-b from-sky-300 via-fuchsia-400 to-violet-600 rounded-full shadow-[0_0_14px_rgba(217,70,239,0.6)]"></div>
                                <BarChart2 className="w-5 h-5 text-sky-300" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-100 to-fuchsia-200">Test Progress Report</span>
                            </h3>

                            <div className="space-y-4">
                                {data.tests.filter(t => t.status !== 'not_enrolled').map((test, idx) => {
                                    const pct = test.percentage || 0;
                                    const tone = test.score === null ? 'none' : pct >= 75 ? 'hi' : pct >= 40 ? 'mid' : 'lo';
                                    const isTop = test.score !== null && test.highestScore > 0 && Number(test.score) >= Number(test.highestScore);
                                    const toneBorder = tone === 'hi' ? 'rgba(163,230,53,0.65)' : tone === 'mid' ? 'rgba(252,211,77,0.6)' : tone === 'lo' ? 'rgba(251,113,133,0.6)' : 'rgba(148,163,184,0.35)';
                                    return (
                                        <div key={test.testId} className="relative sd-gborder sd-rise sd-card bg-[#100b1e]/90 rounded-3xl overflow-hidden shadow-[0_14px_32px_-18px_rgba(0,0,0,0.9)]"
                                            style={{ animationDelay: `${Math.min(idx, 8) * 50}ms`, ['--sd-border' as any]: `linear-gradient(135deg, ${toneBorder}, rgba(255,255,255,0.04) 55%, rgba(139,92,246,0.35))` }}>
                                            <div className="bg-gradient-to-r from-white/[0.06] to-transparent px-4 sm:px-5 py-2.5 sm:py-3.5 flex justify-between items-center border-b border-white/5">
                                                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-100 min-w-0 flex-1 mr-2">
                                                    <Calendar className="w-3.5 h-3.5 text-violet-300/70 shrink-0" />
                                                    <span className="font-bold tracking-tight line-clamp-1">{test.title}</span>
                                                    {isTop && <span className="shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-300 to-yellow-500 text-amber-950">👑 Top</span>}
                                                </div>
                                                {test.status === 'missed' ? (
                                                    <span className="bg-rose-500/20 text-rose-300 text-[8px] sm:text-[9px] uppercase font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-rose-400/40 whitespace-nowrap tracking-wider shrink-0">Missed</span>
                                                ) : (
                                                    <span className="text-[8px] sm:text-[10px] font-bold text-violet-200/50 tracking-wider font-mono shrink-0">{new Date(test.deploymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
                                                )}
                                            </div>

                                            <div className="p-3 sm:p-6 grid grid-cols-3 gap-2 sm:gap-6 text-center">
                                                <div className="flex flex-col justify-center items-center">
                                                    <span className="text-slate-400 text-[8px] sm:text-[9px] uppercase font-black tracking-widest mb-1 sm:mb-2 flex items-center gap-1 sm:gap-1.5 justify-center">
                                                        <Target className="w-2.5 h-2.5 sm:w-3 h-3 text-lime-300" /> <span className="hidden sm:inline">Student</span> Score
                                                    </span>
                                                    <div className="flex items-baseline gap-0.5 sm:gap-1">
                                                        <span className={`text-xl sm:text-3xl font-black ${tone === 'none' ? 'text-slate-600' :
                                                            tone === 'hi' ? 'text-lime-300 drop-shadow-[0_0_10px_rgba(163,230,53,0.45)]' :
                                                                tone === 'mid' ? 'text-amber-300' : 'text-rose-400'
                                                            }`}>
                                                            {test.score !== null ? formatScore(test.score) : '-'}
                                                        </span>
                                                        {test.score !== null && (
                                                            <span className="text-[8px] sm:text-[10px] font-bold text-slate-500">/{test.totalMarks}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col justify-center items-center border-x border-white/[0.07] px-1">
                                                    <span className="text-slate-400 text-[8px] sm:text-[9px] uppercase font-black tracking-widest mb-1 sm:mb-2 flex items-center gap-1 sm:gap-1.5 justify-center">
                                                        <Trophy className="w-2.5 h-2.5 sm:w-3 h-3 text-fuchsia-300" /> Highest
                                                    </span>
                                                    <p className="text-lg sm:text-2xl font-black text-fuchsia-300">{formatScore(test.highestScore)}</p>
                                                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 tracking-tight mt-0.5">Topper</span>
                                                </div>

                                                <div className="flex flex-col justify-center items-center">
                                                    <span className="text-slate-400 text-[8px] sm:text-[9px] uppercase font-black tracking-widest mb-1 sm:mb-2 flex items-center gap-1 sm:gap-1.5 justify-center">
                                                        <Users className="w-2.5 h-2.5 sm:w-3 h-3 text-cyan-300" /> Average
                                                    </span>
                                                    <p className="text-lg sm:text-2xl font-black text-cyan-300">{formatScore(test.averageScore)}</p>
                                                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 tracking-tight mt-0.5">Avg</span>
                                                </div>
                                            </div>

                                            {test.score !== null && (
                                                <div className="px-4 sm:px-6 pb-4 sm:pb-5 -mt-1">
                                                    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                                                        <div
                                                            className={`sd-bar h-full rounded-full bg-gradient-to-r ${tone === 'hi' ? 'from-lime-300 via-emerald-400 to-cyan-400 shadow-[0_0_10px_rgba(163,230,53,0.6)]' : tone === 'mid' ? 'from-amber-300 via-orange-400 to-pink-500' : 'from-rose-500 via-pink-500 to-fuchsia-500'}`}
                                                            style={{ width: `${Math.max(pct, 2)}%`, animationDelay: `${200 + Math.min(idx, 8) * 50}ms` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {data.tests.length === 0 && (
                                    <div className="relative sd-gborder sd-card bg-[#100b1e]/90 rounded-3xl p-12 text-center">
                                        <BarChart2 className="w-12 h-12 text-violet-400/40 mx-auto mb-4" />
                                        <p className="text-violet-200/50 font-bold uppercase tracking-widest text-[10px]">No test records discovered</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-black text-white mb-6 tracking-wide flex items-center gap-3 uppercase">
                                <div className="h-8 w-1 bg-gradient-to-b from-fuchsia-300 via-violet-500 to-cyan-400 rounded-full shadow-[0_0_14px_rgba(168,85,247,0.6)]"></div>
                                <FileText className="w-5 h-5 text-fuchsia-300" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-fuchsia-100 to-cyan-200">Assignment Log</span>
                            </h3>

                            <div className="space-y-2 sm:space-y-3">
                                {data.assignments.filter(a => a.status !== 'NOT_ENROLLED').map((assign, idx) => (
                                    <div key={assign.assignmentId} className="relative sd-gborder sd-rise sd-card bg-[#100b1e]/90 rounded-xl sm:rounded-2xl p-3 sm:p-5 flex justify-between items-center group transition-colors duration-300"
                                        style={{ animationDelay: `${Math.min(idx, 10) * 40}ms`, ['--sd-border' as any]: 'linear-gradient(135deg, rgba(232,121,249,0.45), rgba(255,255,255,0.03) 50%, rgba(34,211,238,0.35))' }}>
                                        <div className="min-w-0 flex-1 pr-2">
                                            <p className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-fuchsia-200 transition-colors uppercase tracking-tight truncate">{assign.title}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <div className="flex items-center gap-1 text-[10px] text-violet-200/50 font-bold tracking-tight">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(assign.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            {['SUBMITTED', 'LATE_SUBMITTED', 'CORRECTED'].includes(assign.status) ? (
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-lime-400/20 to-emerald-500/20 border border-lime-300/35 text-lime-200">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                            {assign.status === 'LATE_SUBMITTED' ? 'Late' : 'Done'}
                                                        </span>
                                                    </div>
                                                    {assign.status === 'CORRECTED' && assign.quality && (
                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                                                            assign.quality === 'GOOD' ? 'bg-lime-400/15 text-lime-300 border-lime-300/40' :
                                                            assign.quality === 'SATISFACTORY' ? 'bg-amber-400/15 text-amber-300 border-amber-300/40' :
                                                            'bg-rose-500/15 text-rose-300 border-rose-400/40'
                                                        }`}>
                                                            {assign.quality === 'GOOD' ? '🌟 ' : assign.quality === 'SATISFACTORY' ? '👍 ' : '📌 '}{assign.quality}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : assign.status === 'SCHEDULED' ? (
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-400/15 border border-sky-300/30 text-sky-200 font-black uppercase tracking-widest text-[10px]">
                                                    <Clock className="w-3.5 h-3.5" /> Scheduled
                                                </div>
                                            ) : assign.status === 'MISSED' ? (
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-400/35 text-rose-300 font-black uppercase tracking-widest text-[10px]">
                                                    <XCircle className="w-3.5 h-3.5" /> Missed
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-300/35 text-amber-200 font-black uppercase tracking-widest text-[10px]">
                                                    <Clock className="w-3.5 h-3.5" /> Pending
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {data.assignments.length === 0 && (
                                    <div className="relative sd-gborder sd-card bg-[#100b1e]/90 rounded-3xl p-12 text-center">
                                        <FileText className="w-12 h-12 text-violet-400/40 mx-auto mb-4" />
                                        <p className="text-violet-200/50 font-bold uppercase tracking-widest text-[10px]">No assignments found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
