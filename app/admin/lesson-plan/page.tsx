'use client';

import { BookText, Sparkles, Plus } from 'lucide-react';

export default function AdminLessonPlan() {
    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400">
                        Lesson Plan Management
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Create and manage lesson schedules</p>
                </div>
                <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold transition-all flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create Lesson Plan
                </button>
            </div>

            {/* Coming Soon Card */}
            <div className="text-center py-20">
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                        <div className="relative p-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 shadow-2xl">
                            <BookText className="h-16 w-16 text-white" />
                        </div>
                    </div>
                </div>

                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 mb-8">
                    <Sparkles className="h-5 w-5 text-orange-400" />
                    <span className="text-sm font-bold text-orange-300">Coming Soon</span>
                </div>

                <div className="max-w-2xl mx-auto bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                    <h3 className="text-xl font-bold text-white mb-4">Upcoming Features:</h3>
                    <ul className="space-y-3 text-slate-300 text-left">
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                            <span>Create comprehensive lesson plans and syllabi</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                            <span>Schedule topics and define learning objectives</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                            <span>Link resources and materials to each lesson</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                            <span>Track lesson progress and completion</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                            <span>Share lesson plans with students and parents</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
