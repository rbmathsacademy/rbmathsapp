import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import { getStudentsByBatches } from '@/lib/googleSheet';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id: testId } = await props.params;

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find test and verify ownership
        const test = await OnlineTest.findOne({ _id: testId, createdBy: userEmail });
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        const deployedBatches = test.deployment?.batches || [];

        // Get all students from Google Sheet for the deployed batches
        const sheetStudents = await getStudentsByBatches(deployedBatches);

        // Create student map
        const studentMap = new Map<string, any>();
        sheetStudents.forEach(s => {
            studentMap.set(s.phone, {
                name: s.name,
                phone: s.phone,
                batch: s.batch
            });
        });

        // Get all attempts for this test
        const attempts = await StudentTestAttempt.find({ testId });
        const attemptMap = new Map<string, any>();
        attempts.forEach(attempt => {
            attemptMap.set(attempt.studentPhone || attempt.studentEmail, attempt);
        });

        // Categorize students
        const completed: any[] = [];
        const inProgress: any[] = [];
        const notStarted: any[] = [];

        for (const [phone, student] of studentMap) {
            const attempt = attemptMap.get(phone);

            if (!attempt) {
                notStarted.push({ name: student.name, phone, batch: student.batch });
            } else if (attempt.status === 'completed') {
                completed.push({
                    name: student.name,
                    phone,
                    batch: student.batch,
                    score: attempt.score,
                    percentage: attempt.percentage,
                    submittedAt: attempt.submittedAt,
                    timeSpent: attempt.timeSpent,
                    graceMarks: attempt.graceMarks || 0,
                    terminationReason: attempt.terminationReason
                });
            } else if (attempt.status === 'in_progress') {
                inProgress.push({
                    name: student.name,
                    phone,
                    batch: student.batch,
                    startedAt: attempt.startedAt,
                    timeElapsed: Date.now() - new Date(attempt.startedAt).getTime()
                });
            }
        }

        // Sort completed by score (descending)
        completed.sort((a, b) => b.score - a.score);

        // Analytics
        const totalStudents = studentMap.size;
        const participationRate = totalStudents > 0 ? Math.round(((completed.length + inProgress.length) / totalStudents) * 100) : 0;

        let analytics: any = {
            totalStudents,
            completedCount: completed.length,
            inProgressCount: inProgress.length,
            notStartedCount: notStarted.length,
            participationRate
        };

        if (completed.length > 0) {
            const scores = completed.map(s => s.score);
            const percentages = completed.map(s => s.percentage);
            const passingPercentage = test.config?.passingPercentage || 40;
            const passedCount = completed.filter(s => s.percentage >= passingPercentage).length;

            analytics = {
                ...analytics,
                averageScore: Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10,
                highestScore: Math.max(...scores),
                lowestScore: Math.min(...scores),
                averagePercentage: Math.round(percentages.reduce((a: number, b: number) => a + b, 0) / percentages.length),
                passRate: Math.round((passedCount / completed.length) * 100),
                passedCount,
                failedCount: completed.length - passedCount,
                medianScore: scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]
            };

            // Score distribution (10% buckets)
            const distribution = Array(10).fill(0);
            percentages.forEach(p => {
                const bucket = Math.min(Math.floor(p / 10), 9);
                distribution[bucket]++;
            });
            analytics.scoreDistribution = distribution.map((count, i) => ({
                range: `${i * 10}-${i * 10 + 9}%`,
                count
            }));

            // Batch-wise performance
            const batchStats = new Map<string, { scores: number[], count: number }>();
            completed.forEach(s => {
                if (!batchStats.has(s.batch)) batchStats.set(s.batch, { scores: [], count: 0 });
                const bs = batchStats.get(s.batch)!;
                bs.scores.push(s.percentage);
                bs.count++;
            });
            analytics.batchPerformance = Array.from(batchStats.entries()).map(([batch, data]) => ({
                batch,
                avgPercentage: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
                studentCount: data.count
            }));

            // Question-wise analysis
            const questionStats = new Map<string, { correct: number, total: number, text: string, type: string }>();
            test.questions.forEach((q: any) => {
                if (q.type === 'comprehension' && q.subQuestions) {
                    q.subQuestions.forEach((sq: any) => {
                        questionStats.set(sq.id, { correct: 0, total: 0, text: sq.text, type: sq.type });
                    });
                } else {
                    questionStats.set(q.id, { correct: 0, total: 0, text: q.text, type: q.type });
                }
            });

            for (const attempt of attempts) {
                if (attempt.status === 'completed' && attempt.answers) {
                    attempt.answers.forEach((ans: any) => {
                        const stat = questionStats.get(ans.questionId);
                        if (stat) {
                            stat.total++;
                            if (ans.isCorrect) stat.correct++;
                        }
                    });
                }
            }

            analytics.questionAnalysis = Array.from(questionStats.entries()).map(([id, stat]) => ({
                questionId: id,
                text: stat.text?.substring(0, 100) + (stat.text?.length > 100 ? '...' : ''),
                type: stat.type,
                correctCount: stat.correct,
                totalAttempts: stat.total,
                accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
            }));
        }

        return NextResponse.json({
            test: {
                title: test.title,
                totalMarks: test.totalMarks,
                duration: test.deployment?.durationMinutes,
                batches: deployedBatches,
                passingPercentage: test.config?.passingPercentage || 40,
                startTime: test.deployment?.startTime,
                endTime: test.deployment?.endTime
            },
            analytics,
            completed,
            inProgress,
            notStarted
        });
    } catch (error: any) {
        console.error('Error fetching test results:', error);
        return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }
}
