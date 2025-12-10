'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Users, ClipboardList, CheckSquare, FileText,
    Upload, BarChart, BookOpen, LogOut, Menu, X
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // Safety Timeout in case logic hangs
        const timer = setTimeout(() => setLoading(false), 2000);

        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            router.push('/admin/login');
            // Do not return here, let the timeout or loading state handle UI
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
                router.push('/admin/login');
            }
        }

        // Ensure loading is turned off quickly to allow redirect or render
        setLoading(false);

        return () => clearTimeout(timer);
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        router.push('/admin/login');
    };

    const navigation = [
        { name: 'Student Data Entry', href: '/admin/dashboard', icon: Users },
        { name: 'Track Attendance', href: '/admin/reports', icon: ClipboardList },
        { name: 'Mark Daily Attendance', href: '/admin/attendance', icon: CheckSquare },
        { name: 'Question Bank', href: '/admin/questions', icon: FileText },
        { name: 'Assignments', href: '/admin/assignments', icon: Upload },
        { name: 'Submissions', href: '/admin/submissions', icon: FileText },
        { name: 'Student Marks', href: '/admin/marks', icon: BarChart },
        { name: 'Study Materials', href: '/admin/resources', icon: BookOpen },
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
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex font-inter">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-white/5 transform transition-transform duration-300 ease-out md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full shadow-2xl'}`}>
                <div className="flex flex-col h-full">
                    {/* Logo Area */}
                    <div className="flex h-20 shrink-0 items-center px-6 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800/50">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <span className="text-white font-bold text-lg">A</span>
                            </div>
                            <div>
                                <span className="text-xl font-bold text-white tracking-tight block leading-tight">Admin<span className="text-indigo-400">Portal</span></span>
                                <span className="text-[10px] text-slate-500 font-normal tracking-wide opacity-60 block">developed by Dr. Ritwick Banerjee</span>
                            </div>
                        </div>
                        <button className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}>
                            <X className="h-6 w-6 text-slate-400 hover:text-white transition-colors" />
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (

                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`group flex items-center gap-x-3 rounded-lg p-3 text-sm font-medium transition-all duration-200 relative ${isActive
                                        ? 'light-beam-border text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                                        }`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    {/* Background overlay for active state to ensure text readability over the beam */}
                                    {isActive && <div className="absolute inset-[1px] bg-slate-900/90 rounded-[inherit] z-[-1]" />}

                                    <item.icon className={`h-5 w-5 shrink-0 transition-colors z-10 ${isActive ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                    <span className="z-10">{item.name}</span>
                                </Link>
                            );

                        })}
                    </nav>

                    <div className="p-4 border-t border-white/5 bg-slate-900/50">
                        <div className="flex items-center gap-3 px-2 mb-4">
                            <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30">
                                {user.name?.[0] || 'A'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="group flex w-full items-center gap-x-3 rounded-lg p-2 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                            <LogOut className="h-5 w-5 shrink-0 transition-colors group-hover:text-red-400" />
                            Sign out
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)' }}></div>

                {/* Mobile Header */}
                <div className="md:hidden flex items-center justify-between bg-slate-900/80 backdrop-blur-md p-4 border-b border-white/5 sticky top-0 z-20">
                    <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white">
                        <Menu className="h-6 w-6" />
                    </button>
                    <span className="text-lg font-bold text-white">Admin<span className="text-indigo-400">Portal</span></span>
                    <div className="w-6" />
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 scroll-smooth">
                    {children}
                </main>
            </div>
        </div>
    );
}
