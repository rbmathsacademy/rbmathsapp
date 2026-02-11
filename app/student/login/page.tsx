'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { Phone, ArrowRight, Loader2 } from 'lucide-react';

export default function StudentLogin() {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/student/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone.trim() })
            });

            const data = await res.json();

            if (res.ok) {
                // Remove toast to avoid stuck popup on mobile. Dashboard has greeting.
                // Store basic info if needed, but token handles auth
                localStorage.setItem('studentName', data.student.studentName);
                localStorage.setItem('studentCourses', JSON.stringify(data.student.batches));

                router.push('/student');
            } else {
                toast.error(data.error || 'Login failed. Please check your number.');
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
            <Toaster />
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[100px]" />
            </div>

            <div className="bg-slate-900 border border-white/5 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="h-16 w-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                        <Phone className="h-8 w-8 text-blue-400" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5">Student Login</h1>
                    <p className="text-xs sm:text-sm text-slate-400">Enter your registered phone number to access your courses.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Phone Number</label>
                        <input
                            type="tel"
                            placeholder="e.g. 9876543210"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
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
