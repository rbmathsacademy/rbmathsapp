import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');
    if (!email && adminKey !== 'globaladmin_25') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const PREDEFINED_BATCHES = [
        '1st/3rd Sem Major/Minor',
        '2nd/4th Sem Major/Minor',
        '3rd Sem Major',
        '4th Sem Major',
        '5th Sem Major',
        '5th Sem Minor',
        '6th Sem Major',
        'Class 8',
        'Class XI',
        'Class XI JEE',
        'Class XII',
        'Class XII JEE',
        'Class XI Applied Maths',
        'Class XII Applied Maths',
        'BCA',
        '1st Sem Engg',
        '2nd Sem Engg',
        '3rd Sem Engg',
        '4th Sem Engg',
        '1st/3rd Sem Statistics',
        '2nd/4th Sem Statistics',
        '5th Sem Statistics',
    ];

    try {
        const baseMatch = { deleted: { $ne: true } };

        // Total and untagged counts
        const total = await Question.countDocuments(baseMatch);
        const untagged = await Question.countDocuments({
            ...baseMatch,
            $or: [
                { batches: { $exists: false } },
                { batches: null },
                { batches: { $size: 0 } },
            ]
        });

        // Per-batch counts using aggregation
        const batchAgg = await Question.aggregate([
            { $match: baseMatch },
            { $unwind: { path: '$batches', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$batches', count: { $sum: 1 } } },
        ]);

        const perBatch: Record<string, number> = {};
        // Seed with 0 for all predefined batches
        PREDEFINED_BATCHES.forEach(b => { perBatch[b] = 0; });
        // Fill in actual counts
        batchAgg.forEach(({ _id, count }) => {
            if (_id) perBatch[_id] = count;
        });

        return NextResponse.json({ total, untagged, perBatch });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
