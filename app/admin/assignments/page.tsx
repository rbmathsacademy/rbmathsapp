'use client';

import { ClipboardList, Sparkles, Plus } from 'lucide-react';

export default function AdminAssignments() {
    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400">
                        Assignments Management
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Create and manage student assignments</p>
                </div>
                <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold transition-all flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Assignment
                </button>
            </div>

            {/* Coming Soon Card */}
            <div className="text-center py-20">
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                        <div className="relative p-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 shadow-2xl">
                            <ClipboardList className="h-16 w-16 text-white" />
                        </div>
                    </div>
                </div>

                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 mb-8">
                    <Sparkles className="h-5 w-5 text-blue-400" />
                    <span className="text-sm font-bold text-blue-300">Coming Soon</span>
                </div>

                <div className="max-w-2xl mx-auto bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                    <h3 className="text-xl font-bold text-white mb-4">Upcoming Features:</h3>
                    <ul className="space-y-3 text-slate-300 text-left">
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                            <span>Create assignments with detailed instructions and resources</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                            <span>Set deadlines and manage submission windows</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                            <span>Review student submissions and provide feedback</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                            <span>Grade assignments and track completion rates</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                            <span>Generate assignment performance reports</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
