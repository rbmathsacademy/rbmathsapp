import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PageTimeLog from '@/models/PageTimeLog';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const batch = searchParams.get('batch');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!batch || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const matchStage: any = {
            batchNames: batch,
            date: { $gte: startDate, $lte: endDate }
        };

        const results = await PageTimeLog.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        studentPhone: '$studentPhone',
                        studentName: '$studentName'
                    },
                    assignmentsTime: {
                        $sum: {
                            $cond: [{ $eq: ['$pageName', 'assignments'] }, '$durationSeconds', 0]
                        }
                    },
                    questionBankTime: {
                        $sum: {
                            $cond: [{ $eq: ['$pageName', 'question-bank'] }, '$durationSeconds', 0]
                        }
                    },
                    totalTime: { $sum: '$durationSeconds' }
                }
            },
            {
                $project: {
                    _id: 0,
                    studentPhone: '$_id.studentPhone',
                    studentName: '$_id.studentName',
                    assignmentsTime: 1,
                    questionBankTime: 1,
                    totalTime: 1
                }
            },
            { $sort: { totalTime: -1 } }
        ]);

        return NextResponse.json({ data: results });
    } catch (error: any) {
        console.error('Time tracking analytics error:', error);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
