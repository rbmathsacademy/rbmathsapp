'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const FREE_BATCH = 'Class XI (Free batch) 2026-27';

interface StudentProfile {
    _id: string;
    studentName: string;
    courses: string[];
    phoneNumber: string;
    schoolName: string | null;
    board: string | null;
}

interface StudentProfileContextType {
    profile: StudentProfile | null;
    loading: boolean;
    error: boolean;
    isFreeBatchOnly: boolean;
    updateProfile: (schoolName: string, board: string) => void;
}

const StudentProfileContext = createContext<StudentProfileContextType>({
    profile: null,
    loading: true,
    error: false,
    isFreeBatchOnly: false,
    updateProfile: () => {},
});

export function useStudentProfile() {
    return useContext(StudentProfileContext);
}

export function StudentProfileProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/student/me');
                if (!res.ok) {
                    setError(true);
                    return;
                }
                const data = await res.json();
                setProfile(data);
            } catch (e) {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const updateProfile = (schoolName: string, board: string) => {
        if (profile) {
            setProfile({ ...profile, schoolName, board });
        }
    };

    const isFreeBatchOnly = !!(profile && profile.courses && profile.courses.length > 0
        && profile.courses.every(c => c.trim().toLowerCase() === FREE_BATCH.trim().toLowerCase()));

    return (
        <StudentProfileContext.Provider value={{ profile, loading, error, isFreeBatchOnly, updateProfile }}>
            {children}
        </StudentProfileContext.Provider>
    );
}

