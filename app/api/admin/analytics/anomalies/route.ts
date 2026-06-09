import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import BatchStudent from '@/models/BatchStudent';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import OfflineExam from '@/models/OfflineExam';
import Config from '@/models/Config';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const batch = searchParams.get('batch');
        if (!batch) return NextResponse.json({ error: 'Batch is required' }, { status: 400 });

        // Get Gap Threshold setting
        const config = await Config.findOne({ key: 'anomaly_settings' }).lean();
        const gapThreshold = (config as any)?.value?.gapThreshold || 25;

        // Fetch students
        const students = await BatchStudent.find({ courses: batch }).lean();
        
        // Fetch online tests and attempts
        const onlineTests = await OnlineTest.find({
            status: { $in: ['deployed', 'completed'] },
            'deployment.batches': batch
        }).sort({ 'deployment.startTime': -1 }).lean(); // Newest first

        const testIds = onlineTests.map(t => t._id);
        const allAttempts = await StudentTestAttempt.find({
            testId: { $in: testIds },
            status: 'completed'
        }).lean();

        // Fetch offline exams
        const offlineExams = await OfflineExam.find({ batch }).sort({ testDate: -1 }).lean();

        const malpracticeAlerts: any[] = [];
        const deterioratingAlerts: any[] = [];
        const poorPerformanceAlerts: any[] = [];

        for (const student of students) {
            const phone = (student as any).phoneNumber;
            const name = (student as any).name;
            const studentId = (student as any)._id.toString();

            // 1. Process Online Tests
            const studentAttempts = allAttempts.filter(a => a.studentPhone === phone);
            
            let totalOnlinePercentage = 0;
            const onlineDataPoints: any[] = []; // Chronological

            // We iterate onlineTests from oldest to newest to build chronological trend
            const chronologicalTests = [...onlineTests].reverse();
            for (const test of chronologicalTests) {
                const attempt = studentAttempts.find(a => a.testId.toString() === test._id.toString());
                if (attempt && attempt.percentage != null) {
                    totalOnlinePercentage += attempt.percentage;
                    onlineDataPoints.push({
                        title: test.title,
                        percentage: attempt.percentage,
                        date: attempt.submittedAt || new Date()
                    });
                }
            }
            
            const onlineAvg = onlineDataPoints.length > 0 
                ? totalOnlinePercentage / onlineDataPoints.length 
                : null;

            // 2. Process Offline Exams
            let totalOfflinePercentage = 0;
            let offlineCount = 0;
            const offlineDataPoints: any[] = [];

            for (const exam of offlineExams) {
                const res = exam.results.find((r: any) => r.studentId.toString() === studentId || r.studentPhone === phone);
                if (res && typeof res.percentage === 'number' && !isNaN(res.percentage)) {
                    totalOfflinePercentage += res.percentage;
                    offlineCount++;
                    offlineDataPoints.push({
                        chapter: exam.chapterName,
                        percentage: res.percentage
                    });
                }
            }

            const offlineAvg = offlineCount > 0 ? totalOfflinePercentage / offlineCount : null;

            // --- A. Malpractice Detection ---
            if (onlineAvg !== null && offlineAvg !== null && onlineDataPoints.length >= 2 && offlineCount >= 2) {
                const gap = onlineAvg - offlineAvg;
                if (gap > gapThreshold) {
                    malpracticeAlerts.push({
                        student: { name, phone },
                        onlineAvg: Math.round(onlineAvg * 10) / 10,
                        offlineAvg: Math.round(offlineAvg * 10) / 10,
                        gap: Math.round(gap * 10) / 10,
                        severity: gap > (gapThreshold + 15) ? 'CRITICAL' : 'WARNING',
                        onlineTests: onlineDataPoints.slice(-3).reverse(), // Show latest 3
                        offlineTests: offlineDataPoints.slice(0, 3) // Show latest 3
                    });
                }
            }

            // --- B. Deteriorating Performance ---
            if (onlineDataPoints.length >= 3) {
                const recent = onlineDataPoints.slice(-5); // Look at last 5
                const percentages = recent.map(d => d.percentage);
                
                let isDeteriorating = false;
                let dropPercentage = 0;

                // Check for 3 consecutive drops
                let consecutiveDrops = 0;
                for (let i = 1; i < percentages.length; i++) {
                    if (percentages[i] < percentages[i-1] - 2) { // 2% buffer
                        consecutiveDrops++;
                        if (consecutiveDrops >= 3) isDeteriorating = true;
                    } else {
                        consecutiveDrops = 0;
                    }
                }

                // Check overall drop
                if (!isDeteriorating && percentages.length >= 3) {
                    const firstHalfAvg = (percentages[0] + percentages[1]) / 2;
                    const lastScore = percentages[percentages.length - 1];
                    if (firstHalfAvg - lastScore > 15) {
                        isDeteriorating = true;
                    }
                }

                if (isDeteriorating) {
                    dropPercentage = percentages[0] - percentages[percentages.length - 1];
                    deterioratingAlerts.push({
                        student: { name, phone },
                        recentScores: percentages,
                        dropPercentage: Math.round(dropPercentage * 10) / 10,
                        tests: recent.reverse() // Show newest first in UI
                    });
                }
            }

            // --- C. Consistently Poor ---
            if (onlineDataPoints.length >= 3 && onlineAvg !== null && onlineAvg < 30) {
                poorPerformanceAlerts.push({
                    student: { name, phone },
                    avgPercentage: Math.round(onlineAvg * 10) / 10,
                    testsAttempted: onlineDataPoints.length,
                    testsMissed: onlineTests.length - onlineDataPoints.length
                });
            }
        }

        // Sort alerts by severity
        malpracticeAlerts.sort((a, b) => b.gap - a.gap);
        deterioratingAlerts.sort((a, b) => b.dropPercentage - a.dropPercentage);
        poorPerformanceAlerts.sort((a, b) => a.avgPercentage - b.avgPercentage); // Lowest avg first

        return NextResponse.json({
            malpracticeAlerts,
            deterioratingAlerts,
            poorPerformanceAlerts,
            settings: { gapThreshold }
        });

    } catch (error) {
        console.error('Error in anomaly detection:', error);
        return NextResponse.json({ error: 'Failed to run anomaly detection' }, { status: 500 });
    }
}
