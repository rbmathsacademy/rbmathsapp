'use client';

import { useEffect, useRef } from 'react';

interface TimeTrackerProps {
    pageName: 'assignments' | 'question-bank';
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function TimeTracker({ pageName }: TimeTrackerProps) {
    const lastActiveRef = useRef<number>(Date.now());
    const accumulatedSecondsRef = useRef<number>(0);
    const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isTrackingRef = useRef<boolean>(true);

    const updateBuffer = () => {
        if (accumulatedSecondsRef.current <= 0) return;

        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD local time
        
        // Read existing buffer
        const existingRaw = localStorage.getItem('timeTrackerBuffer');
        let buffer: any[] = [];
        if (existingRaw) {
            try {
                buffer = JSON.parse(existingRaw);
            } catch (e) {}
        }

        // Find existing entry for this page and date
        const existingEntryIndex = buffer.findIndex(e => e.pageName === pageName && e.date === date);
        if (existingEntryIndex >= 0) {
            buffer[existingEntryIndex].durationSeconds += accumulatedSecondsRef.current;
        } else {
            buffer.push({ pageName, date, durationSeconds: accumulatedSecondsRef.current });
        }

        localStorage.setItem('timeTrackerBuffer', JSON.stringify(buffer));
        accumulatedSecondsRef.current = 0; // Reset after buffering
    };

    const handleActivity = () => {
        lastActiveRef.current = Date.now();
        if (!isTrackingRef.current && document.visibilityState === 'visible') {
            isTrackingRef.current = true; // Resume tracking
        }
    };

    useEffect(() => {
        // Track time every second
        trackingIntervalRef.current = setInterval(() => {
            if (document.visibilityState !== 'visible') {
                isTrackingRef.current = false;
                return;
            }

            const now = Date.now();
            if (now - lastActiveRef.current > IDLE_TIMEOUT_MS) {
                // User is idle
                if (isTrackingRef.current) {
                    isTrackingRef.current = false;
                    updateBuffer(); // Save what we have before going idle
                }
                return;
            }

            if (isTrackingRef.current) {
                accumulatedSecondsRef.current += 1;
                
                // Flush to localStorage every 10 seconds just in case
                if (accumulatedSecondsRef.current >= 10) {
                    updateBuffer();
                }
            }
        }, 1000);

        // Listen for activity to reset idle timer
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);
        window.addEventListener('scroll', handleActivity);

        // Save immediately when hiding tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                updateBuffer();
            } else {
                handleActivity(); // Refresh active state
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('scroll', handleActivity);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            updateBuffer(); // Final flush on unmount
        };
    }, [pageName]);

    // Render nothing
    return null;
}
