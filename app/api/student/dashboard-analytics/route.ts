import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import OnlineTest from '@/models/OnlineTest';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        const token = req.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
        const phoneNumber = payload.phoneNumber as string;

        // 1. Get Student Details
        const student = await BatchStudent.findOne({ phoneNumber }).lean();
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }
        const studentCreatedAt = new Date(student.createdAt);

        // 2. Get Tests Data
        const tests = await OnlineTest.find({
            'deployment.batches': { $in: student.courses },
            status: { $in: ['deployed', 'completed'] }
        }).sort({ 'deployment.startTime': -1 }).lean();

        const testIds = tests.map(t => t._id);

        // Fetch ALL attempts for these tests to calculate highest/avg
        const allAttempts = await StudentTestAttempt.find({
            testId: { $in: testIds }
        }).select('testId score percentage studentPhone status').lean();

        // Calculate test stats
        const testStats: Record<string, { highest: number; totalScore: number; count: number }> = {};
        allAttempts.forEach(attempt => {
            const tid = attempt.testId.toString();
            if (attempt.score !== undefined && attempt.score !== null) {
                if (!testStats[tid]) {
                    testStats[tid] = { highest: 0, totalScore: 0, count: 0 };
                }
                if (attempt.score > testStats[tid].highest) testStats[tid].highest = attempt.score;
                testStats[tid].totalScore += attempt.score;
                testStats[tid].count += 1;
            }
        });

        const formattedTests = tests.map(test => {
            const attempt = allAttempts.find(a => a.testId.toString() === test._id.toString() && a.studentPhone === phoneNumber);
            const testStartTime = new Date(test.deployment.startTime);
            const testEndTime = new Date(test.deployment.endTime);

            let status = 'pending';
            if (attempt) {
                status = attempt.status;
            } else {
                if (studentCreatedAt > testStartTime) {
                    status = 'not_enrolled';
                } else if (new Date() > testEndTime) {
                    status = 'missed';
                }
            }

            return {
                testId: test._id,
                title: test.title,
                score: attempt ? attempt.score : null,
                totalMarks: test.totalMarks,
                percentage: attempt ? attempt.percentage : null,
                highestScore: testStats[test._id.toString()]?.highest || 0,
                averageScore: testStats[test._id.toString()]?.count > 0
                    ? parseFloat((testStats[test._id.toString()].totalScore / testStats[test._id.toString()].count).toFixed(2))
                    : 0,
                status: status,
                deploymentDate: test.deployment.startTime
            };
        });

        // 3. Get Assignments Data
        const assignments = await Assignment.find({
            batch: { $in: student.courses }
        }).sort({ deadline: -1 }).lean();

        const studentSubmissions = await AssignmentSubmission.find({ student: student._id }).lean();

        const formattedAssignments = assignments.map(assign => {
            const submission = studentSubmissions.find(s => s.assignment.toString() === assign._id.toString());
            const deadline = new Date(assign.deadline);
            const now = new Date();

            let status = 'PENDING';
            if (submission) {
                status = submission.status === 'CORRECTED' ? 'CORRECTED' : (submission.isLate ? 'LATE_SUBMITTED' : 'SUBMITTED');
            } else {
                if (studentCreatedAt > deadline) {
                    status = 'NOT_ENROLLED';
                } else if (now > deadline) {
                    status = 'MISSED';
                }
            }

            return {
                assignmentId: assign._id,
                title: assign.title,
                deadline: assign.deadline,
                status: status,
                submittedAt: submission ? (submission as any).submittedAt : null
            };
        });

        // 4. Calculate Summary Stats
        const attemptedTests = formattedTests.filter(t => t.status === 'completed' || t.status === 'in_progress').length;
        const missedTests = formattedTests.filter(t => t.status === 'missed').length;
        const totalPercentage = formattedTests.reduce((sum, t) => sum + (t.percentage || 0), 0);
        const avgPercentage = attemptedTests > 0 ? (totalPercentage / attemptedTests) : 0;

        const submittedAssignments = formattedAssignments.filter(a => ['SUBMITTED', 'LATE_SUBMITTED', 'CORRECTED'].includes(a.status)).length;
        const missedAssignments = formattedAssignments.filter(a => a.status === 'MISSED').length;

        return NextResponse.json({
            student: {
                name: student.name,
                phoneNumber: student.phoneNumber,
                courses: student.courses,
                joinedAt: student.createdAt
            },
            stats: {
                avgTestPercentage: parseFloat(avgPercentage.toFixed(2)),
                testsAttempted: attemptedTests,
                testsMissed: missedTests,
                assignmentsSubmitted: submittedAssignments,
                assignmentsMissed: missedAssignments
            },
            tests: formattedTests,
            assignments: formattedAssignments
        });

    } catch (error: any) {
        console.error("Dashboard Analytics Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
