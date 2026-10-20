'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, FileText, Upload, ClipboardCheck, ClipboardList, BookText, DollarSign, LogOut, Menu, X, Calendar, BarChart3, ChevronRight, MessageSquare, GraduationCap } from 'lucide-react';
import InstallPWA from '@/components/InstallPWA';
import '../portal-theme.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [showGlobalAdminModal, setShowGlobalAdminModal] = useState(false);
    const [globalAdminPassword, setGlobalAdminPassword] = useState('');
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);

    const fetchChatStatus = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/chat/batch-status', { headers });
            const data = await res.json();
            if (res.ok) setUnreadChatCount(data.unreadCount || 0);
        } catch (e) {}
    };

    useEffect(() => {
        if (user) {
            fetchChatStatus();
            const interval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    fetchChatStatus();
                }
            }, 120000); // 2 minutes
            return () => clearInterval(interval);
        }
    }, [user]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsGlobalAdmin(localStorage.getItem('globalAdminActive') === 'true');
        }
    }, []);

    useEffect(() => {
        // Safety Timeout in case logic hangs
        const timer = setTimeout(() => setLoading(false), 2000);

        const storedUser = localStorage.getItem('user');
        const sessionStart = localStorage.getItem('adminSessionStart');

        // Session duration: Use custom expiry if set (for remember me), otherwise default to 7 days
        const customExpiry = localStorage.getItem('admin_session_expiry');
        const SESSION_DURATION = customExpiry ? parseInt(customExpiry) : 7 * 24 * 60 * 60 * 1000;

        if (!storedUser || !sessionStart) {
            router.push('/admin/login');
        } else {
            const now = Date.now();
            if (now - parseInt(sessionStart) > SESSION_DURATION) {
                // Session expired
                localStorage.removeItem('user');
                localStorage.removeItem('adminSessionStart');
                localStorage.removeItem('admin_session_expiry');
                router.push('/admin/login');
            } else {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    // Allow admin, manager, and copy_checker
                    if (!['admin', 'manager', 'copy_checker', 'superadmin'].includes(parsedUser.role)) {
                        router.push('/admin/login');
                    } else {
                        setUser(parsedUser);
                    }
                } catch (e) {
                    localStorage.removeItem('user');
                    localStorage.removeItem('adminSessionStart');
                    localStorage.removeItem('admin_session_expiry');
                    router.push('/admin/login');
                }
            }
        }

        // Ensure loading is turned off quickly to allow redirect or render
        setLoading(false);

        // STICT ROUTE GUARD: Check if current path is allowed for the role
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                const allowedRoutes: Record<string, string[]> = {
                    'manager': ['/admin/fees'],
                    'copy_checker': ['/admin/questions', '/admin/jee-section', '/admin/online-tests', '/admin/assignments'],
                    'admin': [], // Admin allows all
                    'superadmin': []
                };

                const role = user.role;
                // If role has restrictions (manager/copy_checker) and the list is not empty
                if (allowedRoutes[role] && allowedRoutes[role].length > 0) {
                    // Check if current path is allowed
                    if (!allowedRoutes[role].some(allowed => pathname === allowed || pathname.startsWith(allowed + '/'))) {
                        console.warn(`[RouteGuard] Blocked access to ${pathname} for role ${role}`);
                        // Redirect to their main page
                        if (role === 'manager') router.push('/admin/fees');
                        else if (role === 'copy_checker') router.push('/admin/questions');
                        else router.push('/admin/dashboard');
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        return () => clearTimeout(timer);
    }, [router, pathname]); // Re-run on pathname change to protect navigation

    // Keep session alive while user is actively working
    useEffect(() => {
        if (!user) return;

        let lastRefresh = Date.now();
        const REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh session every 5 minutes of activity

        const refreshSession = () => {
            const now = Date.now();
            if (now - lastRefresh >= REFRESH_INTERVAL) {
                localStorage.setItem('adminSessionStart', now.toString());
                lastRefresh = now;
            }
        };

        // Listen to user activity events
        const events = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'];
        events.forEach(event => window.addEventListener(event, refreshSession, { passive: true }));

        return () => {
            events.forEach(event => window.removeEventListener(event, refreshSession));
        };
    }, [user]);

    // Prevent mobile back button from logging out
    useEffect(() => {
        if (!user) return;

        // Push an extra history entry so back button doesn't leave the app
        window.history.pushState(null, '', window.location.href);

        const handlePopState = () => {
            // Re-push current URL to trap the back button
            window.history.pushState(null, '', window.location.href);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [user, pathname]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('adminSessionStart');
        router.push('/admin/login');
    };

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.new !== passwordForm.confirm) {
            alert('New passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/profile/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.new }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update password');

            alert('Password updated successfully! Please login again with the new password.');
            localStorage.removeItem('user');
            localStorage.removeItem('adminSessionStart');
            // Force logout
            window.location.href = '/admin/login';
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
            setShowPasswordModal(false);
        }
    };

    const handleGlobalAdminSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (globalAdminPassword.trim() === 'globaladmin_25') {
            localStorage.setItem('globalAdminActive', 'true');
            setShowGlobalAdminModal(false);
            setGlobalAdminPassword('');
            window.location.reload(); // Reload to apply global admin powers
        } else {
            alert('Incorrect password');
            setGlobalAdminPassword('');
        }
    };

    // Full Navigation List
    const allNavigation = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
        { name: 'Students', href: '/admin/students', icon: Users },
        { name: 'Student Chat', href: '/admin/chat', icon: MessageSquare },
        { name: 'Question Bank', href: '/admin/questions', icon: FileText },
        { name: 'JEE Section', href: '/admin/jee-section', icon: GraduationCap },
        { name: 'Deploy Questions', href: '/admin/deploy', icon: Upload },
        { name: 'Online Tests', href: '/admin/online-tests', icon: ClipboardCheck },
        { name: 'Surveys', href: '/admin/surveys', icon: ClipboardList },
        { name: 'Assignments', href: '/admin/assignments', icon: ClipboardList },
        { name: 'Lesson Plan', href: '/admin/lesson-plan', icon: BookText },
        { name: 'Fees Management', href: '/admin/fees', icon: DollarSign },
    ];

    // Filter Navigation based on Role
    const navigation = allNavigation.filter(item => {
        if (!user) return false;
        if (user.role === 'admin' || user.role === 'superadmin') return true;

        if (user.role === 'manager') {
            // Manager: Fees Only
            return ['Fees Management'].includes(item.name);
        }

        if (user.role === 'copy_checker') {
            // Copy Checker: Question Bank, Answer Bank, Online Tests, Assignments
            return ['Question Bank', 'Answer Bank', 'JEE Section', 'Online Tests', 'Assignments', 'Surveys'].includes(item.name);
        }

        return false;
    });

    // Bypass auth check for login and forgot password pages
    if (pathname === '/admin/login' || pathname === '/admin/forgot-password') {
        return <>{children}</>;
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center sd-bg text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-fuchsia-400"></div>
                <p className="ml-4 font-semibold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 to-cyan-300">Loading Admin Portal...</p>
            </div>
        );
    }

    if (!user) return null;

    // Fullscreen mode for JEE Section (hide sidebar completely)
    const isFullscreen = pathname.startsWith('/admin/jee-section');

    if (isFullscreen) {
        return (
            <div className="min-h-screen bg-black">
                {children}
            </div>
        );
    }

    return (
        <div className="min-h-screen sd-bg flex font-sans text-slate-200 selection:bg-fuchsia-500/30">
            {/* Static neon grid behind everything (no animation) */}
            <div className="fixed inset-0 pointer-events-none z-0 sd-grid" />
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/70 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0c0919] border-r border-fuchsia-500/15 shadow-[8px_0_40px_-12px_rgba(168,85,247,0.35)] transition-transform duration-300 ease-spring ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(80%_35%_at_0%_0%,rgba(217,70,239,0.16),transparent_70%),radial-gradient(80%_30%_at_100%_100%,rgba(34,211,238,0.10),transparent_70%)]" />
                <div className="relative flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="h-20 flex items-center px-8 border-b border-white/10">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-600 ring-1 ring-white/20 flex items-center justify-center text-white font-black shadow-lg shadow-fuchsia-500/30 mr-4">
                            A
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">Admin<span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-300">Portal</span></h1>
                            <p className="text-[10px] text-violet-300/60 font-bold tracking-widest uppercase mt-0.5">RB Maths Question Bank</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-2 no-scrollbar">

                        {navigation.map((item) => {
                            const Icon = item.icon;
                            // Checking exact match or starting with prevents active state issues
                            const isActive = pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`group flex items-center px-4 py-3.5 rounded-2xl transition-all duration-200 relative overflow-hidden ${isActive
                                        ? 'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-fuchsia-500/30 translate-x-1'
                                        : 'text-slate-300 hover:text-white hover:bg-white/5 hover:translate-x-1'
                                        }`}
                                >
                                    {isActive && (
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-white/80" />
                                    )}
                                    <Icon className={`h-5 w-5 mr-3 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                    <span className="font-medium relative z-10">{item.name}</span>
                                    {item.name === 'Student Chat' && unreadChatCount > 0 && (
                                        <div className="ml-auto bg-red-500 text-white text-[10px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 animate-pulse border border-white/20">
                                            {unreadChatCount}
                                        </div>
                                    )}
                                    {isActive && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="p-4 border-t border-white/10">
                        <div className="relative sd-gborder sd-gborder-soft sd-card bg-[#140d27]/80 rounded-2xl p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-fuchsia-400 via-amber-300 to-cyan-400 p-0.5">
                                    <div className="h-full w-full rounded-full bg-[#140d27] flex items-center justify-center">
                                        <span className="font-bold text-white text-sm">RB</span>
                                    </div>
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-white truncate">{user?.name || 'Admin'}</p>
                                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-500/10 hover:border-red-500/30 gap-2"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/70 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="relative flex-1 min-w-0 lg:pl-72 transition-all duration-300">
                {/* Top Bar (Mobile) */}
                <div className="h-16 lg:hidden flex items-center justify-between px-4 sd-header sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 ring-1 ring-white/20 flex items-center justify-center text-white font-black shadow-md shadow-fuchsia-500/30">
                            A
                        </div>
                        <span className="font-black text-white">Admin<span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-300">Portal</span></span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 ring-1 ring-fuchsia-400/30 text-fuchsia-100 active:scale-95 transition-transform"
                    >
                        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>

                <div className="p-4 lg:p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
