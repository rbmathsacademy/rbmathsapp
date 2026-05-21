import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

// POST — Exclude a student from an online test
export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const { testId, phoneNumber } = await request.json();

        if (!testId || !phoneNumber) {
            return NextResponse.json({ error: 'testId and phoneNumber are required' }, { status: 400 });
        }

        const test = await OnlineTest.findByIdAndUpdate(
            testId,
            { $addToSet: { excludedStudents: phoneNumber } },
            { new: true }
        );

        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, excludedStudents: test.excludedStudents });
    } catch (error: any) {
        console.error('Exclude student from test error:', error);
        return NextResponse.json({ error: error.message || 'Failed to exclude student' }, { status: 500 });
    }
}

// DELETE — Re-include a student in an online test
export async function DELETE(request: NextRequest) {
    try {
        await dbConnect();
        const { testId, phoneNumber } = await request.json();

        if (!testId || !phoneNumber) {
            return NextResponse.json({ error: 'testId and phoneNumber are required' }, { status: 400 });
        }

        const test = await OnlineTest.findByIdAndUpdate(
            testId,
            { $pull: { excludedStudents: phoneNumber } },
            { new: true }
        );

        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, excludedStudents: test.excludedStudents });
    } catch (error: any) {
        console.error('Re-include student in test error:', error);
        return NextResponse.json({ error: error.message || 'Failed to re-include student' }, { status: 500 });
    }
}
