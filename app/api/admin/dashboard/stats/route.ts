import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';
import OnlineTest from '@/models/OnlineTest';
import BatchStudent from '@/models/BatchStudent';

const FREE_BATCH = 'Class XI (Free batch) 2026-27';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();

        const [questionCount, testCount, studentCount] = await Promise.all([
            Question.countDocuments(),
            OnlineTest.countDocuments({ status: 'deployed' }),
            // Exclude students who are enrolled ONLY in the free batch
            BatchStudent.countDocuments({
                $nor: [{ courses: [FREE_BATCH] }]
            })
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
