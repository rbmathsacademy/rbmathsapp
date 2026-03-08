import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { questionIds, batches, mode } = body;

        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            return NextResponse.json({ error: 'questionIds array is required' }, { status: 400 });
        }
        if (!batches || !Array.isArray(batches) || batches.length === 0) {
            return NextResponse.json({ error: 'batches array is required' }, { status: 400 });
        }
        if (!['add', 'set', 'remove'].includes(mode)) {
            return NextResponse.json({ error: 'mode must be "add", "set", or "remove"' }, { status: 400 });
        }

        let result;

        if (mode === 'set') {
            // Replace batches entirely
            result = await Question.updateMany(
                { id: { $in: questionIds } },
                { $set: { batches } }
            );
        } else if (mode === 'add') {
            // Add batches (union — no duplicates)
            result = await Question.updateMany(
                { id: { $in: questionIds } },
                { $addToSet: { batches: { $each: batches } } }
            );
        } else if (mode === 'remove') {
            // Remove specified batches
            result = await Question.updateMany(
                { id: { $in: questionIds } },
                { $pullAll: { batches } }
            );
        }

        return NextResponse.json({
            success: true,
            modifiedCount: result?.modifiedCount || 0
        });
    } catch (error: any) {
        console.error('Batch tag error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update batches' }, { status: 500 });
    }
}
