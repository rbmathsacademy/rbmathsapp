import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';

const GLOBAL_ADMIN_KEY = 'globaladmin_25';

export const dynamic = 'force-dynamic';

// GET ?batch=A|||B — every topic that has live questions tagged to those batches,
// with the distinct sub-topics under each. Used by the question bank's "Copy info"
// button to build an AI prompt that reuses existing categories.
export async function GET(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');
    if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const batchParam = new URL(req.url).searchParams.get('batch');
        const match: any = { deleted: { $ne: true } };

        if (batchParam) {
            const batchValues = batchParam.split('|||').filter(Boolean);
            const wantUntagged = batchValues.includes('Untagged');
            const realBatches = batchValues.filter(b => b !== 'Untagged');
            const clauses: any[] = [];
            if (realBatches.length > 0) clauses.push({ batches: { $in: realBatches } });
            if (wantUntagged) clauses.push({ batches: { $size: 0 } }, { batches: { $exists: false } });
            if (clauses.length > 0) match.$or = clauses;
        }

        const rows = await Question.aggregate([
            { $match: match },
            { $group: { _id: { topic: '$topic', subtopic: '$subtopic' } } },
        ]);

        const byTopic = new Map<string, Set<string>>();
        for (const r of rows) {
            const topic = (r._id.topic || '').trim();
            const sub = (r._id.subtopic || '').trim();
            if (!topic) continue;
            if (!byTopic.has(topic)) byTopic.set(topic, new Set());
            if (sub) byTopic.get(topic)!.add(sub);
        }

        const topics = [...byTopic.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([topic, subs]) => ({ topic, subtopics: [...subs].sort((a, b) => a.localeCompare(b)) }));

        return NextResponse.json({ topics });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
