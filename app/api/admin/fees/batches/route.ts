import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        // Get unique courses from BatchStudent
        const batches = await BatchStudent.distinct('courses');
        console.log('Fetched batches:', batches); // DEBUG LOG
        return NextResponse.json({ batches: batches.sort() });
    } catch (error) {
        console.error('Failed to fetch batches', error);
        return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
    }
}
