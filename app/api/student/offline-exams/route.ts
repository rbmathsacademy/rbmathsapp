import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import OfflineExam from '@/models/OfflineExam';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        const token = req.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
        const phoneNumber = payload.phoneNumber as string;

        const student = await BatchStudent.findOne({ phoneNumber }).lean();
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Fetch all offline exams for student's batches
        const exams = await OfflineExam.find({
            batch: { $in: student.courses }
        }).sort({ testDate: -1 }).lean();

        // Format results with batch stats and rank
        const formattedExams = exams.map((exam: any) => {
            const studentResult = exam.results.find((r: any) => r.studentPhone === phoneNumber);

            if (!studentResult) return null; // Student wasn't part of this exam

            // Calculate batch highest and average percentage
            const allPercentages = exam.results.map((r: any) => r.percentage);
            const highestPercentage = Math.max(...allPercentages);
            const averagePercentage = parseFloat(
                (allPercentages.reduce((sum: number, p: number) => sum + p, 0) / allPercentages.length).toFixed(2)
            );

            // Calculate rank (dense ranking - tied marks get same rank)
            const sortedPercentages = [...new Set(allPercentages as number[])].sort((a: number, b: number) => b - a);
            const rank = sortedPercentages.indexOf(studentResult.percentage) + 1;
            const totalStudents = exam.results.length;

            return {
                examId: exam._id,
                batch: exam.batch,
                chapterName: exam.chapterName,
                testDate: exam.testDate,
                fullMarks: exam.fullMarks,
                marksObtained: studentResult.marksObtained,
                percentage: studentResult.percentage,
                highestPercentage,
                averagePercentage,
                rank,
                totalStudents
            };
        }).filter(Boolean);

        return NextResponse.json({ offlineExams: formattedExams });
    } catch (error: any) {
        console.error('Student offline exams error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
