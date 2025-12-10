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
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-gray-900/50 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-700">
                        <span className="text-xl font-bold text-white">Admin Portal</span>
                        <button className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}>
                            <X className="h-6 w-6 text-gray-400" />
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`group flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 ${isActive
                                        ? 'bg-gray-700 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                        }`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <item.icon className="h-5 w-5 shrink-0" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-gray-700">
                        <button
                            onClick={handleLogout}
                            className="group flex w-full items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-400 hover:text-white hover:bg-gray-700"
                        >
                            <LogOut className="h-5 w-5 shrink-0" />
                            Log out
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <div className="md:hidden flex items-center justify-between bg-gray-800 p-4 border-b border-gray-700">
                    <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
                        <Menu className="h-6 w-6" />
                    </button>
                    <span className="text-xl font-bold text-white">Admin</span>
                    <div className="w-6" /> {/* Spacer */}
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
