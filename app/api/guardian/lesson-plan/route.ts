import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import LessonPlan from '@/models/LessonPlan';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const phoneNumber = req.headers.get('x-user-phone');
        const { searchParams } = new URL(req.url);
        const requestedBatch = searchParams.get('batch');

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Find the Student
        const student = await BatchStudent.findOne({ phoneNumber });
        if (!student) {
            return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
        }

        const studentBatches = student.courses || [];

        // 2. Determine which batch to fetch
        const batchToFetch = requestedBatch || (studentBatches.length > 0 ? studentBatches[0] : null);

        if (!batchToFetch) {
            return NextResponse.json({ success: true, plans: [], batches: studentBatches });
        }

        // 3. Fetch Lesson Plan
        const lessonPlan = await LessonPlan.findOne({ batch: batchToFetch });
        const plans = lessonPlan ? lessonPlan.plans.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

        return NextResponse.json({
            success: true,
            plans,
            currentBatch: batchToFetch,
            availableBatches: studentBatches
        });

    } catch (error: any) {
        console.error('Guardian lesson plan error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
