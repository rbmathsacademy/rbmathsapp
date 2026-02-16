import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

// GET - List all tests
export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const folderId = searchParams.get('folderId');
        const userEmail = request.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const query: any = { createdBy: userEmail };
        if (status) {
            const statusArray = status.split(',');
            if (statusArray.length > 1) {
                query.status = { $in: statusArray };
            } else {
                query.status = status;
            }
        }
        // Apply folder filter only when explicitly requested
        if (searchParams.has('folderId')) {
            const folderIdParam = searchParams.get('folderId');
            query.folderId = folderIdParam === 'null' ? null : folderIdParam;
        }

        console.log('🔍 GET /api/admin/online-tests - Query:', JSON.stringify(query));

        const tests = await OnlineTest.find(query).sort({ createdAt: -1 });

        console.log('📦 Found', tests.length, 'tests');

        return NextResponse.json(tests);
    } catch (error: any) {
        console.error('Error fetching online tests:', error);
        return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
    }
}

// POST - Create new test
export async function POST(request: NextRequest) {
    try {
        await dbConnect();

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { title, description, questions, config, deployment, folderId } = body;

        // Validation
        if (!title || !questions || questions.length === 0) {
            return NextResponse.json({ error: 'Title and questions are required' }, { status: 400 });
        }

        // Validate questions - STRICT VALIDATION SKIPPED FOR DRAFTS
        // We allow saving incomplete questions as drafts to improve user experience (e.g., auto-save).
        // Validation should be performed before DEPLOYMENT.

        /*
        for (const q of questions) {
            if (!q.text || !q.type) {
                return NextResponse.json({ error: 'Each question must have text and type' }, { status: 400 });
            }

            // Validate MCQ/MSQ
            if ((q.type === 'mcq' || q.type === 'msq') && (!q.options || q.options.length < 2)) {
                return NextResponse.json({ error: 'MCQ/MSQ must have at least 2 options' }, { status: 400 });
            }

            // Validate correctIndices
            if ((q.type === 'mcq' || q.type === 'msq') && (!q.correctIndices || q.correctIndices.length === 0)) {
                return NextResponse.json({ error: 'MCQ/MSQ must have correct answer(s)' }, { status: 400 });
            }

            // Validate comprehension has sub-questions
            if (q.type === 'comprehension' && (!q.subQuestions || q.subQuestions.length === 0)) {
                return NextResponse.json({ error: 'Comprehension questions must have sub-questions' }, { status: 400 });
            }

            // Validate fill-blank has answer or number range
            if (q.type === 'fillblank') {
                if (q.isNumberRange) {
                    if (q.numberRangeMin === undefined || q.numberRangeMin === null ||
                        q.numberRangeMax === undefined || q.numberRangeMax === null) {
                        return NextResponse.json({ error: 'Number range questions must have minimum and maximum values' }, { status: 400 });
                    }
                    if (Number(q.numberRangeMin) >= Number(q.numberRangeMax)) {
                        return NextResponse.json({ error: 'Minimum value must be less than maximum value' }, { status: 400 });
                    }
                } else if (!q.fillBlankAnswer) {
                    return NextResponse.json({ error: 'Fill-in-the-blank must have an answer' }, { status: 400 });
                }
            }
        }
        */

        // Create test
        const test = new OnlineTest({
            title,
            description,
            questions,
            config: config || {},
            deployment: deployment || {},
            createdBy: userEmail,
            folderId: folderId || null,
            status: 'draft'
        });

        await test.save();
        return NextResponse.json(test, { status: 201 });
    } catch (error: any) {
        console.error('Error creating test:', error);
        return NextResponse.json({ error: 'Failed to create test' }, { status: 500 });
    }
}

// PUT - Update test
export async function PUT(request: NextRequest) {
    try {
        await dbConnect();

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, graceMarksForModified, ...updates } = body;

        console.log('🔧 PUT request - ID:', id, 'Updates:', Object.keys(updates));

        if (!id) {
            return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
        }

        // Find test and check ownership
        const test = await OnlineTest.findOne({ _id: id, createdBy: userEmail });
        if (!test) {
            console.log('❌ Test not found or unauthorized');
            return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
        }

        console.log('📋 Current test status:', test.status, 'Current folderId:', test.folderId);

        // If deployed test, handle grace marks
        if (test.status === 'deployed' && updates.questions && body.graceMarks > 0) {
            const StudentTestAttempt = (await import('@/models/StudentTestAttempt')).default;
            const graceMarks = body.graceMarks;
            const graceReason = body.graceReason || 'Grace marks awarded';

            console.log(`🎁 Awarding ${graceMarks} grace marks to all completed attempts`);

            // Find all completed attempts for this test
            const attempts = await StudentTestAttempt.find({ testId: id, status: 'completed' });

            for (const attempt of attempts) {
                // Apply grace marks
                attempt.score = (attempt.score || 0) + graceMarks;
                attempt.graceMarks = (attempt.graceMarks || 0) + graceMarks;

                // Append reason if new
                if (attempt.graceReason) {
                    attempt.graceReason += `; ${graceReason}`;
                } else {
                    attempt.graceReason = graceReason;
                }

                // Recalculate percentage
                const totalMarks = test.totalMarks || 1;
                // Note: totalMarks might be updated in this same request, so use test.totalMarks if not updated yet, 
                // but actually updates are applied *after* this block. 
                // However, grace marks are usually independent of question changes.
                // Re-calculating percentage based on *current* score and *current* total marks.
                attempt.percentage = Math.round((attempt.score / totalMarks) * 100);

                await attempt.save();
            }
        }

        // Update test - allow all fields
        Object.assign(test, updates);
        await test.save();

        console.log('✅ Test updated! New folderId:', test.folderId);

        return NextResponse.json(test);
    } catch (error: any) {
        console.error('Error updating test:', error);
        return NextResponse.json({ error: 'Failed to update test' }, { status: 500 });
    }
}

// DELETE - Delete test
export async function DELETE(request: NextRequest) {
    try {
        await dbConnect();

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
        }

        // Find test and check ownership
        const test = await OnlineTest.findOne({ _id: id, createdBy: userEmail });
        if (!test) {
            return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
        }

        // Delete associated student attempts first
        const StudentTestAttempt = (await import('@/models/StudentTestAttempt')).default;
        const deleteResult = await StudentTestAttempt.deleteMany({ testId: id });
        console.log(`🗑️ Deleted ${deleteResult.deletedCount} attempts for test ${id}`);

        await OnlineTest.deleteOne({ _id: id });

        console.log('✅ Test deleted:', id);

        return NextResponse.json({ message: 'Test deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting test:', error);
        return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 });
    }
}
