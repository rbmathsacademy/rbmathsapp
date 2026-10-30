'use client';

import Link from 'next/link';
import { Lock, FileText, MessageSquare, LogOut } from 'lucide-react';
import { clearStudentCache } from '@/lib/studentCache';

export interface RedoLockItem { assignmentId: string; title: string; reason: string }

const logout = () => {
    document.cookie = 'auth_token=; Max-Age=0; path=/;';
    clearStudentCache();
    try { localStorage.clear(); } catch { }
    window.location.replace('/student/login');
};

/** Full-screen notice shown instead of any locked page. */
export function RedoLockScreen({ items }: { items: RedoLockItem[] }) {
    return (
        <div className="min-h-[100dvh] flex items-start sm:items-center justify-center px-4 py-8 bg-[#0b0718]">
            <div className="w-full max-w-lg rounded-2xl border border-rose-400/40 bg-[#140d27] shadow-[0_0_60px_-15px_rgba(244,63,94,0.6)] overflow-hidden">
                <div className="px-5 pt-6 pb-4 text-center bg-gradient-to-b from-rose-500/15 to-transparent">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center mb-3">
                        <Lock className="h-7 w-7 text-rose-300" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-white">Your portal is locked</h1>
                    <p className="mt-2 text-sm text-rose-100/90 leading-relaxed">
                        Your teacher has rejected {items.length === 1 ? 'an assignment' : `${items.length} assignments`} you submitted.
                        Until you make all the required changes and re-submit {items.length === 1 ? 'it' : 'them'}, every other feature of the portal stays locked.
                    </p>
                </div>

                <div className="px-5 pb-2 space-y-2">
                    {items.map(it => (
                        <div key={it.assignmentId} className="rounded-xl border border-rose-400/30 bg-rose-500/[0.08] px-3 py-2.5">
                            <p className="text-sm font-bold text-white flex items-center gap-2"><FileText className="h-4 w-4 text-rose-300 shrink-0" /> {it.title}</p>
                            {it.reason && <p className="mt-1 text-xs text-rose-100/80 italic break-words">Teacher&apos;s note: &quot;{it.reason}&quot;</p>}
                        </div>
                    ))}
                </div>

                <div className="px-5 py-4 space-y-2.5">
                    <p className="text-xs text-violet-200/70 text-center">
                        Open <b className="text-white">Assignments → Completed</b>, read the feedback, then tap <b className="text-white">Delete &amp; Re-submit</b> and choose your corrected PDF. Everything unlocks as soon as it is submitted.
                    </p>
                    <Link href="/student/assignments?tab=completed"
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 text-white font-black text-sm active:scale-[0.98] transition-transform">
                        <FileText className="h-4 w-4" /> Re-submit my assignment
                    </Link>
                    <Link href="/student/chat"
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm active:scale-[0.98] transition-transform">
                        <MessageSquare className="h-4 w-4" /> Ask a doubt in Student Chat
                    </Link>
                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-violet-200/50 hover:text-violet-200">
                        <LogOut className="h-3.5 w-3.5" /> Log out
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Slim banner on the pages that stay open (Assignments, Student Chat). */
export function RedoLockBanner({ items }: { items: RedoLockItem[] }) {
    return (
        <div className="sticky top-0 z-[60] bg-rose-600/95 backdrop-blur text-white px-3 py-2 text-[11px] sm:text-xs leading-snug shadow-lg">
            <div className="max-w-4xl mx-auto flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <p className="flex-1 min-w-0">
                    <b>Portal locked</b> until you re-submit: {items.map(i => i.title).join(', ')}.
                </p>
                <Link href="/student/assignments?tab=completed" className="shrink-0 px-2 py-1 rounded-md bg-white/20 font-bold">Re-submit</Link>
            </div>
        </div>
    );
}
