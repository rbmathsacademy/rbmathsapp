import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import BatchStudent from '@/models/BatchStudent';
import Notification from '@/models/Notification';
import { getAdminPayload } from '@/lib/adminAuth';
import { retractWarningPopups, recheckWarnings } from '@/lib/aiGradeSave';

/**
 * POST   /api/admin/assignments/submission/[id]/accept
 *   The teacher accepts this submission on exceptional grounds although it is warned / rejected:
 *   the warning and the rejection are removed (popups withdrawn, portal lock lifted) and later
 *   re-grades or limit changes do not warn it again.
 * DELETE - undo the acceptance (the warning is re-evaluated against the current limit).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getAdminPayload(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    await dbConnect();

    const sub = await AssignmentSubmission.findById(id).select('assignment student').lean() as any;
    if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

    const accepted = { at: new Date(), by: String(admin.email || '') };
    await AssignmentSubmission.updateOne({ _id: id }, { $set: { accepted, warning: null, warningNotifiedAt: null, rejection: null } });
    await Assignment.updateOne({ _id: sub.assignment }, { $pull: { redoAllowed: sub.student.toString() } });

    const student = await BatchStudent.findById(sub.student).select('phoneNumber').lean() as any;
    if (student?.phoneNumber) {
        await retractWarningPopups(String(sub.assignment), [student.phoneNumber]);
        await Notification.deleteMany({
            assignmentId: sub.assignment, title: '↩ Please redo your homework', oncePerStudent: true,
            'targetStudents.phoneNumber': student.phoneNumber,
        }).catch(e => console.error('[accept] retract failed:', e));
    }
    return NextResponse.json({ success: true, accepted });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await getAdminPayload(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    await dbConnect();
    const sub = await AssignmentSubmission.findByIdAndUpdate(id, { $set: { accepted: null } }).select('assignment').lean() as any;
    if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    await recheckWarnings(String(sub.assignment));
    const now = await AssignmentSubmission.findById(id).select('warning').lean() as any;
    return NextResponse.json({ success: true, warning: now?.warning ? { count: now.warning.count, limit: now.warning.limit } : null });
}
