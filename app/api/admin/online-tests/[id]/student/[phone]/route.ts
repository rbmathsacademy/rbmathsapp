import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';
import { seededShuffleArray, getSeededRandom, shuffleOptionsForQuestion } from '@/lib/seededRandom';
import { resolveStudentBoard, findBoardSet, unionBoardQuestions } from '@/lib/boardAccess';

async function findBatchStudent(phone: string) {
    const rawClean = (phone || '').replace(/\D/g, '');
    const normalizedPhone = rawClean.length > 10 ? rawClean.slice(-10) : rawClean;
    return await BatchStudent.findOne({
        $or: [
            { phoneNumber: phone },
            { phoneNumber: rawClean },
            { phoneNumber: normalizedPhone },
            { phoneNumber: `+91${normalizedPhone}` },
            { phoneNumber: `91${normalizedPhone}` },
            { alternativePhone: rawClean },
            { alternativePhone: normalizedPhone },
            { loginId: phone }
        ]
    }).lean();
}

async function resolveAttemptQuestions(test: any, attempt: any, student: any, phone: string): Promise<any[]> {
    if (attempt.questions && attempt.questions.length > 0) {
        return attempt.questions;
    }

    const board = resolveStudentBoard(student, attempt.batchName ? [attempt.batchName] : []);

    let rawQuestions: any[] = [];
    if (test.isBoardSpecific && test.boardQuestionSets && test.boardQuestionSets.length > 0) {
        const assignedSet = findBoardSet(test.boardQuestionSets, board);
        // No snapshot AND no resolvable board: grade by id against the union of every
        // split rather than guessing board[0] — ids are unique across sets, so this
        // still grades correctly.
        rawQuestions = assignedSet ? [...assignedSet.questions] : unionBoardQuestions(test);
    } else {
        rawQuestions = test.questions ? [...test.questions] : [];
    }

    if (test.config?.shuffleQuestions || test.config?.maxQuestionsToAttempt) {
        const seedString = `${phone}_${test._id.toString()}`;
        rawQuestions = seededShuffleArray(rawQuestions, getSeededRandom(seedString));
        if (test.config?.maxQuestionsToAttempt > 0 && test.config?.maxQuestionsToAttempt < rawQuestions.length) {
            rawQuestions = rawQuestions.slice(0, test.config.maxQuestionsToAttempt);
        }
    }

    const processed = rawQuestions.map((q: any) => {
        const qObj = typeof q.toObject === 'function' ? q.toObject() : JSON.parse(JSON.stringify(q));
        let shuffled = shuffleOptionsForQuestion(qObj, phone);
        if (shuffled.type === 'comprehension' && shuffled.subQuestions) {
            shuffled.subQuestions = shuffled.subQuestions.map((sq: any) => shuffleOptionsForQuestion(sq, phone));
        }
        return shuffled;
    });

    // Save back to DB so subsequent lookups are instant
    await StudentTestAttempt.updateOne(
        { testId: test._id, studentPhone: phone },
        { $set: { questions: processed } }
    );

    return processed;
}

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string, phone: string }> }
) {
    try {
        await dbConnect();
        const { id: testId, phone } = await props.params;

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager', 'copy_checker'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find test
        const test = await OnlineTest.findOne({ _id: testId }).lean();
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Get student details
        const student = await findBatchStudent(phone);

        // Get attempt
        const attempt = await StudentTestAttempt.findOne({ testId, studentPhone: phone }).lean();

        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        const questions = await resolveAttemptQuestions(test, attempt, student, phone);

        return NextResponse.json({
            student: {
                name: (student as any)?.name || attempt.studentName || 'Unknown',
                phone: attempt.studentPhone,
                batch: attempt.batchName
            },
            attempt: {
                ...attempt,
                score: Math.round((Number(attempt.score) + Number.EPSILON) * 100) / 100,
                percentage: Math.round((Number(attempt.percentage) + Number.EPSILON) * 100) / 100,
                questions
            }
        });

    } catch (error: any) {
        console.error('Error fetching student attempt details:', error);
        return NextResponse.json({ error: 'Failed to fetch student attempt details' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string, phone: string }> }
) {
    try {
        await dbConnect();
        const { id: testId, phone } = await props.params;
        const { adjustments } = await request.json(); // Array of { questionId, adjustmentMarks }

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager', 'copy_checker'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find test
        const test = await OnlineTest.findOne({ _id: testId });
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Get student details
        const student = await findBatchStudent(phone);

        // Get attempt
        const attempt = await StudentTestAttempt.findOne({ testId, studentPhone: phone });
        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        // Update adjustments
        let totalScore = 0;
        const adjMap = new Map(adjustments.map((a: any) => [a.questionId, a.adjustmentMarks]));

        for (const ans of attempt.answers) {
            // Check if there is a new adjustment for this question
            if (adjMap.has(ans.questionId)) {
                (ans as any).adjustmentMarks = Number(adjMap.get(ans.questionId)) || 0;
            }

            // Re-sum the score
            const adjustment = (ans as any).adjustmentMarks || 0;
            totalScore += (ans.marksAwarded || 0) + adjustment;
        }

        // Calculate total marks served to this student (for percentage calculation)
        const sourceQuestions = await resolveAttemptQuestions(test, attempt, student, phone);
        let servedTotalMarks = 0;
        for (const q of sourceQuestions) {
            if (q.type === 'comprehension' && q.subQuestions) {
                for (const sq of q.subQuestions) servedTotalMarks += sq.marks || 1;
            } else servedTotalMarks += q.marks || 1;
        }
        const tm = servedTotalMarks || test.totalMarks || 1;

        attempt.score = Number(Math.max(0, totalScore).toFixed(2)); // prevent negative total score
        attempt.percentage = Math.round((attempt.score / tm) * 100);

        // Tell mongoose that the answers array was modified since it contains mixed types
        attempt.markModified('answers');
        await attempt.save();

        return NextResponse.json({ message: 'Adjustment marks saved successfully', score: attempt.score, percentage: attempt.percentage });

    } catch (error: any) {
        console.error('Error saving adjustment marks:', error);
        return NextResponse.json({ error: 'Failed to save adjustment marks' }, { status: 500 });
    }
}
