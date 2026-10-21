import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import Assignment from '@/models/Assignment';
import { getAdminPayload } from '@/lib/adminAuth';
import { computeGrade, stripCitations, submissionCode, ERROR_TYPES, type AiReview, type Grade } from '@/lib/aiGrading';

const GRADES: Grade[] = ['GOOD', 'SATISFACTORY', 'POOR'];

/** Clamp and trim a review coming from the client before it is stored. */
function sanitizeReview(rv: Partial<AiReview> | undefined) {
    const r = rv || {};
    return {
        totalQuestions: Math.max(0, Math.round(Number(r.totalQuestions) || 0)),
        correct: Math.max(0, Math.round(Number(r.correct) || 0)),
        incorrect: Math.max(0, Math.round(Number(r.incorrect) || 0)),
        skippedOrIncomplete: Math.max(0, Math.round(Number(r.skippedOrIncomplete) || 0)),
        unreadable: !!r.unreadable,
        unreadableNote: stripCitations(String(r.unreadableNote || '')).slice(0, 1000),
        summary: stripCitations(String(r.summary || '')).slice(0, 2000),
        feedback: (Array.isArray(r.feedback) ? r.feedback : []).slice(0, 100).map((f: any) => ({
            question: String(f?.question || '').slice(0, 40),
            status: ['INCORRECT', 'PARTIAL', 'INCOMPLETE', 'SKIPPED'].includes(f?.status) ? f.status : 'INCORRECT',
            comment: stripCitations(String(f?.comment || '')).slice(0, 2000),
            errorType: ERROR_TYPES.includes(f?.errorType) ? f.errorType : null,
        })),
        aiGrade: r.aiGrade ? String(r.aiGrade).slice(0, 20) : null,
        importedAt: new Date(),
    };
}

/** Status/quality that go with a review: unreadable copies stay unchecked for manual checking. */
function gradingFields(review: ReturnType<typeof sanitizeReview>, grade?: string | null) {
    if (review.unreadable) return { status: 'PENDING', quality: null };
    const chosen = grade && GRADES.includes(grade as Grade) ? grade : computeGrade(review);
    return { status: 'CORRECTED', quality: chosen };
}

/**
 * POST /api/admin/assignments/[id]/ai-grades
 * Body: { results: [{ code, review }] } — the parsed AI reply (see lib/aiGrading.ts).
 * Saves each review on the matching submission of THIS assignment. Readable ones are marked
 * CORRECTED with the grade recomputed here from the counts; unreadable ones keep their review
 * (with the flag) but stay PENDING for manual checking.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await getAdminPayload(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
        const { results, questions } = await req.json();
        if (!Array.isArray(results) || results.length === 0) return NextResponse.json({ error: 'No results to save' }, { status: 400 });

        await dbConnect();
        const subs = await AssignmentSubmission.find({ assignment: id }).select('_id').lean();
        const byCode = new Map<string, string>();
        subs.forEach((s: any) => byCode.set(submissionCode(s._id.toString()), s._id.toString()));

        const ops: any[] = [];
        const unknown: string[] = [];
        let graded = 0, flagged = 0;
        for (const r of results) {
            const subId = byCode.get(String(r?.code || '').toUpperCase());
            if (!subId) { unknown.push(String(r?.code)); continue; }
            const review = sanitizeReview(r.review);
            const fields = gradingFields(review);
            if (review.unreadable) flagged++; else graded++;
            ops.push({ updateOne: { filter: { _id: subId, assignment: id }, update: { $set: { aiReview: review, ...fields } } } });
        }
        if (ops.length > 0) await AssignmentSubmission.bulkWrite(ops, { ordered: false });

        // The paper's question -> topic/sub-topic map (same for every batch of this assignment)
        let mappedQuestions = 0;
        if (Array.isArray(questions) && questions.length > 0) {
            const map = questions.slice(0, 200).map((q: any) => ({
                question: String(q?.question || '').slice(0, 40),
                topic: String(q?.topic || '').slice(0, 120),
                subtopic: String(q?.subtopic || '').slice(0, 160),
            })).filter((q: any) => q.question && q.topic);
            if (map.length > 0) {
                await Assignment.updateOne({ _id: id }, { $set: { aiQuestionMap: map } });
                mappedQuestions = map.length;
            }
        }

        return NextResponse.json({ success: true, graded, flagged, unknown, mappedQuestions });
    } catch (error: any) {
        console.error('[ai-grades] import failed:', error);
        return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/assignments/[id]/ai-grades
 * Body: { submissionId, review, grade?: 'AUTO' | 'GOOD' | 'SATISFACTORY' | 'POOR' }
 * Saves the admin's manual edit of one student's review (counts, feedback, flag). The grade is
 * recomputed from the counts unless the admin picked one explicitly.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await getAdminPayload(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        const { submissionId, review: rawReview, grade } = await req.json();
        if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(submissionId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }
        await dbConnect();
        const existing = await AssignmentSubmission.findOne({ _id: submissionId, assignment: id }).select('aiReview').lean() as any;
        if (!existing) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

        const review = sanitizeReview({ ...rawReview, aiGrade: existing.aiReview?.aiGrade ?? null });
        const fields = gradingFields(review, grade === 'AUTO' ? null : grade);
        const updated = await AssignmentSubmission.findByIdAndUpdate(
            submissionId,
            { $set: { aiReview: review, ...fields } },
            { new: true },
        ).lean() as any;

        return NextResponse.json({ success: true, status: updated.status, quality: updated.quality, aiReview: updated.aiReview });
    } catch (error: any) {
        console.error('[ai-grades] edit failed:', error);
        return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 500 });
    }
}
