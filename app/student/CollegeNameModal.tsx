'use client';

import { useState } from 'react';
import { School, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface CollegeNameModalProps {
    onComplete: (collegeName: string) => void;
}

export default function CollegeNameModal({ onComplete }: CollegeNameModalProps) {
    const [collegeName, setCollegeName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!collegeName.trim()) {
            toast.error('Please enter your full college name');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/student/college-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ collegeName: collegeName.trim() })
            });

            if (res.ok) {
                toast.success('Profile updated successfully!');
                onComplete(collegeName.trim());
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save. Please try again.');
            }
        } catch {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
            </div>

            <div className="bg-[#140d27] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl shadow-fuchsia-500/10 relative z-10 animate-in zoom-in-95 duration-300">
                <div className="p-6 pb-2 text-center">
                    <div className="h-16 w-16 bg-gradient-to-br from-fuchsia-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-fuchsia-500/30">
                        <School className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
                        College Information
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Please provide your college details to continue.
                    </p>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Full Name of Your College <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={collegeName}
                            onChange={e => setCollegeName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 transition-all"
                            placeholder="e.g. Asutosh College"
                            autoFocus
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !collegeName.trim()}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold text-sm transition-all shadow-lg shadow-fuchsia-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save & Continue'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
