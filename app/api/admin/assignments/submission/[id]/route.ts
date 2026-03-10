import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AssignmentSubmission from '@/models/AssignmentSubmission';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await dbConnect();

        const submission = await AssignmentSubmission.findByIdAndDelete(id);

        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Submission delete error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete submission' }, { status: 500 });
    }
}
