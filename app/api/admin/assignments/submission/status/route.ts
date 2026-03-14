import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AssignmentSubmission from '@/models/AssignmentSubmission';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { submissionId, status, quality } = await req.json();

        if (!submissionId || !status) {
            return NextResponse.json({ error: 'Missing submission ID or status' }, { status: 400 });
        }

        // Prepare the update object
        const updateData: any = { status };
        
        // If status is CORRECTED, we can set quality. If it's PENDING, reset quality to null.
        if (status === 'CORRECTED') {
            if (quality) updateData.quality = quality;
        } else {
            updateData.quality = null;
        }

        const submission = await AssignmentSubmission.findByIdAndUpdate(
            submissionId,
            updateData,
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
