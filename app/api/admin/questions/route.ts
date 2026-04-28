import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';
import User from '@/models/User';

const GLOBAL_ADMIN_KEY = 'globaladmin_25';

export async function GET(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');
    const url = new URL(req.url);
    const lightweight = url.searchParams.get('lightweight') === 'true';
    
    // Server-side filter params
    const topicParam = url.searchParams.get('topic');
    const subtopicParam = url.searchParams.get('subtopic');
    const examParam = url.searchParams.get('exam');
    const batchParam = url.searchParams.get('batch');
    const searchParam = url.searchParams.get('search');
    
    // Use projection to exclude heavy fields if lightweight=true
    const projection = lightweight ? { image: 0, explanation: 0, options: 0, answer: 0, hint: 0 } : {};

    // Build base query based on auth
    const baseQuery: any = {};
    if (adminKey === GLOBAL_ADMIN_KEY) {
        // Global admin sees all
    } else if (email) {
        baseQuery.uploadedBy = email;
    } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apply server-side filters
    if (topicParam) {
        baseQuery.topic = { $in: topicParam.split(',') };
    }
    if (subtopicParam) {
        baseQuery.subtopic = { $in: subtopicParam.split(',') };
    }
    if (examParam) {
        baseQuery.examNames = { $in: examParam.split(',') };
    }
    if (batchParam) {
        const batchValues = batchParam.split(',');
        const wantUntagged = batchValues.includes('Untagged');
        const realBatches = batchValues.filter(b => b !== 'Untagged');
        
        if (wantUntagged && realBatches.length > 0) {
            baseQuery.$or = [
                { batches: { $size: 0 } },
                { batches: { $exists: false } },
                { batches: { $in: realBatches } }
            ];
        } else if (wantUntagged) {
            baseQuery.$or = [
                { batches: { $size: 0 } },
                { batches: { $exists: false } }
            ];
        } else if (realBatches.length > 0) {
            baseQuery.batches = { $in: realBatches };
        }
    }
    if (searchParam) {
        baseQuery.$or = [
            ...(baseQuery.$or || []),
            { text: { $regex: searchParam, $options: 'i' } },
            { topic: { $regex: searchParam, $options: 'i' } },
            { subtopic: { $regex: searchParam, $options: 'i' } },
            { id: { $regex: searchParam, $options: 'i' } }
        ];
    }

    try {
        const questions = await Question.find(baseQuery, projection).sort({ createdAt: 1 }).lean();
        return NextResponse.json(questions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');

    if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let uploaderEmail = email;
        let facultyName = 'Global Admin';

        if (email) {
            const user = await User.findOne({ email });
            if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
            facultyName = user.name;
            uploaderEmail = email;
        } else {
            // Global Admin without email
            uploaderEmail = 'global_admin';
        }

        const body = await req.json();
        const { questions } = body; // Expecting an array of questions

        if (!Array.isArray(questions)) {
            console.error('[API] Invalid data format: questions is not an array');
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Validate questions
        for (const q of questions) {
            // Allow EITHER examName OR examNames (or both)
            const hasExamInfo = q.examName || (q.examNames && q.examNames.length > 0);

            // Detailed validation log
            if (!q.text || !q.type || !q.topic || !q.subtopic) {
                console.error('[API] Validation Failed (Missing Core Fields):', { id: q.id, text: q.text, type: q.type, topic: q.topic, subtopic: q.subtopic });
                return NextResponse.json({ error: 'Missing required core fields (text, type, topic, subtopic)' }, { status: 400 });
            }

            // Soften validation for legacy data: if marks undefined, default to 0? Or just warn?
            // User might be editing answers for questions that don't have marks set yet.
            // Let's NOT failing for missing marks/exams during an ANSWER update if we can avoid it.
            // But this is an overwrite. If we save without exam/marks, we might lose them if we passed partial object?
            // Frontend passes FULL object. So if they are missing in frontend, they are missing here.

            if (!hasExamInfo) {
                console.warn('[API] Warning: Question missing exam info:', q.id);
                // For now, allow it to pass if we are just updating answers? No, safely enforce but log.
                // Actually, let's allow it to proceed if it's an existing question (id exists).
                // But wait, the user complaint is "reverts back". This means error.
            }
        }

        // Precompute max order for topics
        const topics = [...new Set(questions.map((q: any) => q.topic))];
        const maxOrderMap: Record<string, number> = {};
        for (const topic of topics) {
            const maxQ = await Question.findOne({ topic }).sort({ order: -1 }).select('order');
            maxOrderMap[topic] = maxQ?.order || 0;
        }

        console.log(`[API] Bulk update for ${questions.length} questions`);

        const operations = questions.map((q: any) => {
            let insertOrder = 0;
            if (q.order === undefined || q.order === null) {
                 maxOrderMap[q.topic] = (maxOrderMap[q.topic] || 0) + 1;
                 insertOrder = maxOrderMap[q.topic];
            }

            const updateFields: any = {
                id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: q.text,
                type: q.type,
                topic: q.topic,
                subtopic: q.subtopic,
                image: q.image,
                examName: q.examName,
                examNames: q.examNames || [],
                marks: q.marks ?? 0,
                answer: q.answer,
                options: q.options || [],
                hint: q.hint,
                explanation: q.explanation,
                uploadedBy: uploaderEmail,
                facultyName: facultyName
            };

            if (q.order !== undefined && q.order !== null) {
                updateFields.order = q.order;
            }

            return {
                updateOne: {
                    filter: { id: q.id },
                    update: {
                        $set: updateFields,
                        $setOnInsert: {
                            createdAt: new Date(),
                            ...(q.order === undefined || q.order === null ? { order: insertOrder } : {})
                        }
                    },
                    upsert: true
                }
            };
        });

        const result = await Question.bulkWrite(operations);
        console.log('[API] Bulk write result:', result);

        return NextResponse.json({ message: 'Questions saved successfully', result });
    } catch (error: any) {
        console.error('[API] Save Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');

    if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        // Only delete questions owned by this user
        const query: any = { id: { $in: ids } };
        if (adminKey !== GLOBAL_ADMIN_KEY) {
            query.uploadedBy = email;
        }

        await Question.deleteMany(query);

        return NextResponse.json({ message: 'Questions deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
