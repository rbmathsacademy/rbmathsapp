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

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: assignmentId } = await params;
        await dbConnect();

        // 1. Authenticate
        const studentPayload = await getStudentFromToken(req);
        if (!studentPayload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const phoneNumber = studentPayload.phoneNumber || studentPayload.userId;
        const student = await BatchStudent.findOne({ phoneNumber });
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. Fetch the assignment
        const assignment = await Assignment.findById(assignmentId).lean() as any;
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        if (assignment.type !== 'INTERACTIVE') {
            return NextResponse.json({ error: 'Not an interactive assignment' }, { status: 400 });
        }

        // 3. Check batch access
        const studentBatches: string[] = student.courses || [];
        if (!studentBatches.includes(assignment.batch)) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // 4. Check if excluded
        const excludedStudents: string[] = assignment.excludedStudents || [];
        if (excludedStudents.includes(phoneNumber)) {
            return NextResponse.json({ error: 'You are excluded from this assignment' }, { status: 403 });
        }

        // 5. Get submission if any
        const submission = await AssignmentSubmission.findOne({
            assignment: assignmentId,
            student: student._id
        }).lean();

        return NextResponse.json({
            assignment: {
                _id: assignment._id,
                title: assignment.title,
                batch: assignment.batch,
                deadline: assignment.deadline,
                interactiveHtmlId: assignment.interactiveHtmlId || 'straight-lines-v1',
            },
            submission: submission || null
        });

    } catch (error: any) {
        console.error('Failed to fetch interactive assignment', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
