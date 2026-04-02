'use client';

import { useState } from 'react';
import { School, ChevronDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface SchoolBoardModalProps {
    onComplete: (schoolName: string, board: string) => void;
}

export default function SchoolBoardModal({ onComplete }: SchoolBoardModalProps) {
    const [schoolName, setSchoolName] = useState('');
    const [board, setBoard] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!schoolName.trim()) {
            toast.error('Please enter your full school name');
            return;
        }
        if (!board) {
            toast.error('Please select your board');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/student/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolName: schoolName.trim(), board })
            });

            if (res.ok) {
                toast.success('Profile updated successfully!');
                onComplete(schoolName.trim(), board);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            {/* Animated background accents */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl shadow-blue-500/10 relative z-10 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 pb-2 text-center">
                    <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                        <School className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
                        Complete Your Profile
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Please provide your school details to continue. This is a <span className="text-blue-400 font-semibold">one-time</span> requirement.
                    </p>
                </div>

                {/* Form */}
                <div className="p-6 space-y-5">
                    {/* School Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Full Name of Your School <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={schoolName}
                            onChange={e => setSchoolName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
                            placeholder="e.g. St. Xavier's Collegiate School"
                            autoFocus
                        />
                        <p className="text-[10px] text-slate-500 mt-1.5 pl-1">
                            Please enter the complete official name of your school
                        </p>
                    </div>

                    {/* Board Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Board <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={board}
                                onChange={e => setBoard(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none cursor-pointer"
                            >
                                <option value="" className="bg-[#0f172a] text-slate-400">Select your board...</option>
                                <option value="CBSE" className="bg-[#0f172a] text-white">CBSE</option>
                                <option value="ISC" className="bg-[#0f172a] text-white">ISC</option>
                                <option value="WBCHSE" className="bg-[#0f172a] text-white">WBCHSE</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !schoolName.trim() || !board}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
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

                    <p className="text-center text-[10px] text-slate-600 font-medium">
                        This information helps us organize academic records
                    </p>
                </div>
            </div>
        </div>
    );
}
