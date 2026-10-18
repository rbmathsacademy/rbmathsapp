import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import OnlineTest from '@/models/OnlineTest';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import AttemptTopicStat from '@/models/AttemptTopicStat';
import { computeWeaknessReport } from '@/lib/weakness/compute';
import { DERIVE_VERSION, deriveAttemptGroups } from '@/lib/weakness/derive';
import type { AttemptStats } from '@/lib/weakness/inputs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// How many not-yet-summarised attempts one request will read. Reading an attempt document is slow
// (they embed whole question papers), so the work is spread over several requests; the response
// says how many remain and the page keeps asking until it reaches zero.
const DERIVE_PER_REQUEST = 80;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const batch = searchParams.get('batch');
        if (!batch) return NextResponse.json({ error: 'Batch is required' }, { status: 400 });
        const rebuild = searchParams.get('rebuild') === '1';

        await dbConnect();

        const students = await BatchStudent.find({ courses: batch }).select('name phoneNumber createdAt schoolName board').lean();
        const tests = await OnlineTest.find({ 'deployment.batches': batch }).select('title deployment.startTime').lean();
        const testIds = tests.map((t: any) => t._id);
        const phones = students.map((s: any) => s.phoneNumber);

        if (rebuild && testIds.length > 0) {
            await AttemptTopicStat.deleteMany({ testId: { $in: testIds } });
        }

        // 1. Which attempts exist (ids only — this is answered from the index, so it is fast)…
        const attemptIdDocs = await StudentTestAttempt.find({ testId: { $in: testIds }, studentPhone: { $in: phones } }).select('_id').lean();
        const attemptIds = attemptIdDocs.map((a: any) => a._id.toString());

        // 2. …and which of them already have a summary.
        const attemptIdSet = new Set(attemptIds);
        const summaries = (await AttemptTopicStat.find({ testId: { $in: testIds }, studentPhone: { $in: phones }, version: DERIVE_VERSION }).lean())
            .filter((s: any) => attemptIdSet.has(s.attemptId.toString())); // ignore summaries of attempts deleted since
        const have = new Set(summaries.map((s: any) => s.attemptId.toString()));
        const missing = attemptIds.filter(id => !have.has(id));

        // 3. Build summaries for some of the missing ones.
        const toDerive = missing.slice(0, DERIVE_PER_REQUEST);
        const derived: AttemptStats[] = [];
        if (toDerive.length > 0) {
            const docs = await StudentTestAttempt.find({ _id: { $in: toDerive } })
                .select('testId studentPhone status percentage questions.id questions.type questions.topic questions.subtopic questions.subQuestions.id answers.questionId answers.answer answers.isCorrect')
                .lean();

            // Older attempts did not save their question paper, so those need the test's own list.
            const needTestQuestions = docs.some((d: any) => !(d.questions && d.questions.length > 0));
            const testQuestions = new Map<string, any[]>();
            if (needTestQuestions) {
                const full = await OnlineTest.find({ _id: { $in: testIds } })
                    .select('questions.id questions.type questions.topic questions.subtopic questions.subQuestions.id boardQuestionSets.questions.id boardQuestionSets.questions.type boardQuestionSets.questions.topic boardQuestionSets.questions.subtopic boardQuestionSets.questions.subQuestions.id')
                    .lean();
                full.forEach((t: any) => testQuestions.set(t._id.toString(), [
                    ...(t.questions || []),
                    ...((t.boardQuestionSets || []).flatMap((s: any) => s.questions || [])),
                ]));
            }

            const ops: any[] = [];
            for (const d of docs as any[]) {
                if (d.status !== 'completed') continue; // in-progress attempts are not analysed
                const groups = deriveAttemptGroups(d.questions, d.answers || [], testQuestions.get(d.testId.toString()) || []);
                derived.push({ testId: d.testId.toString(), studentPhone: d.studentPhone, percentage: d.percentage ?? null, groups });
                ops.push({
                    updateOne: {
                        filter: { attemptId: d._id },
                        update: { $set: { attemptId: d._id, testId: d.testId, studentPhone: d.studentPhone, percentage: d.percentage ?? null, version: DERIVE_VERSION, groups } },
                        upsert: true,
                    },
                });
            }
            if (ops.length > 0) await AttemptTopicStat.bulkWrite(ops, { ordered: false });
        }

        const attempts: AttemptStats[] = [
            ...summaries.map((s: any) => ({
                testId: s.testId.toString(), studentPhone: s.studentPhone, percentage: s.percentage,
                groups: (s.groups || []).map((g: any) => ({ t: g.t, s: g.s, n: g.n, c: g.c, k: g.k })),
            })),
            ...derived,
        ];

        // Assignments and teacher ratings
        const assignments = await Assignment.find({ batch }).select('title deadline excludedStudents').lean();
        const submissions = await AssignmentSubmission.find({
            assignment: { $in: assignments.map((a: any) => a._id) },
            student: { $in: students.map((s: any) => s._id) },
        }).select('assignment student status isLate submittedAt quality').lean();

        const report = computeWeaknessReport({
            batch,
            students: students.map((s: any) => ({ id: s._id.toString(), name: s.name, phoneNumber: s.phoneNumber, schoolName: s.schoolName, board: s.board, createdAt: s.createdAt })),
            tests: tests.map((t: any) => ({ id: t._id.toString(), title: t.title, date: t.deployment?.startTime })),
            attempts,
            assignments: assignments.map((a: any) => ({ id: a._id.toString(), title: a.title, deadline: a.deadline, excluded: a.excludedStudents || [] })),
            submissions: submissions.map((s: any) => ({ assignmentId: s.assignment.toString(), studentId: s.student.toString(), status: s.status, quality: s.quality, isLate: s.isLate, submittedAt: s.submittedAt })),
        });

        return NextResponse.json({
            report,
            progress: { totalAttempts: attemptIds.length, pending: Math.max(0, missing.length - toDerive.length) },
        });
    } catch (error: any) {
        console.error('Weakness analysis failed:', error);
        return NextResponse.json({ error: error.message || 'Failed to analyse weaknesses' }, { status: 500 });
    }
}
