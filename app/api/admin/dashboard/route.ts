import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';
import OnlineTest from '@/models/OnlineTest';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();

        const [questionCount, testCount, studentCount, staff] = await Promise.all([
            Question.countDocuments(),
            OnlineTest.countDocuments({ status: 'deployed' }),
            BatchStudent.countDocuments(),
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
