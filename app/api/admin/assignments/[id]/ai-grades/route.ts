import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import Assignment from '@/models/Assignment';
import { getAdminPayload } from '@/lib/adminAuth';
import { submissionCode } from '@/lib/aiGrading';
import { saveReviews, retractWarningPopups } from '@/lib/aiGradeSave';
import BatchStudent from '@/models/BatchStudent';

/**
 * POST /api/admin/assignments/[id]/ai-grades
 * Body: { results: [{ code, review }], questions? } - the parsed AI reply (see lib/aiGrading.ts).
 * Saves each review on the matching submission of THIS assignment through the shared save step
 * (lib/aiGradeSave.ts): grade by rule, unreadable copies stay unchecked, warnings and the audit log.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getAdminPayload(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
        const { results, questions } = await req.json();
        if (!Array.isArray(results) || results.length === 0) return NextResponse.json({ error: 'No results to save' }, { status: 400 });

        await dbConnect();
        const subs = await AssignmentSubmission.find({ assignment: id }).select('_id').lean();
        const byCode = new Map<string, string>();
        subs.forEach((s: any) => byCode.set(submissionCode(s._id.toString()), s._id.toString()));

        const items: Parameters<typeof saveReviews>[1] = [];
        const unknown: string[] = [];
        for (const r of results) {
            const subId = byCode.get(String(r?.code || '').toUpperCase());
            if (!subId) { unknown.push(String(r?.code)); continue; }
            items.push({ submissionId: subId, review: r.review, source: 'gemini-import' });
        }
        const saved = await saveReviews(id, items, { by: String(admin.email || '') });

        // The paper's question -> topic/sub-topic map (same for every batch of this assignment)
        let mappedQuestions = 0;
        if (Array.isArray(questions) && questions.length > 0) {
            const map = questions.slice(0, 200).map((q: any) => ({
                question: String(q?.question || '').slice(0, 40),
                topic: String(q?.topic || '').slice(0, 120),
                subtopic: String(q?.subtopic || '').slice(0, 160),
            })).filter((q: any) => q.question && q.topic);
            if (map.length > 0) {
                // Only kept as a fallback; a prepared paper key (paperKeys) takes precedence in the analysis
                await Assignment.updateOne({ _id: id }, { $set: { aiQuestionMap: map } });
                mappedQuestions = map.length;
            }
        }

        return NextResponse.json({ success: true, graded: saved.graded, flagged: saved.flagged, unknown, mappedQuestions, warned: saved.warned, notified: saved.notified });
    } catch (error: any) {
        console.error('[ai-grades] import failed:', error);
        return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/assignments/[id]/ai-grades
 * Body: { submissionId } - removes the whole review: the copy goes back to "not checked" (no counts,
 * grade, feedback or warning), the student's warning popup is withdrawn.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getAdminPayload(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        const { submissionId } = await req.json();
        if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(submissionId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }
        await dbConnect();
        const sub = await AssignmentSubmission.findOneAndUpdate(
            { _id: submissionId, assignment: id },
            { $set: { status: 'PENDING', quality: null, aiReview: null, warning: null, warningNotifiedAt: null } },
        ).select('student warningNotifiedAt').lean() as any;
        if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        const student = await BatchStudent.findById(sub.student).select('phoneNumber').lean() as any;
        if (student?.phoneNumber) await retractWarningPopups(id, [student.phoneNumber]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[ai-grades] delete failed:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/assignments/[id]/ai-grades
 * Body: { submissionId, review, grade?: 'AUTO' | 'GOOD' | 'SATISFACTORY' | 'POOR' }
 * Saves the admin's manual edit of one student's review (counts, feedback, flag). The grade is
 * recomputed from the counts unless the admin picked one explicitly; the warning is re-evaluated.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getAdminPayload(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        const { submissionId, review: rawReview, grade } = await req.json();
        if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(submissionId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }
        await dbConnect();
        const existing = await AssignmentSubmission.findOne({ _id: submissionId, assignment: id }).select('aiReview').lean() as any;
        if (!existing) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

        const saved = await saveReviews(id, [{
            submissionId,
            review: { ...rawReview, aiGrade: existing.aiReview?.aiGrade ?? null },
            grade: grade === 'AUTO' ? null : grade,
            source: 'manual-edit',
        }], { by: String(admin.email || '') });
        const one = saved.saved[0];
        if (!one) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

        return NextResponse.json({ success: true, status: one.status, quality: one.quality, aiReview: one.aiReview, warning: one.warning });
    } catch (error: any) {
        console.error('[ai-grades] edit failed:', error);
        return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 500 });
    }
}
