
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import OnlineTest from '@/models/OnlineTest';
import Assignment from '@/models/Assignment';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import AssignmentSubmission from '@/models/AssignmentSubmission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const batch = searchParams.get('batch');

        if (!batch) {
            return NextResponse.json({ error: 'Batch is required' }, { status: 400 });
        }

        await dbConnect();

        // 1. Fetch Students in Batch with createdAt
        const students = await BatchStudent.find({ courses: batch })
            .select('name phoneNumber createdAt')
            .lean();

        if (!students.length) {
            return NextResponse.json({
                students: [],
                tests: [],
                assignments: [],
                analytics: []
            });
        }

        const studentPhones = students.map(s => s.phoneNumber);
        const studentIds = students.map(s => s._id);

        // 2. Fetch Online Tests for Batch
        const tests = await OnlineTest.find({
            'deployment.batches': batch,
            status: { $in: ['deployed', 'completed'] }
        })
            .select('title totalMarks deployment.startTime')
            .sort({ 'deployment.startTime': -1 })
            .lean();

        const testIds = tests.map(t => t._id);

        // 3. Fetch Assignments for Batch
        const assignments = await Assignment.find({ batch })
            .select('title deadline createdAt') // Added createdAt for assignments too
            .sort({ deadline: -1 })
            .lean();

        const assignmentIds = assignments.map(a => a._id);

        // 4. Fetch Student Attempts for these Tests
        const attempts = await StudentTestAttempt.find({
            testId: { $in: testIds },
            // We want ALL attempts for these tests to calculate highest score, not just for this batch's students (if tests are shared)
            // But usually highest score is per batch? 
            // "Highest marks vertical bar graphs for all the tests that the student has appeared in"
            // usually compares against the batch highest.
            studentPhone: { $in: studentPhones }
        })
            .select('testId studentPhone score percentage status submittedAt')
            .lean();

        // Calculate Highest Score and Average Score for each test (within this batch)
        const testStats: Record<string, { highest: number; totalScore: number; count: number }> = {};
        attempts.forEach((attempt: any) => {
            const tid = attempt.testId.toString();
            if (attempt.score !== undefined && attempt.score !== null) {
                if (!testStats[tid]) {
                    testStats[tid] = { highest: 0, totalScore: 0, count: 0 };
                }

                if (attempt.score > testStats[tid].highest) {
                    testStats[tid].highest = attempt.score;
                }
                testStats[tid].totalScore += attempt.score;
                testStats[tid].count += 1;
            }
        });

        // 5. Fetch Assignment Submissions
        const submissions = await AssignmentSubmission.find({
            assignment: { $in: assignmentIds },
            student: { $in: studentIds }
        })
            .select('assignment student status isLate submittedAt')
            .lean();

        // 6. Aggregate Data per Student
        const analytics = students.map((student: any) => {
            const studentCreatedAt = new Date(student.createdAt);

            // Test Analytics
            const studentAttempts = attempts.filter((a: any) => a.studentPhone === student.phoneNumber);

            const testScores = tests.map((test: any) => {
                const attempt = studentAttempts.find((a: any) => a.testId.toString() === test._id.toString());
                const testStartDate = new Date(test.deployment.startTime);

                // Determine Status:
                // - Completed/In Progress -> from attempt
                // - Not Attempted -> 
                //      - If joined AFTER test start -> 'not_enrolled' (ignore for missed count)
                //      - If joined BEFORE test start -> 'missed'
                let status = 'not_attempted';
                if (attempt) {
                    status = attempt.status;
                } else {
                    // Check enrollment date
                    // detailed check: if test started BEFORE student was created, they couldn't take it.
                    if (studentCreatedAt > testStartDate) {
                        status = 'not_enrolled';
                    } else {
                        status = 'missed';
                    }
                }

                return {
                    testId: test._id,
                    score: attempt ? attempt.score : null,
                    percentage: attempt ? attempt.percentage : null,
                    status: status, // 'completed', 'in_progress', 'missed', 'not_enrolled'
                    submittedAt: attempt ? attempt.submittedAt : null,
                    highestScore: testStats[test._id.toString()]?.highest || 0,
                    averageScore: testStats[test._id.toString()]?.count > 0
                        ? parseFloat((testStats[test._id.toString()].totalScore / testStats[test._id.toString()].count).toFixed(2))
                        : 0
                };
            });

            // Stats Calculation
            const attemptsCount = testScores.filter(t => t.status === 'completed' || t.status === 'in_progress').length;
            const missedTestCount = testScores.filter(t => t.status === 'missed').length;

            // Average only considers attempted tests
            const totalPercentage = testScores.reduce((sum, t) => sum + (t.percentage || 0), 0);
            const avgPercentage = attemptsCount > 0
                ? totalPercentage / attemptsCount
                : 0;

            // Assignment Analytics
            const studentSubmissions = submissions.filter((s: any) => s.student.toString() === student._id.toString());
            const assignmentStatuses = assignments.map((assignment: any) => {
                const submission = studentSubmissions.find((s: any) => s.assignment.toString() === assignment._id.toString());
                const assignmentDate = new Date(assignment.createdAt);
                const deadline = new Date(assignment.deadline);

                let status = 'PENDING';
                if (submission) {
                    status = submission.status === 'CORRECTED' ? 'CORRECTED' : (submission.isLate ? 'LATE_SUBMITTED' : 'SUBMITTED');
                } else {
                    const now = new Date();

                    if (studentCreatedAt > assignmentDate) {
                        // Student joined after assignment was created? 
                        // Usually for assignments, if the deadline hasn't passed, they can still do it.
                        // BUT if deadline passed AND they joined after creation (or after deadline?), should it count as missed?
                        // "if added after test deployment then it should not be considered as test missed"
                        // Let's apply similar logic: if they joined AFTER the deadline, they definitely couldn't do it.
                        // IF they joined BEFORE deadline but didn't submit -> Missed.

                        if (studentCreatedAt > deadline) {
                            status = 'NOT_ENROLLED';
                        } else if (now > deadline) {
                            status = 'MISSED';
                        }
                    } else {
                        // Normal case
                        if (now > deadline) status = 'MISSED';
                    }
                }

                return {
                    assignmentId: assignment._id,
                    status,
                    submittedAt: submission ? submission.submittedAt : null
                };
            });

            const submittedCount = assignmentStatuses.filter(a => ['SUBMITTED', 'LATE_SUBMITTED', 'CORRECTED'].includes(a.status)).length;
            const lateCount = assignmentStatuses.filter(a => a.status === 'LATE_SUBMITTED').length;
            const missedAssignmentCount = assignmentStatuses.filter(a => a.status === 'MISSED').length;

            // Completion rate: (Submitted / (Total - Not Enrolled)) * 100
            const validAssignments = assignmentStatuses.filter(a => a.status !== 'NOT_ENROLLED').length;
            const completionRate = validAssignments > 0 ? (submittedCount / validAssignments) * 100 : 0;

            return {
                student: {
                    _id: student._id,
                    name: student.name,
                    phoneNumber: student.phoneNumber,
                    joinedAt: student.createdAt
                },
                stats: {
                    avgTestPercentage: parseFloat(avgPercentage.toFixed(2)),
                    assignmentCompletionRate: parseFloat(completionRate.toFixed(2)),
                    testsAttempted: attemptsCount,
                    testsMissed: missedTestCount,
                    assignmentsSubmitted: submittedCount,
                    assignmentsLate: lateCount,
                    assignmentsMissed: missedAssignmentCount
                },
                tests: testScores,
                assignments: assignmentStatuses
            };
        });

        // Add Highest Scores and Average to test metadata for frontend
        const testsWithStats = tests.map((t: any) => ({ // Fix: using testsWithStats, not testsWithHighest
            ...t,
            highestScore: testStats[t._id.toString()]?.highest || 0,
            averageScore: testStats[t._id.toString()]?.count > 0
                ? parseFloat((testStats[t._id.toString()].totalScore / testStats[t._id.toString()].count).toFixed(2))
                : 0
        }));

        return NextResponse.json({
            batch,
            tests: testsWithStats,
            assignments,
            analytics
        });

    } catch (error: any) {
        console.error('Analytics API Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch analytics' }, { status: 500 });
    }
}
