import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import Assignment from '@/models/Assignment';
import StudentAssignment from '@/models/StudentAssignment';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const phoneNumber = req.headers.get('x-user-phone');

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Find the Student
        const student = await BatchStudent.findOne({ phoneNumber });
        if (!student) {
            return NextResponse.json({ error: 'Student record not found associated with this account' }, { status: 404 });
        }

        // 2. Fetch Data (Reused logic from Admin Analytics but tailored)

        // Find tests in student's batch(es)
        // Note: BatchStudent stores courses, OnlineTest stores batches. Assuming course matches batch name.
        const tests = await OnlineTest.find({
            batches: { $in: student.courses },
            status: { $ne: 'draft' } // Only deployed/completed
        }).sort({ 'deployment.startTime': -1 }).lean();

        // Attempts
        const attempts = await StudentTestAttempt.find({
            student: student._id,
            test: { $in: tests.map(t => t._id) }
        }).lean();

        // Assignments
        const assignments = await Assignment.find({
            batches: { $in: student.courses },
            status: 'published'
        }).sort({ deadline: -1 }).lean();

        const submissions = await StudentAssignment.find({
            student: student._id,
            assignment: { $in: assignments.map(a => a._id) }
        }).lean();

        // Process Data
        const testData = tests.map(test => {
            const attempt = attempts.find(a => a.test.toString() === test._id.toString());
            let status = 'not_attempted';
            if (attempt) status = attempt.status;
            else if (new Date() > new Date(test.deployment.endTime)) status = 'missed';

            return {
                testId: test._id,
                title: test.title,
                totalMarks: test.totalMarks,
                score: attempt?.score || null,
                percentage: attempt ? ((attempt.score / test.totalMarks) * 100).toFixed(1) : null,
                highestScore: 0, // Need to calculate if we want to show it? Let's skip heavy stats for speed or do separate aggregation
                averageScore: 0,
                status,
                deploymentDate: test.deployment.startTime
            };
        });

        // Calculate Stats (Topper/Avg) - Optional: Can be expensive. 
        // For now, let's keep it simple or do a quick aggregation if needed. 
        // Let's assume the parent just wants THEIR child's report.
        // We can add "Batch Average" if we want.

        // Let's add simple Batch Avg for context
        for (const t of testData) {
            const allAttempts = await StudentTestAttempt.find({ test: t.testId }).select('score');
            if (allAttempts.length > 0) {
                const scores = allAttempts.map(a => a.score);
                const max = Math.max(...scores);
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                t.highestScore = max;
                t.averageScore = parseFloat(avg.toFixed(1));
            }
        }

        const assignmentData = assignments.map(assign => {
            const sub = submissions.find(s => s.assignment.toString() === assign._id.toString());
            let status = 'pending';
            if (sub) status = sub.status; // submitted, graded
            else if (new Date() > new Date(assign.deadline)) status = 'missed';

            return {
                assignmentId: assign._id,
                title: assign.title,
                deadline: assign.deadline,
                status,
                submittedAt: sub?.submittedAt
            };
        });

        return NextResponse.json({
            student: {
                name: student.name,
                phoneNumber: student.phoneNumber,
                courses: student.courses
            },
            tests: testData,
            assignments: assignmentData
        });

    } catch (error: any) {
        console.error('Guardian analytics error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
