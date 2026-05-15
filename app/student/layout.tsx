'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { StudentProfileProvider, useStudentProfile } from './StudentProfileContext';
import SchoolBoardModal from './SchoolBoardModal';

// Helper: check if student belongs to Class XI or Class XII batch
function isClassXIorXII(courses: string[]): boolean {
    return courses.some(c => /class\s*x(i|ii)\b/i.test(c));
}

function SchoolBoardGate({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useStudentProfile();

    // Determine if we need to show the modal
    const needsSchoolBoard = !loading && profile && profile._id !== 'GUEST'
        && isClassXIorXII(profile.courses || [])
        && (!profile.schoolName || !profile.board);

    const handleComplete = (schoolName: string, board: string) => {
        // The context updateProfile is called from within
        // We do a small trick: update via context
        // Actually, let's use the context method
    };

    // We need access to updateProfile from context
    return (
        <>
            {needsSchoolBoard && <SchoolBoardModalWrapper />}
            {children}
        </>
    );
}

function SchoolBoardModalWrapper() {
    const { updateProfile } = useStudentProfile();
    return (
        <SchoolBoardModal
            onComplete={(schoolName, board) => {
                updateProfile(schoolName, board);
            }}
        />
    );
}

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    useEffect(() => {
        if (pathname === '/student/login') return;
    }, [pathname]);

    const isLoginPage = pathname === '/student/login';

    return (
        <div className="min-h-screen flex flex-col bg-[#0a0f1a]">
            <StudentProfileProvider>
                <div className="flex-1 w-full">
                    {isLoginPage ? children : (
                        <SchoolBoardGate>
                            {children}
                        </SchoolBoardGate>
                    )}
                </div>
            </StudentProfileProvider>
            {pathname !== '/student/chat' && (
                <footer className="py-4 text-center bg-[#0a0f1a] text-gray-500 shadow-[0_-1px_0_0_rgba(255,255,255,0.05)] mt-auto z-10 relative shrink-0">
                    <p className="text-[10px] md:text-sm">&copy; 2026, RB Maths Academy || Coded and developed by Dr. Ritwick Banerjee</p>
                </footer>
            )}
        </div>
    );
}
