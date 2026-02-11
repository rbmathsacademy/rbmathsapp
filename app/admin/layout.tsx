'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Users, ClipboardList, CheckSquare, FileText,
    Upload, BarChart, BookOpen, LogOut, Menu, X, GraduationCap, ChevronRight,
    ClipboardCheck, Calendar, DollarSign, BookText, LayoutDashboard
} from 'lucide-react';
import InstallPWA from '@/components/InstallPWA';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [showGlobalAdminModal, setShowGlobalAdminModal] = useState(false);
    const [globalAdminPassword, setGlobalAdminPassword] = useState('');
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

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

        // Session duration: Use custom expiry if set (for remember me), otherwise default to 30 minutes
        const customExpiry = localStorage.getItem('admin_session_expiry');
        const SESSION_DURATION = customExpiry ? parseInt(customExpiry) : 30 * 60 * 1000;

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
                    if (parsedUser.role !== 'admin') {
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

        return () => clearTimeout(timer);
    }, [router]);

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

    const navigation = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Question Bank', href: '/admin/questions', icon: FileText },
        { name: 'Answer Bank', href: '/admin/answers', icon: BookOpen },
        { name: 'Deploy Questions', href: '/admin/deploy', icon: Upload },
        { name: 'Online Tests', href: '/admin/online-tests', icon: ClipboardCheck },
        { name: 'Assignments', href: '/admin/assignments', icon: ClipboardList },
        { name: 'Attendance', href: '/admin/attendance', icon: Calendar },
        { name: 'Lesson Plan', href: '/admin/lesson-plan', icon: BookText },
        { name: 'Fees Management', href: '/admin/fees', icon: DollarSign },
    ];

    // Bypass auth check for login and forgot password pages
    if (pathname === '/admin/login' || pathname === '/admin/forgot-password') {
        return <>{children}</>;
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <p className="ml-4 text-gray-400">Loading Admin Portal...</p>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#050b14] flex font-sans text-slate-200 selection:bg-blue-500/30">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0f172a]/80 backdrop-blur-xl border-r border-white/5 transition-transform duration-300 ease-spring ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="h-20 flex items-center px-8 border-b border-white/5 bg-gradient-to-r from-blue-900/10 to-transparent">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 mr-4">
                            A
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Admin<span className="text-blue-400">Portal</span></h1>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">RB Maths Question Bank</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-2 no-scrollbar">
                        <div className="mb-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Management
                        </div>

                        {navigation.map((item) => {
                            const Icon = item.icon;
                            // Checking exact match or starting with prevents active state issues
                            const isActive = pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`group flex items-center px-4 py-3.5 rounded-2xl transition-all duration-200 relative overflow-hidden ${isActive
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 translate-x-1'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-1'
                                        }`}
                                >
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent animate-pulse"></div>
                                    )}
                                    <Icon className={`h-5 w-5 mr-3 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                    <span className="font-medium relative z-10">{item.name}</span>
                                    {isActive && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="p-4 border-t border-white/5 bg-[#0f172a]/50">
                        <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 p-0.5">
                                    <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center">
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
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 lg:pl-72 transition-all duration-300">
                {/* Top Bar (Mobile) */}
                <div className="h-16 lg:hidden flex items-center justify-between px-4 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-xl sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                            A
                        </div>
                        <span className="font-bold text-white">Admin Portal</span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
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
