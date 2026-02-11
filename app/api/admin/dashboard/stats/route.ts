import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';
import OnlineTest from '@/models/OnlineTest';
import { fetchSheetData } from '@/lib/googleSheet';

export async function GET(request: NextRequest) {
    try {
        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        // Fetch all 3 counts in parallel
        const [totalQuestions, activeTests, sheetData] = await Promise.all([
            Question.countDocuments({ uploadedBy: userEmail }),
            OnlineTest.countDocuments({ status: 'deployed', createdBy: userEmail }),
            fetchSheetData(),
        ]);

        // Deduplicate students by phone number
        const uniquePhones = new Set(
            sheetData.map(row => row.phoneNumber.replace(/\D/g, ''))
        );
        const totalStudents = uniquePhones.size;

        return NextResponse.json({
            totalStudents,
            totalQuestions,
            activeTests,
        });
    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
