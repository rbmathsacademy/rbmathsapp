'use client';

import { DollarSign, Sparkles, Plus } from 'lucide-react';

export default function AdminFees() {
    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-red-400">
                        Fees Management
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Manage fee records and payments</p>
                </div>
                <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold transition-all flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Fee Record
                </button>
            </div>

            {/* Coming Soon Card */}
            <div className="text-center py-20">
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                        <div className="relative p-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 shadow-2xl">
                            <DollarSign className="h-16 w-16 text-white" />
                        </div>
                    </div>
                </div>

                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/30 mb-8">
                    <Sparkles className="h-5 w-5 text-pink-400" />
                    <span className="text-sm font-bold text-pink-300">Coming Soon</span>
                </div>

                <div className="max-w-2xl mx-auto bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                    <h3 className="text-xl font-bold text-white mb-4">Upcoming Features:</h3>
                    <ul className="space-y-3 text-slate-300 text-left">
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-pink-400"></div>
                            <span>Manage fee structures and pricing plans</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-pink-400"></div>
                            <span>Track payments and pending dues</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-pink-400"></div>
                            <span>Generate invoices and receipts automatically</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-pink-400"></div>
                            <span>Send payment reminders and notifications</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-pink-400"></div>
                            <span>Export financial reports and statements</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
