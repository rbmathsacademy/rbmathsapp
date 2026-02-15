import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import FeeRecord from '@/models/FeeRecord';

export async function GET(req: Request) {
    try {
        await dbConnect();
        // Extract student ID from the URL manually since params might be tricky in some Next versions depending on folder structure, 
        // but here we are in [id] folder so params.id is correct.
        // Wait, the path is `app/api/admin/fees/student/[id]/last-payment/route.ts`? 
        // No, I put it as generic route for now.
        // Let's check the path I'm writing to. 
        // I should probably use query param if I didn't make a dynamic folder. 
        // The file path below is `.../last-payment/route.ts`. It doesn't have [id].
        // So I should use search params.

        const { searchParams } = new URL(req.url);
        const studentId = searchParams.get('studentId');

        if (!studentId) {
            return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
        }

        const lastRecord = await FeeRecord.findOne({ student: studentId })
            .sort({ feesMonth: -1 }) // Get latest month paid
            .select('feesMonth year monthIndex entryDate');

        return NextResponse.json({ lastPayment: lastRecord });
    } catch (error) {
        console.error('Failed to fetch last payment', error);
        return NextResponse.json({ error: 'Failed to fetch last payment' }, { status: 500 });
    }
}
