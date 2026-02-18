import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import FeeRecord from '@/models/FeeRecord';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const phoneNumber = req.headers.get('x-user-phone');

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Find the Student
        const student = await BatchStudent.findOne({ phoneNumber }).select('_id');
        if (!student) {
            return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
        }

        // 2. Fetch Fee Records
        const records = await FeeRecord.find({
            student: student._id
        }).sort({ feesMonth: 1 });

        return NextResponse.json({ records });

    } catch (error: any) {
        console.error('Guardian fees error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
