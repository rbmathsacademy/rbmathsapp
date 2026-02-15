import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import FeeRecord from '@/models/FeeRecord';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { id, amount, remarks, feesMonth, paymentMode, paymentReceiver } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const updateData: any = {
            amount,
            remarks,
            paymentMode,
            paymentReceiver: paymentMode === 'Online' ? paymentReceiver : null
        };

        if (feesMonth) {
            const date = new Date(feesMonth);
            updateData.feesMonth = date;
            updateData.monthIndex = date.getMonth();
            updateData.year = date.getFullYear();
        }

        const updated = await FeeRecord.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!updated) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, record: updated });
    } catch (error: any) {
        console.error('Failed to update fee record', error);
        return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
    }
}
