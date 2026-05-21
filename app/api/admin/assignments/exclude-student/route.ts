import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';

// POST — Exclude a student from an assignment
export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const { assignmentId, phoneNumber } = await request.json();

        if (!assignmentId || !phoneNumber) {
            return NextResponse.json({ error: 'assignmentId and phoneNumber are required' }, { status: 400 });
        }

        const assignment = await Assignment.findByIdAndUpdate(
            assignmentId,
            { $addToSet: { excludedStudents: phoneNumber } },
            { new: true }
        );

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, excludedStudents: assignment.excludedStudents });
    } catch (error: any) {
        console.error('Exclude student from assignment error:', error);
        return NextResponse.json({ error: error.message || 'Failed to exclude student' }, { status: 500 });
    }
}

// DELETE — Re-include a student in an assignment
export async function DELETE(request: NextRequest) {
    try {
        await dbConnect();
        const { assignmentId, phoneNumber } = await request.json();

        if (!assignmentId || !phoneNumber) {
            return NextResponse.json({ error: 'assignmentId and phoneNumber are required' }, { status: 400 });
        }

        const assignment = await Assignment.findByIdAndUpdate(
            assignmentId,
            { $pull: { excludedStudents: phoneNumber } },
            { new: true }
        );

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, excludedStudents: assignment.excludedStudents });
    } catch (error: any) {
        console.error('Re-include student in assignment error:', error);
        return NextResponse.json({ error: error.message || 'Failed to re-include student' }, { status: 500 });
    }
}
