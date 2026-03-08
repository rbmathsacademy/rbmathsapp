'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { StudentProfileProvider } from './StudentProfileContext';

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // Prevent mobile back button from logging out
    useEffect(() => {
        // Skip on login page
        if (pathname === '/student/login') return;

        // Check if user has a valid session
        const hasSession = typeof window !== 'undefined' && (
            localStorage.getItem('studentName') ||
            document.cookie.includes('auth_token')
        );

        if (!hasSession) return;

        // Push an extra history entry so back button doesn't leave the app
        window.history.pushState(null, '', window.location.href);

        const handlePopState = () => {
            // Re-push current URL to trap the back button
            window.history.pushState(null, '', window.location.href);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [pathname]);

    return (
        <div className="min-h-screen flex flex-col bg-[#0a0f1a]">
            <StudentProfileProvider>
                <div className="flex-1 w-full">
                    {children}
                </div>
            </StudentProfileProvider>
            <footer className="py-4 text-center bg-[#0a0f1a] text-gray-500 border-t border-white/5 mt-auto z-10 relative">
                <p className="text-[10px] md:text-sm">&copy; 2026, RB Maths Academy || Coded and developed by Dr. Ritwick Banerjee</p>
            </footer>
        </div>
    );
}
