import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import FeeRecord from '@/models/FeeRecord';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { id, amount, remarks, feesMonth, paidOnMonth, paymentMode, paymentReceiver } = await req.json();

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

        let shouldUpdateInvoice = false;
        let originalRecord = null;
        if (paidOnMonth) {
            const newEntryDate = new Date(paidOnMonth);
            updateData.entryDate = newEntryDate;
            originalRecord = await FeeRecord.findById(id).lean() as any;
            if (originalRecord && originalRecord.entryDate) {
                 const oldEntryDate = new Date(originalRecord.entryDate);
                 if (oldEntryDate.getFullYear() !== newEntryDate.getFullYear() || oldEntryDate.getMonth() !== newEntryDate.getMonth()) {
                     shouldUpdateInvoice = true;
                 }
            }
        }

        if (shouldUpdateInvoice && (!originalRecord.recordType || originalRecord.recordType === 'PAYMENT') && updateData.entryDate) {
             const entryDate = updateData.entryDate;
             const entryYear = entryDate.getFullYear();
             const records = await FeeRecord.find({
                 invoiceNo: { $regex: `^${entryYear}-` }
             }).select('invoiceNo').lean() as any[];
             
             let maxSeq = 0;
             records.forEach((r) => {
                 if (r.invoiceNo) {
                     const parts = r.invoiceNo.split('-');
                     const seq = parseInt(parts[parts.length - 1], 10);
                     if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                 }
             });
             
             const invoiceMonth = (entryDate.getMonth() + 1).toString().padStart(2, '0');
             const invoiceYear = entryDate.getFullYear();
             updateData.invoiceNo = `${invoiceYear}-${invoiceMonth}-${(maxSeq + 1).toString().padStart(5, '0')}`;
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
