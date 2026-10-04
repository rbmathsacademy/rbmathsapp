import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getStudentFromToken(req: NextRequest) {
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
        const { assignmentId, score, totalQuestions } = body;

        if (!assignmentId || score === undefined || score === null || !totalQuestions) {
            return NextResponse.json({ error: 'Missing required fields: assignmentId, score, totalQuestions' }, { status: 400 });
        }

        // 2. Validate Assignment
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        if (assignment.type !== 'INTERACTIVE') {
            return NextResponse.json({ error: 'Not an interactive assignment' }, { status: 400 });
        }

        // 3. Check deadline
        const now = new Date();
        const deadline = new Date(assignment.deadline);
        const cooldownEndDate = new Date(deadline.getTime() + (assignment.cooldownDuration || 0) * 60000);

        if (now > cooldownEndDate) {
            return NextResponse.json({ error: 'Submission deadline has passed.' }, { status: 403 });
        }

        const isLate = now > deadline;

        // 4. Check if already submitted — update if so, create otherwise
        const existingSub = await AssignmentSubmission.findOne({
            assignment: assignmentId,
            student: student._id
        });

        if (existingSub) {
            // Allow re-submission for interactive assignments (update the score)
            existingSub.score = score;
            existingSub.totalQuestions = totalQuestions;
            existingSub.submittedAt = now;
            existingSub.isLate = isLate;
            await existingSub.save();
            return NextResponse.json({ success: true, submission: existingSub, updated: true });
        }

        // 5. Create new submission
        const submission = await AssignmentSubmission.create({
            assignment: assignmentId,
            student: student._id,
            link: '', // No file for interactive assignments
            score,
            totalQuestions,
            submittedAt: now,
            isLate
        });

        return NextResponse.json({ success: true, submission });

    } catch (error: any) {
        console.error('Failed to submit interactive assignment', error);
        return NextResponse.json({ error: error.message || 'Failed to submit' }, { status: 500 });
    }
}
