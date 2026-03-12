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

// DELETE: Student self-deletes their own submission
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: assignmentId } = await params;
        await dbConnect();

        // 1. Authenticate
        const studentPayload = await getStudentFromToken(req);
        if (!studentPayload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Resolve student
        const phoneNumber = studentPayload.phoneNumber || studentPayload.userId;
        const student = await BatchStudent.findOne({ phoneNumber });
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. Find the assignment
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        // 3. Check deadline + cooldown hasn't passed
        const now = new Date();
        const deadline = new Date(assignment.deadline);
        const cooldownEnd = new Date(deadline.getTime() + (assignment.cooldownDuration || 0) * 60000);

        if (now > cooldownEnd) {
            return NextResponse.json({
                error: 'Cannot delete submission — the submission deadline has passed.'
            }, { status: 403 });
        }

        // 4. Find and delete the submission
        const submission = await AssignmentSubmission.findOneAndDelete({
            assignment: assignmentId,
            student: student._id
        });

        if (!submission) {
            return NextResponse.json({ error: 'No submission found to delete' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Submission deleted successfully' });

    } catch (error: any) {
        console.error('Student delete submission error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete submission' }, { status: 500 });
    }
}
