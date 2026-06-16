'use client';

import { useEffect } from 'react';

export default function TimeTrackerSync() {
    useEffect(() => {
        // On mount, flush any leftover buffer data from a previous session
        // (e.g. browser crash, tab killed before sync completed)
        const flushLeftovers = async () => {
            const raw = localStorage.getItem('timeTrackerBuffer');
            if (!raw) return;

            let logs: any[] = [];
            try { logs = JSON.parse(raw); } catch (e) { return; }
            if (logs.length === 0) return;

            localStorage.removeItem('timeTrackerBuffer');

            try {
                const res = await fetch('/api/student/time-tracker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ logs }),
                });

                if (!res.ok) throw new Error('Failed');
            } catch (e) {
                // Restore on failure
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
        };

        // Small delay to not block initial render
        const timer = setTimeout(flushLeftovers, 2000);
        return () => clearTimeout(timer);
    }, []);

    return null;
}
