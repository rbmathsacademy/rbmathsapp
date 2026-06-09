'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function TimeTrackerSync() {
    const pathname = usePathname();
    const lastPathRef = useRef<string>(pathname);

    const syncBuffer = async () => {
        const raw = localStorage.getItem('timeTrackerBuffer');
        if (!raw) return;
        
        let logs = [];
        try {
            logs = JSON.parse(raw);
        } catch (e) {
            return;
        }

        if (logs.length === 0) return;

        // Optimistically clear buffer to prevent duplicate sends
        localStorage.removeItem('timeTrackerBuffer');

        try {
            const res = await fetch('/api/student/time-tracker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs }),
                keepalive: true // Crucial for beforeunload/visibilitychange
            });
            
            if (!res.ok) {
                throw new Error('Failed to save');
            }
        } catch (e) {
            // If failed, put back in buffer
            const currentRaw = localStorage.getItem('timeTrackerBuffer');
            let currentLogs: any[] = [];
            if (currentRaw) {
                try { currentLogs = JSON.parse(currentRaw); } catch (ex) {}
            }
            
            // Merge back
            logs.forEach((oldLog: any) => {
                const idx = currentLogs.findIndex((c: any) => c.pageName === oldLog.pageName && c.date === oldLog.date);
                if (idx >= 0) {
                    currentLogs[idx].durationSeconds += oldLog.durationSeconds;
                } else {
                    currentLogs.push(oldLog);
                }
            });
            localStorage.setItem('timeTrackerBuffer', JSON.stringify(currentLogs));
        }
    };

    useEffect(() => {
        // Sync on route change
        if (lastPathRef.current !== pathname) {
            lastPathRef.current = pathname;
            syncBuffer();
        }
    }, [pathname]);

    useEffect(() => {
        // Sync on tab hide
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                syncBuffer();
            }
        };
        
        window.addEventListener('beforeunload', syncBuffer);
        document.addEventListener('visibilitychange', handleVisibility);

        // Initial sync on load to clear leftovers
        syncBuffer();

        return () => {
            window.removeEventListener('beforeunload', syncBuffer);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    return null;
}
