import { isOutOfScope } from '@/lib/assignmentScope';
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import OnlineTest from '@/models/OnlineTest';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import OfflineExam from '@/models/OfflineExam';
import SchoolExam from '@/models/SchoolExam';
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
        const student = await BatchStudent.findOne({ phoneNumber }).select('name phoneNumber courses createdAt').lean();
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }
        const studentCreatedAt = student.createdAt ? new Date(student.createdAt) : new Date(parseInt(student._id.toString().slice(0, 8), 16) * 1000);

        // Optional batch filter — scope data to a single batch
        const batchParam = req.nextUrl.searchParams.get('batch');
        const targetBatches = batchParam ? [batchParam] : student.courses;

        // 2. Get Tests Data
        const allTests = await OnlineTest.find({
            'deployment.batches': { $in: targetBatches },
            status: { $in: ['deployed', 'completed'] }
        }).select('title totalMarks deployment.startTime deployment.endTime deployment.students.phoneNumber excludedStudents') // not the question papers
            .sort({ 'deployment.startTime': -1 }).lean();

        // Filter out tests where this student is excluded OR is not in a specific-student deployment
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const tests = allTests.filter((t: any) => {
            // Excluded students check
            const excluded: string[] = (t.excludedStudents || []).map((p: string) => p.replace(/\D/g, ''));
            if (excluded.includes(cleanPhone)) return false;

            // If the test was deployed to specific students (not all batch members),
            // only include it if this student is in that list
            if (t.deployment?.students && t.deployment.students.length > 0) {
                const specificPhones = t.deployment.students.map((s: any) => s.phoneNumber.replace(/\D/g, ''));
                if (!specificPhones.includes(cleanPhone)) return false;
            }

            return true;
        });

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

        const myAttempts = new Map<string, any>();
        for (const a of allAttempts) if (a.studentPhone === phoneNumber) myAttempts.set(a.testId.toString(), a);

        const formattedTests = tests.map(test => {
            const attempt = myAttempts.get(test._id.toString());
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
        const allAssignments = await Assignment.find({
            batch: { $in: targetBatches }
        }).select('title deadline scheduledFor excludedStudents targetStudents').sort({ deadline: -1 }).lean();

        // Filter out assignments where this student is excluded
        const assignments = allAssignments.filter((a: any) => !isOutOfScope(a, phoneNumber));

        const studentSubmissions = await AssignmentSubmission.find({ student: student._id }).select('assignment status isLate overrideOnTime submittedAt quality').lean();
        const submissionByAssignment = new Map<string, any>(studentSubmissions.map((s: any) => [s.assignment.toString(), s]));

        const formattedAssignments = assignments.map(assign => {
            const submission = submissionByAssignment.get(assign._id.toString());
            const deadline = new Date(assign.deadline);
            const now = new Date();

            let status = 'PENDING';
            const scheduledFor = assign.scheduledFor ? new Date(assign.scheduledFor) : null;
            if (submission) {
                status = submission.status === 'CORRECTED' ? 'CORRECTED' : ((submission as any).overrideOnTime ? 'SUBMITTED' : (submission.isLate ? 'LATE_SUBMITTED' : 'SUBMITTED'));
            } else if (scheduledFor && now < scheduledFor) {
                status = 'SCHEDULED';
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
                submittedAt: submission ? (submission as any).submittedAt : null,
                quality: submission ? (submission as any).quality : null
            };
        });

        // 4. Calculate Summary Stats
        const attemptedTests = formattedTests.filter(t => t.status === 'completed' || t.status === 'in_progress').length;
        const missedTests = formattedTests.filter(t => t.status === 'missed').length;
        const totalPercentage = formattedTests.reduce((sum, t) => sum + (t.percentage || 0), 0);
        const avgPercentage = attemptedTests > 0 ? (totalPercentage / attemptedTests) : 0;

        const submittedAssignments = formattedAssignments.filter(a => ['SUBMITTED', 'LATE_SUBMITTED', 'CORRECTED'].includes(a.status)).length;
        const missedAssignments = formattedAssignments.filter(a => a.status === 'MISSED').length;

        // 5. Get Offline Exam Data
        const offlineExams = await OfflineExam.find({
            batch: { $in: targetBatches }
        }).sort({ testDate: -1 }).lean();

        const formattedOfflineExams = offlineExams.map((exam: any) => {
            const studentResult = exam.results.find((r: any) => r.studentPhone === phoneNumber);
            if (!studentResult) return null;

            const validResults: any[] = [];
            exam.results.forEach((r: any) => {
                const numericPct = typeof r.percentage === 'number' ? r.percentage : parseFloat(r.percentage);
                const numericMarks = typeof r.marksObtained === 'number' ? r.marksObtained : parseFloat(r.marksObtained);
                if (!isNaN(numericPct)) {
                    validResults.push({ ...r, numericMarks, numericPct });
                }
            });

            // True Batch Rank based purely on marks (Standard Competition Rank)
            const allPercentages = validResults.map(r => r.numericPct);
            const sortedPercentages = [...allPercentages].sort((a, b) => b - a);
            
            let rank: number | string = '-';
            const studentPct = typeof studentResult.percentage === 'number' ? studentResult.percentage : parseFloat(studentResult.percentage);
            if (!isNaN(studentPct)) {
                rank = sortedPercentages.indexOf(studentPct) + 1;
            }

            const highestPercentage = allPercentages.length > 0 ? Math.max(...allPercentages) : 0;
            const averagePercentage = allPercentages.length > 0 
                ? parseFloat((allPercentages.reduce((sum, p) => sum + p, 0) / allPercentages.length).toFixed(2))
                : 0;

            return {
                examId: exam._id,
                batch: exam.batch,
                chapterName: exam.chapterName,
                testDate: exam.testDate,
                fullMarks: exam.fullMarks,
                marksObtained: studentResult.marksObtained,
                percentage: studentResult.percentage,
                highestPercentage,
                averagePercentage,
                rank,
                totalStudents: validResults.length
            };
        }).filter(Boolean);

        
        // 6. Get School Exam Data and correlate
        const schoolExams = await SchoolExam.find({ studentPhone: phoneNumber }).sort({ date: -1 }).lean();
        const formattedSchoolExams = schoolExams.map((exam: any) => {
            const examDate = new Date(exam.date);
            
            // Prior Online Tests
            const priorOnlineTests = formattedTests.filter((t: any) => 
                t.status === 'completed' && t.percentage !== null && new Date(t.deploymentDate) < examDate
            );
            const avgOnline = priorOnlineTests.length > 0 
                ? priorOnlineTests.reduce((sum: number, t: any) => sum + (t.percentage || 0), 0) / priorOnlineTests.length 
                : 0;

            // Prior Offline Exams
            const priorOfflineExams = formattedOfflineExams.filter((t: any) => 
                new Date(t.testDate) < examDate && typeof t.percentage === 'number'
            );
            const avgOffline = priorOfflineExams.length > 0
                ? priorOfflineExams.reduce((sum: number, t: any) => sum + (t.percentage || 0), 0) / priorOfflineExams.length
                : 0;

            // Prior Assignments
            const priorAssignments = formattedAssignments.filter((a: any) => 
                a.submittedAt && new Date(a.submittedAt) < examDate && a.quality
            );
            
            let assignScore = 0;
            if (priorAssignments.length > 0) {
                let total = 0;
                priorAssignments.forEach((a: any) => {
                    if (a.quality === 'GOOD') total += 100;
                    else if (a.quality === 'SATISFACTORY') total += 60;
                });
                assignScore = total / priorAssignments.length;
            }

            let systemAvg = 0;
            let weights = 0;
            if (priorOnlineTests.length > 0) { systemAvg += avgOnline * 0.35; weights += 0.35; }
            if (priorOfflineExams.length > 0) { systemAvg += avgOffline * 0.60; weights += 0.60; }
            if (priorAssignments.length > 0) { systemAvg += assignScore * 0.05; weights += 0.05; }
            
            if (weights > 0) {
                systemAvg = systemAvg / weights;
            }

            let syncStatus = 'IN_SYNC';
            if (exam.percentage > systemAvg + 5) syncStatus = 'IMPROVED';
            else if (exam.percentage < systemAvg - 5) syncStatus = 'DETERIORATED';

            return {
                ...exam,
                priorAvgOnline: parseFloat(avgOnline.toFixed(2)),
                priorAvgOffline: parseFloat(avgOffline.toFixed(2)),
                priorAssignmentScore: parseFloat(assignScore.toFixed(2)),
                priorSystemAvg: parseFloat(systemAvg.toFixed(2)),
                syncStatus
            };
        });

        return NextResponse.json({
            student: {
                name: student.name,
                phoneNumber: student.phoneNumber,
                courses: student.courses,
                joinedAt: studentCreatedAt
            },
            stats: {
                avgTestPercentage: parseFloat(avgPercentage.toFixed(2)),
                testsAttempted: attemptedTests,
                testsMissed: missedTests,
                assignmentsSubmitted: submittedAssignments,
                assignmentsMissed: missedAssignments
            },
            tests: formattedTests,
            assignments: formattedAssignments,
            offlineExams: formattedOfflineExams,
            schoolExams: formattedSchoolExams
        }, { headers: { 'Cache-Control': 'private, max-age=60' } }); // a re-visit within a minute is served by the browser

    } catch (error: any) {
        console.error("Dashboard Analytics Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
