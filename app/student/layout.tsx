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

    // Ensure user session triggers rerender or context use if necessary
    useEffect(() => {
        // Skip on login page
        if (pathname === '/student/login') return;

        // Note: The actual redirect now happens elegantly inside /student/login 
        // if user history navigates back, to prevent aggressive trapping.
    }, [pathname]);

    return (
        <div className="min-h-screen flex flex-col bg-[#0a0f1a]">
            <StudentProfileProvider>
                <div className="flex-1 w-full">
                    {children}
                </div>
            </StudentProfileProvider>
            {pathname !== '/student/chat' && (
                <footer className="py-4 text-center bg-[#0a0f1a] text-gray-500 border-t border-white/5 mt-auto z-10 relative shrink-0">
                    <p className="text-[10px] md:text-sm">&copy; 2026, RB Maths Academy || Coded and developed by Dr. Ritwick Banerjee</p>
                </footer>
            )}
        </div>
    );
}
