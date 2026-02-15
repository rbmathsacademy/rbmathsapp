import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const batch = searchParams.get('batch');
        const studentName = searchParams.get('studentName');

        const query: any = {};

        if (batch) {
            // Escape regex special characters to handle batches like "1st Sem Engg (Maths)"
            const escapedBatch = batch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.courses = { $elemMatch: { $regex: new RegExp(`^${escapedBatch}$`, 'i') } };
        }

        if (studentName) {
            const fuzzyName = studentName.trim().split(/\s+/).join('.*');
            const searchRegex = { $regex: fuzzyName, $options: 'i' };

            // Allow search by name OR phone
            query.$or = [
                { name: searchRegex },
                { phoneNumber: searchRegex }
            ];
        }

        const students = await BatchStudent.find(query)
            .select('name phoneNumber courses createdAt')
            .lean()
            .sort({ name: 1 });

        console.log(`Fetched ${students.length} students for batch ${batch || 'ALL'} search ${studentName || 'NONE'}`);

        return NextResponse.json({ students });
    } catch (error) {
        console.error('Failed to fetch students', error);
        return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }
}
