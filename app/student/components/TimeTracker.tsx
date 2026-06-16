'use client';

import { useEffect, useRef, useCallback } from 'react';

interface TimeTrackerProps {
    pageName: 'assignments' | 'question-bank';
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const SYNC_INTERVAL_MS = 60 * 1000; // Sync to server every 60 seconds

export default function TimeTracker({ pageName }: TimeTrackerProps) {
    const lastActiveRef = useRef<number>(Date.now());
    const accumulatedSecondsRef = useRef<number>(0);
    const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isTrackingRef = useRef<boolean>(true);
    const mountedRef = useRef<boolean>(true);

    // Flush accumulated seconds into localStorage buffer
    const flushToBuffer = useCallback(() => {
        if (accumulatedSecondsRef.current <= 0) return;

        const date = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone

        const existingRaw = localStorage.getItem('timeTrackerBuffer');
        let buffer: any[] = [];
        if (existingRaw) {
            try { buffer = JSON.parse(existingRaw); } catch (e) { buffer = []; }
        }

        const existingEntryIndex = buffer.findIndex(e => e.pageName === pageName && e.date === date);
        if (existingEntryIndex >= 0) {
            buffer[existingEntryIndex].durationSeconds += accumulatedSecondsRef.current;
        } else {
            buffer.push({ pageName, date, durationSeconds: accumulatedSecondsRef.current });
        }

        localStorage.setItem('timeTrackerBuffer', JSON.stringify(buffer));
        accumulatedSecondsRef.current = 0;
    }, [pageName]);

    // Push localStorage buffer to the server
    const syncToServer = useCallback(async () => {
        // First flush any pending seconds to the buffer
        flushToBuffer();

        const raw = localStorage.getItem('timeTrackerBuffer');
        if (!raw) return;

        let logs: any[] = [];
        try { logs = JSON.parse(raw); } catch (e) { return; }
        if (logs.length === 0) return;

        // Optimistically clear to prevent duplicate sends
        localStorage.removeItem('timeTrackerBuffer');

        try {
            const res = await fetch('/api/student/time-tracker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs }),
                keepalive: true
            });

            if (!res.ok) throw new Error('Sync failed');
        } catch (e) {
            // If failed, restore the logs to the buffer (merge with anything new)
            const currentRaw = localStorage.getItem('timeTrackerBuffer');
            let currentLogs: any[] = [];
            if (currentRaw) {
                try { currentLogs = JSON.parse(currentRaw); } catch (ex) {}
            }

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
    }, [flushToBuffer]);

    const handleActivity = useCallback(() => {
        lastActiveRef.current = Date.now();
        if (!isTrackingRef.current && document.visibilityState === 'visible') {
            isTrackingRef.current = true;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        // 1-second interval to count active time
        trackingIntervalRef.current = setInterval(() => {
            if (document.visibilityState !== 'visible') {
                if (isTrackingRef.current) {
                    isTrackingRef.current = false;
                    flushToBuffer();
                }
                return;
            }

            const now = Date.now();
            if (now - lastActiveRef.current > IDLE_TIMEOUT_MS) {
                if (isTrackingRef.current) {
                    isTrackingRef.current = false;
                    flushToBuffer();
                }
                return;
            }

            if (isTrackingRef.current) {
                accumulatedSecondsRef.current += 1;
            }
        }, 1000);

        // Periodic server sync every 30 seconds — the critical improvement
        syncIntervalRef.current = setInterval(() => {
            syncToServer();
        }, SYNC_INTERVAL_MS);

        // Activity listeners — including touch events for mobile!
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'touchmove'];
        events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));

        // Visibility change handler
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                syncToServer(); // Attempt a sync when tab hides
            } else {
                handleActivity();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // beforeunload handler (best-effort)
        const handleBeforeUnload = () => {
            flushToBuffer();
            // Use sendBeacon as it's more reliable than fetch on page unload
            const raw = localStorage.getItem('timeTrackerBuffer');
            if (raw) {
                const logs = JSON.parse(raw);
                if (logs.length > 0) {
                    const sent = navigator.sendBeacon(
                        '/api/student/time-tracker',
                        new Blob([JSON.stringify({ logs })], { type: 'application/json' })
                    );
                    if (sent) {
                        localStorage.removeItem('timeTrackerBuffer');
                    }
                }
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            mountedRef.current = false;
            if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            events.forEach(evt => window.removeEventListener(evt, handleActivity));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Final sync on unmount (e.g. navigating away within the SPA)
            syncToServer();
        };
    }, [pageName, flushToBuffer, syncToServer, handleActivity]);

    return null;
}
