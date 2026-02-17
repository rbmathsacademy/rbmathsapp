import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';

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
        const { assignmentId, driveLink } = body;

        if (!assignmentId || !driveLink) {
            return NextResponse.json({ error: 'Missing assignment ID or drive link' }, { status: 400 });
        }

        // 2. Validate Assignment and Deadline
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        // Check if already submitted
        const existingSub = await AssignmentSubmission.findOne({
            assignment: assignmentId,
            student: student._id
        });
        if (existingSub) {
            return NextResponse.json({ error: 'You have already submitted this assignment.' }, { status: 409 });
        }

        const now = new Date();
        const deadline = new Date(assignment.deadline);
        const cooldownEndDate = new Date(deadline.getTime() + (assignment.cooldownDuration || 0) * 60000);

        let isLate = false;

        if (now > cooldownEndDate) {
            return NextResponse.json({ error: 'Submission deadline has passed. No more submissions allowed.' }, { status: 403 });
        }

        if (now > deadline) {
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

        return NextResponse.json({ success: true, submission });

    } catch (error: any) {
        console.error('Failed to submit assignment', error);
        return NextResponse.json({ error: error.message || 'Failed to submit' }, { status: 500 });
    }
}
