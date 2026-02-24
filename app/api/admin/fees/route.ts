import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import FeeRecord from '@/models/FeeRecord';
import BatchStudent from '@/models/BatchStudent';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();

        // Determine if this is an adhoc entry (no real student)
        const isAdhoc = !!body.isAdhoc;

        // For adhoc entries, student is null; for regular entries, student is required
        if (!isAdhoc && !body.student) {
            return NextResponse.json({ error: 'Student is required for non-adhoc entries' }, { status: 400 });
        }

        // Determine if we need an invoice number
        const isPayment = !body.recordType || body.recordType === 'PAYMENT';
        let lastInvoiceNum = 0;
        let invoiceBaseFn = (num: number) => ``;

        // Only generate invoice for payments
        // Format: YYYY-MM-InvNumber (e.g., 2026-02-00001)

        if (isPayment) {
            const entryDate = body.entryDate ? new Date(body.entryDate) : new Date();
            const entryYear = entryDate.getFullYear();

            // Find all records whose invoice starts with the entryYear (e.g. "2026-")
            // This ensures we find the absolute max sequence for this year's invoices
            const records = await FeeRecord.find({
                invoiceNo: { $regex: `^${entryYear}-` }
            }).select('invoiceNo').lean();

            let maxSeq = 0;
            records.forEach(r => {
                if (r.invoiceNo) {
                    const parts = r.invoiceNo.split('-');
                    const seq = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                }
            });
            lastInvoiceNum = maxSeq;

            invoiceBaseFn = (seq: number) => {
                const invoiceMonth = (entryDate.getMonth() + 1).toString().padStart(2, '0');
                const invoiceYear = entryDate.getFullYear();
                return `${invoiceYear}-${invoiceMonth}-${seq.toString().padStart(5, '0')}`;
            };
        }

        // Build the base record fields
        const baseRecord: any = {
            ...body,
            isAdhoc,
            adhocStudentName: isAdhoc ? (body.adhocStudentName || 'Unknown') : null,
            student: isAdhoc ? null : body.student,
        };

        // Check if multi-month or single
        if (body.months && Array.isArray(body.months) && body.months.length > 0) {
            const recordsToCreate = body.months.map((monthStr: string, index: number) => {
                const feesMonth = new Date(monthStr);
                const isPay = !body.recordType || body.recordType === 'PAYMENT';

                return {
                    ...baseRecord,
                    feesMonth: feesMonth,
                    monthIndex: feesMonth.getMonth(),
                    year: feesMonth.getFullYear(),
                    invoiceNo: isPay ? invoiceBaseFn(lastInvoiceNum + index + 1) : undefined
                };
            });

            // Insert Many
            const newRecords = await FeeRecord.insertMany(recordsToCreate);
            return NextResponse.json({ success: true, records: newRecords, count: newRecords.length });

        } else {
            // Single Record Fallback (or if months not provided)
            const invoiceNo = isPayment ? invoiceBaseFn(lastInvoiceNum + 1) : undefined;

            const newRecord = await FeeRecord.create({
                ...baseRecord,
                invoiceNo
            });
            return NextResponse.json({ success: true, record: newRecord });
        }
    } catch (error: any) {
        console.error('Failed to create fee record', error);
        return NextResponse.json({ error: error.message || 'Failed to create record' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Record ID required' }, { status: 400 });
        }

        const deleted = await FeeRecord.findByIdAndDelete(id);
        if (!deleted) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Fee record deleted' });
    } catch (error: any) {
        console.error('Failed to delete fee record', error);
        return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);

        const batch = searchParams.get('batch');
        const sessionYear = searchParams.get('sessionYear');
        const year = searchParams.get('year');
        const paymentMonth = searchParams.get('paymentMonth'); // YYYY-MM (fees paid FOR)
        const entryMonth = searchParams.get('entryMonth'); // YYYY-MM (fees paid ON)
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const mode = searchParams.get('mode');
        const receiver = searchParams.get('receiver');
        const studentName = searchParams.get('studentName');

        const query: any = {};

        // Exclude adhoc from grid view
        const excludeAdhoc = searchParams.get('excludeAdhoc');
        if (excludeAdhoc === 'true') {
            query.isAdhoc = { $ne: true };
        }

        if (batch) query.batch = batch;

        if (year) {
            query.year = parseInt(year);
        }

        if (mode) query.paymentMode = mode;
        if (receiver) query.paymentReceiver = receiver;

        if (paymentMonth) {
            const [y, m] = paymentMonth.split('-').map(Number);
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0, 23, 59, 59);
            query.feesMonth = { $gte: start, $lte: end };
        }

        if (entryMonth) {
            const [y, m] = entryMonth.split('-').map(Number);
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0, 23, 59, 59);
            query.entryDate = { $gte: start, $lte: end };
        } else if (startDate || endDate) {
            query.entryDate = {};
            if (startDate) query.entryDate.$gte = new Date(startDate);
            if (endDate) query.entryDate.$lte = new Date(endDate);
        }

        if (studentName) {
            // Fuzzy search: replace spaces with .* and escape special chars
            const fuzzyName = studentName.trim().split(/\s+/).join('.*');
            const searchRegex = { $regex: fuzzyName, $options: 'i' };

            // Search by name OR phone number
            const students = await BatchStudent.find({
                $or: [
                    { name: searchRegex },
                    { phoneNumber: searchRegex }
                ]
            }).select('_id');

            const studentIds = students.map(s => s._id);
            // Also include adhoc records matching the name
            const fuzzyAdhocRegex = { $regex: fuzzyName, $options: 'i' };
            query.$or = [
                { student: { $in: studentIds } },
                { isAdhoc: true, adhocStudentName: fuzzyAdhocRegex }
            ];
        }

        const records = await FeeRecord.find(query)
            .populate('student', 'name phoneNumber')
            .sort({ entryDate: -1 })
            .lean(); // Use lean for performance and logging

        // Debug logging for troubleshooting "Unknown" student
        if (records.length > 0 && !records[0].student) {
            console.log('⚠️ WARNING: First record has null student after populate:', records[0]);
            console.log('Query used:', JSON.stringify(query));
        }

        return NextResponse.json({ records });
    } catch (error) {
        console.error('Failed to fetch fee records', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}
