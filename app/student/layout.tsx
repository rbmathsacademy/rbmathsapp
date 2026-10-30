'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { StudentProfileProvider, useStudentProfile } from './StudentProfileContext';
import SchoolBoardModal from './SchoolBoardModal';
import CollegeNameModal from './CollegeNameModal';

import SurveyPopupModal from './components/SurveyPopupModal';
import NotificationPopupModal from './components/NotificationPopupModal';
import { RedoLockScreen, RedoLockBanner } from './components/RedoLock';
import '../portal-theme.css';

// Helper: check if student belongs to a school batch (contains "class")
function isSchoolBatch(courses: string[]): boolean {
    return courses.some(c => /class/i.test(c));
}

// Helper: check if student belongs to target college batches
function isTargetCollegeBatch(courses: string[]): boolean {
    const keywords = ['sem', 'major', 'minor', 'bca', 'engg', 'engineering'];
    return courses.some(c => {
        const lowerC = c.toLowerCase();
        return keywords.some(kw => lowerC.includes(kw));
    });
}

// Pages a student with a rejected assignment can still use (to re-submit it, and to ask doubts)
const REDO_OPEN_PATHS = ['/student/assignments', '/student/chat'];

/** A rejected assignment locks the rest of the portal until it is re-submitted. */
function RedoLockGate({ children }: { children: React.ReactNode }) {
    const { profile } = useStudentProfile();
    const pathname = usePathname() || '';
    const items = profile?.redoLock || [];
    if (items.length === 0) return <>{children}</>;
    const open = REDO_OPEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
    if (!open) return <RedoLockScreen items={items} />;
    if (pathname.startsWith('/student/chat')) {
        // The chat fills the screen: fit it under the banner so its message box stays on screen
        return (
            <div className="h-[100svh] flex flex-col">
                <style>{'.redo-chat-fit > div { height: 100% !important; }'}</style>
                <RedoLockBanner items={items} />
                <div className="redo-chat-fit flex-1 min-h-0">{children}</div>
            </div>
        );
    }
    return <><RedoLockBanner items={items} />{children}</>;
}

function SurveyGate({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useStudentProfile();
    const [surveys, setSurveys] = useState<any[]>([]);
    const [surveyLoading, setSurveyLoading] = useState(true);

    const fetchSurveys = async () => {
        try {
            const res = await fetch('/api/student/surveys');
            if (res.ok) {
                const data = await res.json();
                setSurveys(data.surveys || []);
            }
        } catch (error) {
            console.error('Failed to fetch surveys:', error);
        } finally {
            setSurveyLoading(false);
        }
    };

    useEffect(() => {
        // no survey popups while the portal is locked for a re-submission
        if (!loading && profile && profile._id !== 'GUEST' && !(profile.redoLock || []).length) {
            fetchSurveys();
        } else if (!loading) {
            setSurveyLoading(false);
        }
    }, [loading, profile]);

    const activeSurvey = surveys.length > 0 ? surveys[0] : null;

    return (
        <>
            {activeSurvey && !surveyLoading && (
                <SurveyPopupModal 
                    survey={activeSurvey} 
                    onComplete={() => fetchSurveys()} 
                />
            )}
            {children}
        </>
    );
}

function NotificationGate({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useStudentProfile();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [notifLoading, setNotifLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/student/notifications', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data || []);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setNotifLoading(false);
        }
    };

    useEffect(() => {
        if (!loading && profile && profile._id !== 'GUEST') {
            fetchNotifications();
        } else if (!loading) {
            setNotifLoading(false);
        }
    }, [loading, profile]);

    const activeNotif = notifications.length > 0 ? notifications[0] : null;

    return (
        <>
            {activeNotif && !notifLoading && (
                <NotificationPopupModal 
                    notification={activeNotif} 
                    onComplete={() => {
                        // Personal popups (warnings, redo requests) are shown once: tell the server it was read
                        if (activeNotif?.oncePerStudent) {
                            fetch('/api/student/notifications/read', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ notificationId: activeNotif._id }),
                            }).catch(() => { });
                        }
                        setNotifications(prev => prev.slice(1));
                    }}
                />
            )}
            {children}
        </>
    );
}

function SchoolBoardGate({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useStudentProfile();

    // Determine if we need to show the modal
    const needsSchoolBoard = !loading && profile && profile._id !== 'GUEST'
        && isSchoolBatch(profile.courses || [])
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

function CollegeNameGate({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useStudentProfile();

    const needsCollegeName = !loading && profile && profile._id !== 'GUEST'
        && isTargetCollegeBatch(profile.courses || [])
        && !profile.collegeName;

    return (
        <>
            {needsCollegeName && <CollegeNameModalWrapper />}
            {children}
        </>
    );
}

function CollegeNameModalWrapper() {
    const { updateProfile, profile } = useStudentProfile();
    return (
        <CollegeNameModal
            onComplete={(collegeName) => {
                updateProfile(profile?.schoolName || '', profile?.board || '', collegeName);
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
        <div className="min-h-screen flex flex-col bg-[#0b0718]">
            <StudentProfileProvider>
                <div className="flex-1 w-full">
                    {isLoginPage ? children : (
                        <CollegeNameGate>
                        <SchoolBoardGate>
                            <SurveyGate>
                                <NotificationGate>
                                    <RedoLockGate>{children}</RedoLockGate>
                                </NotificationGate>
                            </SurveyGate>
                        </SchoolBoardGate>
                        </CollegeNameGate>
                    )}
                </div>
            </StudentProfileProvider>
            {pathname !== '/student/chat' && (
                <footer className="py-4 text-center bg-[#0b0718] text-violet-200/50 shadow-[0_-1px_0_0_rgba(217,70,239,0.18)] mt-auto z-10 relative shrink-0">
                    <p className="text-[10px] md:text-sm">&copy; 2026, RB Maths Academy || Coded and developed by Dr. Ritwick Banerjee</p>
                </footer>
            )}
        </div>
    );
}
