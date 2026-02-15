import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import FeeRecord from '@/models/FeeRecord';
import BatchStudent from '@/models/BatchStudent';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();

        const year = body.year || new Date().getFullYear();
        // Get base count for invoice generation
        const baseCount = await FeeRecord.countDocuments({ year });

        // Check if multi-month or single
        if (body.months && Array.isArray(body.months) && body.months.length > 0) {
            const recordsToCreate = body.months.map((monthStr: string, index: number) => {
                const feesMonth = new Date(monthStr);
                return {
                    ...body,
                    feesMonth: feesMonth,
                    monthIndex: feesMonth.getMonth(),
                    // year: feesMonth.getFullYear(), // Use the year from the month? Or the session year?
                    // Usually fee year follows the month year.
                    year: feesMonth.getFullYear(),
                    invoiceNo: `FEE-${year}-${(baseCount + index + 1).toString().padStart(5, '0')}`
                };
            });

            // Insert Many
            const newRecords = await FeeRecord.insertMany(recordsToCreate);
            return NextResponse.json({ success: true, records: newRecords, count: newRecords.length });

        } else {
            // Single Record Fallback (or if months not provided)
            const invoiceNo = `FEE-${year}-${(baseCount + 1).toString().padStart(5, '0')}`;
            const newRecord = await FeeRecord.create({
                ...body,
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
        const paymentMonth = searchParams.get('paymentMonth'); // YYYY-MM
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const mode = searchParams.get('mode');
        const receiver = searchParams.get('receiver');
        const studentName = searchParams.get('studentName');

        const query: any = {};

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
            query.student = { $in: studentIds };
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
