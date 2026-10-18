'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { clearStudentCache } from '@/lib/studentCache';

export default function StudentLogin() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Quick localStorage check — if student appears logged in, redirect to dashboard.
        // StudentProfileProvider on /student will do the real server-side session validation.
        if (typeof window !== 'undefined' && localStorage.getItem('studentName')) {
            router.replace('/student');
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = password.trim();

        // Detect guest code
        if (trimmed.toLowerCase() === 'rbmaths11free') {
            router.push('/student/guest-register');
            return;
        }

        setLoading(true);
        // Clear previous session data to prevent role conflicts (specific keys only)
        localStorage.removeItem('studentName');
        localStorage.removeItem('studentCourses');
        localStorage.removeItem('user');
        localStorage.removeItem('adminSessionStart');
        localStorage.removeItem('admin_session_expiry');
        clearStudentCache(); // never show the previous user's cached pages

        try {
            const res = await fetch('/api/student/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: trimmed })
            });

            const data = await res.json();

            if (res.ok) {
                // If student data exists, store it (Staff/Guardian might not return this)
                if (data.student) {
                    localStorage.setItem('studentName', data.student.studentName);
                    localStorage.setItem('studentCourses', JSON.stringify(data.student.batches));
                }

                // If getting redirected to Admin/Guardian, we might want to store a dummy User object for the UI to not crash if it checks localStorage
                // But the Admin/Guardian apps fetch profile or check token.
                // Admin Dashboard does check 'user' in localStorage for stats fetching email!
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    // Start session timer for Admin/Guardian layouts
                    localStorage.setItem('adminSessionStart', Date.now().toString());
                }

                router.replace(data.redirectUrl || '/student');
            } else {
                toast.error(data.error || 'Login failed. Please check your password.');
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen sd-bg flex items-center justify-center p-4 font-sans relative overflow-hidden">
            <Toaster />
            {/* Static neon grid */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none sd-grid" />

            <div className="sd-gborder sd-rise bg-[#120c24]/95 p-8 rounded-2xl shadow-[0_24px_60px_-20px_rgba(217,70,239,0.45)] w-full max-w-md relative z-10 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(70%_60%_at_0%_0%,rgba(217,70,239,0.22),transparent_60%),radial-gradient(60%_60%_at_100%_100%,rgba(34,211,238,0.16),transparent_60%)]" />
                <div className="sd-shine" />
                <span className="sd-twinkle absolute top-5 right-7 text-[10px] text-amber-200 pointer-events-none">✦</span>
                <span className="sd-twinkle absolute bottom-6 left-6 text-[8px] text-cyan-200 pointer-events-none" style={{ animationDelay: '1.2s' }}>✦</span>
                <div className="text-center mb-8 relative">
                    <div className="sd-float h-16 w-16 bg-gradient-to-br from-fuchsia-500 via-violet-600 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-white/20 shadow-[0_0_28px_rgba(217,70,239,0.5)]">
                        <KeyRound className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black sd-name mb-1.5">Student Login</h1>
                    <p className="text-xs sm:text-sm text-slate-400">Enter your password to access your courses.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6 relative">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Enter password Or Your Registered WhatsApp no.</label>
                        <input
                            type="text"
                            placeholder="Enter password Or Your Registered WhatsApp no."
                            className="w-full bg-[#0b0718] border border-[#352a55] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-fuchsia-500 outline-none transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-fuchsia-600/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            <>
                                Login <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

