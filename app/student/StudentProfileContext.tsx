'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface StudentProfile {
    _id: string;
    studentName: string;
    courses: string[];
    phoneNumber: string;
}

interface StudentProfileContextType {
    profile: StudentProfile | null;
    loading: boolean;
    error: boolean;
}

const StudentProfileContext = createContext<StudentProfileContextType>({
    profile: null,
    loading: true,
    error: false,
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

    return (
        <StudentProfileContext.Provider value={{ profile, loading, error }}>
            {children}
        </StudentProfileContext.Provider>
    );
}
