'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            localStorage.removeItem('user');
            router.push('/admin/login'); // Redirect to login
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <div className="min-h-screen bg-[#050b14] text-gray-200">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <ShieldCheck className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400">
                        Guardian Portal
                    </span>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-sm"
                >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                </button>
            </header>

            <main className="pt-20 px-4 sm:px-6 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
}
