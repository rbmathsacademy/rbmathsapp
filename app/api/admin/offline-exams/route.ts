import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OfflineExam from '@/models/OfflineExam';

export const dynamic = 'force-dynamic';

// POST - Create a new offline exam record
export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { batch, chapterName, testDate, fullMarks, results } = body;

        if (!batch || !chapterName || !testDate || !fullMarks || !results || !results.length) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        // Calculate percentages
        const processedResults = results.map((r: any) => ({
            ...r,
            percentage: parseFloat(((r.marksObtained / fullMarks) * 100).toFixed(2))
        }));

        const exam = await OfflineExam.create({
            batch,
            chapterName: chapterName.trim(),
            testDate: new Date(testDate),
            fullMarks,
            results: processedResults
        });

        return NextResponse.json({ success: true, exam }, { status: 201 });
    } catch (error: any) {
        console.error('Failed to create offline exam:', error);
        return NextResponse.json({ error: error.message || 'Failed to create offline exam' }, { status: 500 });
    }
}

// GET - List offline exams, optionally filtered by batch
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const batch = searchParams.get('batch');

        const query: any = {};
        if (batch) query.batch = batch;

        const exams = await OfflineExam.find(query)
            .sort({ testDate: -1 })
            .lean();

        return NextResponse.json({ exams });
    } catch (error: any) {
        console.error('Failed to fetch offline exams:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch offline exams' }, { status: 500 });
    }
}
