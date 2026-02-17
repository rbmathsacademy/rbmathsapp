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

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        // 1. Authenticate Student
        const studentPayload = await getStudentFromToken(req);
        if (!studentPayload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Resolve student from DB — support both phoneNumber and userId patterns
        const phoneNumber = studentPayload.phoneNumber || studentPayload.userId;
        const student = await BatchStudent.findOne({ phoneNumber });
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. Get Student's Batch(es)
        const batches = student.courses || [];
        if (batches.length === 0) {
            return NextResponse.json({ assignments: [] });
        }

        // 3. Find Assignments for these batches
        const assignments = await Assignment.find({
            batch: { $in: batches }
        }).sort({ deadline: -1 }).lean();

        // 4. Find Submissions by this student
        const submissions = await AssignmentSubmission.find({
            student: student._id,
            assignment: { $in: assignments.map(a => a._id) }
        }).lean();

        const submissionMap = new Map();
        submissions.forEach((sub: any) => {
            submissionMap.set(sub.assignment.toString(), sub);
        });

        // 5. Enhance Assignment Data with Status
        const now = new Date();
        const enhancedAssignments = assignments.map((a: any) => {
            const submission = submissionMap.get(a._id.toString());
            const deadline = new Date(a.deadline);
            const cooldownEndDate = new Date(deadline.getTime() + (a.cooldownDuration || 0) * 60000);

            let status = 'PENDING';

            if (submission) {
                status = submission.isLate ? 'LATE_SUBMITTED' : 'SUBMITTED';
            } else {
                if (now < deadline) {
                    status = 'PENDING';
                } else if (now < cooldownEndDate) {
                    status = 'LATE_ALLOWED';
                } else {
                    status = 'CLOSED';
                }
            }

            // Don't send PDF content to listing — too heavy
            const safeContent = a.type === 'PDF' ? '[PDF]' : a.content;

            return {
                _id: a._id,
                title: a.title,
                type: a.type,
                batch: a.batch,
                deadline: a.deadline,
                cooldownDuration: a.cooldownDuration,
                cooldownEndDate,
                createdAt: a.createdAt,
                status,
                submissionLink: submission?.link,
                correctionStatus: submission?.status || 'PENDING',
                content: a.content // Sending content here so student can see it
            };
        });

        return NextResponse.json({ assignments: enhancedAssignments });

    } catch (error: any) {
        console.error('Failed to fetch student assignments', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch assignments' }, { status: 500 });
    }
}
