import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';
import OnlineTest from '@/models/OnlineTest';
import BatchStudent from '@/models/BatchStudent';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();

        const [questionCount, testCount, studentCount] = await Promise.all([
            Question.countDocuments(),
            OnlineTest.countDocuments({ status: 'deployed' }),
            BatchStudent.countDocuments()
        ]);

        return NextResponse.json({
            totalQuestions: questionCount,
            activeTests: testCount,
            totalStudents: studentCount
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
