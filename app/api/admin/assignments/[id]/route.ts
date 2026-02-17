import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import BatchStudent from '@/models/BatchStudent';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await dbConnect();
        const assignment = await Assignment.findById(id).lean();
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        // Fetch submissions with student info
        const submissions = await AssignmentSubmission.find({ assignment: id })
            .populate('student', 'name phoneNumber')
            .lean();

        // Fetch all students in the batch
        const students = await BatchStudent.find({ courses: assignment.batch }).lean();

        // Merge student data
        const studentList = students.map((student: any) => {
            const submission = submissions.find((sub: any) => sub.student && sub.student._id.toString() === student._id.toString());
            let status = 'PENDING';

            // Calculate Status
            if (submission) {
                status = submission.status === 'CORRECTED' ? 'CORRECTED' : (submission.isLate ? 'LATE_SUBMITTED' : 'SUBMITTED');
            } else {
                const now = new Date();
                const deadline = new Date(assignment.deadline);
                const cooldownEnd = new Date(deadline.getTime() + (assignment.cooldownDuration || 0) * 60000);

                if (now > cooldownEnd) {
                    status = 'MISSED';
                }
            }

            return {
                _id: submission ? submission._id : null,
                student: {
                    _id: student._id,
                    name: student.name,
                    phoneNumber: student.phoneNumber
                },
                status: submission ? (submission.status || 'PENDING') : status, // Corrected/Pending logic is separate from submission status
                submissionStatus: status, // Overall status: SUBMITTED, LATE, MISSED, PENDING
                submittedAt: submission ? submission.submittedAt : null,
                link: submission ? submission.link : null,
                isLate: submission ? submission.isLate : false,
                correctionStatus: submission ? (submission.status || 'PENDING') : 'PENDING'
            };
        });

        // Ensure submissions from students NOT in batch (e.g. changed batch) are also shown? 
        // Admin might want to see them. Let's add them.
        submissions.forEach((sub: any) => {
            if (sub.student && !students.find((s: any) => s._id.toString() === sub.student._id.toString())) {
                studentList.push({
                    _id: sub._id,
                    student: sub.student,
                    status: sub.status || 'PENDING',
                    submissionStatus: sub.isLate ? 'LATE_SUBMITTED' : 'SUBMITTED',
                    submittedAt: sub.submittedAt,
                    link: sub.link,
                    isLate: sub.isLate,
                    correctionStatus: sub.status || 'PENDING'
                });
            }
        });

        return NextResponse.json({ assignment, studentList });
    } catch (error: any) {
        console.error('Assignment detail error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch assignment details' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await dbConnect();
        const assignment = await Assignment.findByIdAndDelete(id);
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        // Delete associated submissions
        await AssignmentSubmission.deleteMany({ assignment: id });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Assignment delete error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete assignment' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await dbConnect();
        const body = await req.json();

        const updateData: any = {};
        if (body.title) updateData.title = body.title;
        if (body.deadline) updateData.deadline = body.deadline;
        if (body.folderId !== undefined) updateData.folderId = body.folderId; // Allow null to remove from folder

        const assignment = await Assignment.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, assignment });
    } catch (error: any) {
        console.error('Assignment update error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update assignment' }, { status: 500 });
    }
}
