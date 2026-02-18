import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import LessonPlan from '@/models/LessonPlan';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { payload } = await jwtVerify(token, key);
        const { searchParams } = new URL(req.url);
        const requestedBatch = searchParams.get('batch');

        await dbConnect();

        // 1. Resolve Student and their batches
        const phoneNumber = payload.phoneNumber || payload.userId;
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
        const plans = lessonPlan ? lessonPlan.plans.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

        return NextResponse.json({
            success: true,
            plans,
            currentBatch: batchToFetch,
            availableBatches: studentBatches
        });

    } catch (error) {
        console.error("Student Lesson Plan API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch lesson plan' }, { status: 500 });
    }
}
