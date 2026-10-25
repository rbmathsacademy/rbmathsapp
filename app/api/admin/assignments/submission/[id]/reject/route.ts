import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import BatchStudent from '@/models/BatchStudent';
import Notification from '@/models/Notification';
import { getAdminPayload } from '@/lib/adminAuth';

const DAY = 24 * 60 * 60 * 1000;

/**
 * POST   /api/admin/assignments/submission/[id]/reject   { reason? }
 *   The teacher rejects this submission. The student sees it in red (Completed tab) with the reason and
 *   the feedback, and may delete it and upload again even after the deadline. The re-upload is then a
 *   completely fresh submission.
 * DELETE  - undo the rejection (the student can keep their submission).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getAdminPayload(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    await dbConnect();

    const { reason } = await req.json().catch(() => ({ reason: '' }));
    const sub = await AssignmentSubmission.findById(id).select('assignment student rejection').lean() as any;
    if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

    const rejection = { at: new Date(), reason: String(reason || '').trim().slice(0, 500), by: String(admin.email || '') };
    await AssignmentSubmission.updateOne({ _id: id }, { $set: { rejection } });
    await Assignment.updateOne({ _id: sub.assignment }, { $addToSet: { redoAllowed: sub.student.toString() } });

    // Tell the student once (only the first time this submission is rejected)
    if (!sub.rejection) {
        const [assignment, student] = await Promise.all([
            Assignment.findById(sub.assignment).select('title batch').lean() as any,
            BatchStudent.findById(sub.student).select('name phoneNumber').lean() as any,
        ]);
        if (assignment && student?.phoneNumber) {
            await Notification.create({
                title: '↩ Please redo your homework',
                message: `"${String(assignment.title).split('||')[0].trim()}" was returned by your teacher.${rejection.reason ? `\n\nTeacher's note: ${rejection.reason}` : ''}\n\nOpen Assignments → Completed, read the feedback, correct your work, then delete the submission and upload it again.`,
                type: 'popup', oncePerStudent: true, link: '/student/assignments',
                targetStudents: [{ phoneNumber: student.phoneNumber, studentName: student.name, batchName: assignment.batch }],
                startDate: new Date(), endDate: new Date(Date.now() + 14 * DAY), assignmentId: sub.assignment,
            }).catch(e => console.error('[reject] notification failed:', e));
        }
    }
    return NextResponse.json({ success: true, rejection });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await getAdminPayload(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    await dbConnect();
    const sub = await AssignmentSubmission.findByIdAndUpdate(id, { $set: { rejection: null } }).select('assignment student').lean() as any;
    if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    await Assignment.updateOne({ _id: sub.assignment }, { $pull: { redoAllowed: sub.student.toString() } });
    return NextResponse.json({ success: true });
}
