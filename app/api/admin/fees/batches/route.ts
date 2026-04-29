import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

const FREE_BATCH = 'Class XI (Free batch) 2026-27';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        // Get unique courses from BatchStudent, excluding the free batch
        const batches = await BatchStudent.distinct('courses');
        const filteredBatches = batches.filter(
            (b: string) => b.toLowerCase() !== FREE_BATCH.toLowerCase()
        );
        console.log('Fetched batches:', filteredBatches); // DEBUG LOG
        return NextResponse.json({ batches: filteredBatches.sort() });
    } catch (error) {
        console.error('Failed to fetch batches', error);
        return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
    }
}
