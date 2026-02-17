import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AssignmentSubmission from '@/models/AssignmentSubmission';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { submissionId, status } = await req.json();

        if (!submissionId || !status) {
            return NextResponse.json({ error: 'Missing submission ID or status' }, { status: 400 });
        }

        const submission = await AssignmentSubmission.findByIdAndUpdate(
            submissionId,
            { status },
            { new: true }
        );

        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, submission });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to update status' }, { status: 500 });
    }
}
