'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ForgotPassword() {
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Safety timeout
        const timer = setTimeout(() => {
            if (loading) {
                setLoading(false);
                toast.error('Request timed out. Please try again.');
            }
        }, 15000); // 15s timeout

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });

            const data = await res.json();
            clearTimeout(timer); // Clear timeout on response

            if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

            toast.success(data.message || 'OTP Sent!');
            if (data.dev_otp) {
                console.log('DEV OTP:', data.dev_otp);
                toast('DEV MODE: OTP is in console', { icon: '🐛' });
            }
            setStep('otp');
        } catch (error: any) {
            clearTimeout(timer);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), otp: otp.trim(), newPassword }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');

            toast.success('Password Reset Successfully!');
            router.push('/admin/login');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-gray-200">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center mb-6">
                    <div className="p-3 bg-blue-600/20 rounded-full">
                        <KeyRound className="h-8 w-8 text-blue-500" />
                    </div>
                </div>
                <h2 className="text-center text-3xl font-bold tracking-tight text-white">
                    Reset Password
                </h2>
                <p className="mt-2 text-center text-sm text-gray-400">
                    {step === 'email' ? 'Enter your admin email to receive an OTP' : 'Check your email for the verification code'}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-700">
                    {step === 'email' ? (
                        <form className="space-y-6" onSubmit={handleSendOTP}>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                                    Email Address
                                </label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-500" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className="block w-full pl-10 bg-gray-700 border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2"
                                        placeholder="admin@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Send OTP'}
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handleResetPassword}>
                            <div>
                                <label className="block text-sm font-medium text-gray-300">Enter OTP</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md text-white text-center tracking-widest text-lg font-mono focus:ring-blue-500 focus:border-blue-500 py-2"
                                    placeholder="XXXXXX"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300">New Password</label>
                                <input
                                    type="password"
                                    required
                                    className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 py-2 px-3"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Reset Password'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('email')}
                                className="w-full text-center text-sm text-gray-400 hover:text-white"
                            >
                                Change Email
                            </button>
                        </form>
                    )}

                    <div className="mt-6 border-t border-gray-700 pt-6">
                        <Link href="/admin/login" className="flex items-center justify-center text-sm font-medium text-gray-400 hover:text-white gap-2">
                            <ArrowLeft className="h-4 w-4" /> Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
