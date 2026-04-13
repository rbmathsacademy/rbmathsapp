import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OfflineExam from '@/models/OfflineExam';

export const dynamic = 'force-dynamic';

// PUT - Update an offline exam (edit marks, chapter name, date, etc.)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const body = await req.json();
        const { chapterName, testDate, fullMarks, results } = body;

        const exam = await OfflineExam.findById(id);
        if (!exam) {
            return NextResponse.json({ error: 'Offline exam not found' }, { status: 404 });
        }

        if (chapterName !== undefined) exam.chapterName = chapterName.trim();
        if (testDate !== undefined) exam.testDate = new Date(testDate);
        if (fullMarks !== undefined) exam.fullMarks = fullMarks;

        if (results !== undefined && Array.isArray(results)) {
            const fm = fullMarks !== undefined ? fullMarks : exam.fullMarks;
            exam.results = results.map((r: any) => {
                const numericMarks = parseFloat(r.marksObtained);
                let pct: number | string = '-';
                if (!isNaN(numericMarks) && typeof r.marksObtained !== 'string' || (typeof r.marksObtained === 'string' && !isNaN(Number(r.marksObtained)))) {
                    pct = parseFloat(((numericMarks / fm) * 100).toFixed(2));
                } else {
                    pct = r.marksObtained;
                }
                return {
                    ...r,
                    percentage: pct
                };
            });
        }

        await exam.save();

        return NextResponse.json({ success: true, exam });
    } catch (error: any) {
        console.error('Failed to update offline exam:', error);
        return NextResponse.json({ error: error.message || 'Failed to update offline exam' }, { status: 500 });
    }
}

// DELETE - Delete an offline exam
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        
        const result = await OfflineExam.findByIdAndDelete(id);
        if (!result) {
            return NextResponse.json({ error: 'Offline exam not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to delete offline exam:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete offline exam' }, { status: 500 });
    }
}
