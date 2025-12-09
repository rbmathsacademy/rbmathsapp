import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Attendance from '@/models/Attendance';

export async function POST(req: Request) {
    await dbConnect();
    try {
        const { records } = await req.json();

        if (!Array.isArray(records) || records.length === 0) {
            return NextResponse.json({ error: 'No records provided' }, { status: 400 });
        }

        const operations = records.map((record: any) => ({
            updateOne: {
                filter: {
                    date: record.date,
                    department: record.department,
                    year: record.year,
                    course_code: record.course_code,
                    timeSlot: record.timeSlot
                },
                update: { $set: record },
                upsert: true
            }
        }));

        await Attendance.bulkWrite(operations);

        return NextResponse.json({ message: 'Attendance saved successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const department = searchParams.get('department');
    const year = searchParams.get('year');
    const course_code = searchParams.get('course_code');

    const query: any = {};
    if (date) query.date = date;

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate && endDate) {
        query.date = { $gte: startDate, $lte: endDate };
    }

    if (department) query.department = department;
    if (year) query.year = year;
    if (course_code) query.course_code = course_code;

    try {
        const records = await Attendance.find(query).sort({ timeSlot: 1 });
        return NextResponse.json(records);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    await dbConnect();
    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        await Attendance.deleteMany({ _id: { $in: ids } });
        return NextResponse.json({ message: 'Records deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
