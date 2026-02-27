import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

// POST - Deploy test to batches/students
export async function POST(request: NextRequest) {
    try {
        await dbConnect();

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { testId, batches, students, startTime, endTime, durationMinutes } = body;

        // Validation
        if (!testId) {
            return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
        }

        // Find test and check ownership
        const test = await OnlineTest.findOne({ _id: testId, createdBy: userEmail });
        if (!test) {
            return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
        }

        // Handle batches fallback for deployed tests
        let finalBatches = batches;
        if (test.status === 'deployed' && (!finalBatches || finalBatches.length === 0)) {
            finalBatches = test.deployment?.batches || [];
        }

        if (!finalBatches || finalBatches.length === 0) {
            return NextResponse.json({ error: 'At least one batch must be selected' }, { status: 400 });
        }

        // Calculate end time
        // TIMEZONE FIX: Handle missing timezone info by defaulting to IST
        const startStr = startTime.endsWith('Z') || startTime.includes('+') || startTime.includes('-')
            ? startTime : `${startTime}+05:30`;
        const start = new Date(startStr);

        let end: Date;
        if (endTime) {
            const endStr = endTime.endsWith('Z') || endTime.includes('+') || endTime.includes('-')
                ? endTime : `${endTime}+05:30`;
            end = new Date(endStr);
        } else {
            end = new Date(start.getTime() + durationMinutes * 60000);
        }

        // Update deployment
        test.deployment = {
            batches: finalBatches,
            students: students || [], // Optional: specific students
            startTime: start,
            endTime: end,
            durationMinutes
        };
        test.status = 'deployed';

        await test.save();

        return NextResponse.json({
            message: 'Test deployed successfully',
            test
        });
    } catch (error: any) {
        console.error('Error deploying test:', error);
        return NextResponse.json({ error: 'Failed to deploy test' }, { status: 500 });
    }
}
