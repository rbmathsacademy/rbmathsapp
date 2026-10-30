import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import { isOutOfScope } from '@/lib/assignmentScope';
import { countsAsMissed } from '@/lib/missedLock';
import { unlimitedExpiry, stretchTo, unlimitedNoteDate } from '@/lib/unlimitedAccess';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getStudentFromToken(req: NextRequest) {
    // Use auth_token cookie (same as rest of the app)
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        return payload as any;
    } catch (e) {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        // 1. Authenticate
        const studentPayload = await getStudentFromToken(req);
        if (!studentPayload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Resolve student from DB
        const phoneNumber = studentPayload.phoneNumber || studentPayload.userId;
        const student = await BatchStudent.findOne({ phoneNumber });
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        const body = await req.json();
        const { assignmentId, driveLink, replace } = body;

        if (!assignmentId || !driveLink) {
            return NextResponse.json({ error: 'Missing assignment ID or drive link' }, { status: 400 });
        }

        // 2. Validate Assignment and Deadline
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        if (isOutOfScope(assignment as any, phoneNumber)) {
            return NextResponse.json({ error: 'This assignment is not for you.' }, { status: 403 });
        }

        // Check if already submitted
        const existingSub = await AssignmentSubmission.findOne({
            assignment: assignmentId,
            student: student._id
        });
        // A rejected submission may be replaced: the old one (and its feedback) is removed only after the
        // new one has been saved, so nothing is lost if the re-upload fails
        const replacing = existingSub && replace === true && !!(existingSub as any).rejection;
        if (existingSub && !replacing) {
            return NextResponse.json({ error: 'You have already submitted this assignment.' }, { status: 409 });
        }

        const now = new Date();

        // Check if assignment is scheduled for future
        if (assignment.scheduledFor && now < new Date(assignment.scheduledFor)) {
            return NextResponse.json({ error: 'This assignment is scheduled and has not opened yet. Submissions are not accepted yet.' }, { status: 403 });
        }

        const deadline = new Date(assignment.deadline);
        // Unlimited access keeps submissions open until its expiry; anything after the real deadline is still marked late
        const cooldownEndDate = stretchTo(new Date(deadline.getTime() + (assignment.cooldownDuration || 0) * 60000), unlimitedExpiry(student as any, now))!;

        let isLate = false;

        // The teacher asked for a redo: accepted even after the deadline, and not counted as late
        const redoAllowed = (assignment.redoAllowed || []).includes(student._id.toString());

        // a missed assignment that locks the portal may always be handed in late
        const lateMakeUp = !existingSub && countsAsMissed(assignment, student, false, now);

        if (now > cooldownEndDate && !redoAllowed && !lateMakeUp) {
            return NextResponse.json({ error: 'Submission deadline has passed. No more submissions allowed.' }, { status: 403 });
        }

        if (now > deadline && !redoAllowed) {
            isLate = true;
        }

        // 3. Create Submission
        const submission = await AssignmentSubmission.create({
            assignment: assignmentId,
            student: student._id,
            link: driveLink,
            submittedAt: now,
            isLate
        });

        if (replacing) await AssignmentSubmission.deleteOne({ _id: existingSub!._id });

        // A redo was handed in: the permission has been used (this is now a normal, fresh submission)
        if (redoAllowed) {
            await Assignment.updateOne({ _id: assignmentId }, { $pull: { redoAllowed: student._id.toString() } });
        }

        return NextResponse.json({ success: true, submission });

    } catch (error: any) {
        console.error('Failed to submit assignment', error);
        return NextResponse.json({ error: error.message || 'Failed to submit' }, { status: 500 });
    }
}
