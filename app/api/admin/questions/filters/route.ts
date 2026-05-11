import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';
import User from '@/models/User';

const GLOBAL_ADMIN_KEY = 'globaladmin_25';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');

    // Build match filter based on auth
    const matchFilter: any = {};
    if (adminKey !== GLOBAL_ADMIN_KEY) {
        if (!email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Checkers and other admins can view all filter metrics
    }

    try {
        const result = await Question.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: null,
                    topics: { $addToSet: '$topic' },
                    subtopics: { $addToSet: '$subtopic' },
                    examNames: { $push: '$examNames' },
                    batches: { $push: '$batches' },
                    uploadedBys: { $addToSet: '$uploadedBy' }
                }
            }
        ]);

        if (!result || result.length === 0) {
            return NextResponse.json({
                topics: [],
                subtopics: [],
                examNames: [],
                batches: [],
                uploadedBys: [],
            });
        }

        const data = result[0];

        // Flatten examNames (array of arrays) and batches (array of arrays) to unique values
        const flatExamNames = Array.from(
            new Set((data.examNames || []).flat().filter(Boolean))
        ).sort();

        const flatBatches = Array.from(
            new Set((data.batches || []).flat().filter(Boolean))
        ).sort();

        return NextResponse.json({
            topics: (data.topics || []).filter(Boolean).sort(),
            subtopics: (data.subtopics || []).filter(Boolean).sort(),
            examNames: flatExamNames,
            batches: flatBatches,
            uploadedBys: (data.uploadedBys || []).filter(Boolean).sort(),
        });
    } catch (error: any) {
        console.error('[FILTERS API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
