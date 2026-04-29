import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';
import OnlineTest from '@/models/OnlineTest';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';

const FREE_BATCH = 'Class XI (Free batch) 2026-27';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();

        const [questionCount, testCount, studentCount, staff] = await Promise.all([
            Question.countDocuments(),
            OnlineTest.countDocuments({ status: 'deployed' }),
            // Exclude students who are enrolled ONLY in the free batch
            BatchStudent.countDocuments({
                $nor: [{ courses: [FREE_BATCH] }]
            }),
            User.find({
                role: { $in: ['manager', 'copy_checker'] }
            }).select('name phoneNumber role email createdAt').sort({ createdAt: -1 })
        ]);

        return NextResponse.json({
            totalQuestions: questionCount,
            activeTests: testCount,
            totalStudents: studentCount,
            staff: staff || []
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
