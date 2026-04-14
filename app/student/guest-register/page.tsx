'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { UserPlus, ArrowRight, Loader2, CheckCircle, KeyRound, Copy, ChevronDown } from 'lucide-react';

export default function GuestRegister() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form state
    const [fullName, setFullName] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [board, setBoard] = useState('');
    const [className, setClassName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [dob, setDob] = useState('');

    // Success state
    const [success, setSuccess] = useState(false);
    const [generatedLoginId, setGeneratedLoginId] = useState('');

    // Live password preview
    const livePassword = useMemo(() => {
        const cleanDob = dob.replace(/\D/g, '');
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        if (cleanDob.length === 8 && cleanPhone.length >= 5) {
            return cleanDob + cleanPhone.slice(-5);
        }
        return '';
    }, [dob, phoneNumber]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Client-side validation
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const cleanDob = dob.replace(/\D/g, '');

        if (cleanPhone.length !== 10) {
            toast.error('Phone number must be exactly 10 digits.');
            return;
        }
        if (cleanDob.length !== 8) {
            toast.error('Date of Birth must be exactly 8 digits (DDMMYYYY).');
            return;
        }
        if (!fullName.trim()) {
            toast.error('Please enter your full name.');
            return;
        }
        if (!schoolName.trim()) {
            toast.error('Please enter your school name.');
            return;
        }
        if (!board) {
            toast.error('Please select your board.');
            return;
        }
        if (!className) {
            toast.error('Please select your class.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/student/guest-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: fullName.trim(),
                    schoolName: schoolName.trim(),
                    board,
                    className,
                    phoneNumber: cleanPhone,
                    dob: cleanDob
                })
            });

            const data = await res.json();

            if (res.ok) {
                setGeneratedLoginId(data.loginId);
                setSuccess(true);
                toast.success('Registration successful!');
            } else {
                toast.error(data.error || 'Registration failed.');
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedLoginId);
        toast.success('Password copied to clipboard!');
    };

    // ─── SUCCESS SCREEN ───
    if (success) {
        return (
            <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-4 font-sans relative overflow-hidden">
                <Toaster position="top-center" />

                {/* Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-green-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                <div className="relative z-10 w-full max-w-md">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl shadow-emerald-500/10 p-8 text-center animate-in zoom-in-95 duration-500">
                        {/* Success Icon */}
                        <div className="relative inline-block mb-6">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full blur-xl opacity-40 animate-pulse" />
                            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
                                <CheckCircle className="h-10 w-10 text-white" />
                            </div>
                        </div>

                        <h2 className="text-2xl font-black text-white mb-2">Registration Successful!</h2>
                        <p className="text-sm text-slate-400 mb-8">Welcome to RB Maths Academy Free Batch</p>

                        {/* Password Display */}
                        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-2 border-amber-500/40 rounded-2xl p-6 mb-6">
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <KeyRound className="h-5 w-5 text-amber-400" />
                                <p className="text-xs font-black text-amber-400 uppercase tracking-widest">Your Login Password</p>
                            </div>
                            <div className="flex items-center justify-center gap-3">
                                <p className="text-3xl font-black text-white tracking-widest font-mono">{generatedLoginId}</p>
                                <button
                                    onClick={copyToClipboard}
                                    className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
                                    title="Copy"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8">
                            <p className="text-xs text-red-400 font-bold leading-relaxed">
                                ⚠️ Please save this password! You will need it every time you login. Write it down or take a screenshot.
                            </p>
                        </div>

                        {/* Go to Login */}
                        <button
                            onClick={() => router.push('/student/login')}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            Go to Login <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── REGISTRATION FORM ───
    return (
        <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-4 font-sans relative overflow-hidden">
            <Toaster position="top-center" />

            {/* Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl shadow-purple-500/10 animate-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className="p-6 pb-2 text-center">
                        <div className="relative inline-block mb-4">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl blur-xl opacity-40" />
                            <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto shadow-xl shadow-purple-500/30">
                                <UserPlus className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
                            Guest Registration
                        </h2>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Join the <span className="text-purple-400 font-semibold">Class XI Free Batch</span>
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Full Name */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Full Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
                                placeholder="Enter your full name"
                                required
                                autoFocus
                            />
                        </div>

                        {/* School Name */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                School Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={schoolName}
                                onChange={e => setSchoolName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
                                placeholder="e.g. St. Xavier's Collegiate School"
                                required
                            />
                        </div>

                        {/* Board */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Board <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={board}
                                    onChange={e => setBoard(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="" className="bg-[#0f172a] text-slate-400">Select your board...</option>
                                    <option value="ISC" className="bg-[#0f172a] text-white">ISC</option>
                                    <option value="CBSE" className="bg-[#0f172a] text-white">CBSE</option>
                                    <option value="WB" className="bg-[#0f172a] text-white">WB</option>
                                    <option value="Others" className="bg-[#0f172a] text-white">Others</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Class */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Class <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={className}
                                    onChange={e => setClassName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="" className="bg-[#0f172a] text-slate-400">Select your class...</option>
                                    <option value="XI" className="bg-[#0f172a] text-white">XI</option>
                                    <option value="Others" className="bg-[#0f172a] text-white">Others</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Phone Number */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Phone Number <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={phoneNumber}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    if (val.length <= 10) setPhoneNumber(val);
                                }}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono tracking-wider"
                                placeholder="10-digit phone number"
                                maxLength={10}
                                required
                            />
                            <p className="text-[10px] text-slate-500 mt-1 pl-1">
                                {phoneNumber.length}/10 digits
                            </p>
                        </div>

                        {/* Date of Birth */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Date of Birth <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={dob}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    if (val.length <= 8) setDob(val);
                                }}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono tracking-wider"
                                placeholder="DDMMYYYY (e.g. 15052006)"
                                maxLength={8}
                                required
                            />
                            <p className="text-[10px] text-slate-500 mt-1 pl-1">
                                Format: DDMMYYYY • {dob.length}/8 digits
                            </p>
                        </div>

                        {/* Live Password Preview */}
                        {livePassword && (
                            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-2 border-amber-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center gap-2 mb-2">
                                    <KeyRound className="h-4 w-4 text-amber-400" />
                                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Your Login Password Will Be</p>
                                </div>
                                <p className="text-2xl font-black text-white tracking-widest font-mono text-center">{livePassword}</p>
                                <p className="text-[10px] text-amber-400/70 mt-2 text-center font-medium">
                                    Save this password — you&apos;ll use it to login every time
                                </p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !fullName.trim() || !schoolName.trim() || !board || !className || phoneNumber.length !== 10 || dob.length !== 8}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Registering...
                                </>
                            ) : (
                                <>
                                    Register <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>

                        <p className="text-center text-[10px] text-slate-600 font-medium">
                            Already registered?{' '}
                            <button
                                type="button"
                                onClick={() => router.push('/student/login')}
                                className="text-blue-400 hover:text-blue-300 font-bold"
                            >
                                Login here
                            </button>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
