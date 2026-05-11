import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import User from '@/models/User';

// GET - List all tests
export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const folderId = searchParams.get('folderId');
        const userEmail = request.headers.get('X-User-Email');

        if (!userEmail || userEmail === 'null' || userEmail.trim() === '') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager', 'copy_checker'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const query: any = {};
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
        if (!userEmail || userEmail === 'null' || userEmail.trim() === '') {
            return NextResponse.json({ error: 'Unauthorized - valid user email required' }, { status: 401 });
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
        if (!userEmail || userEmail === 'null' || userEmail.trim() === '') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager', 'copy_checker'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, graceMarksForModified, ...updates } = body;

        console.log('🔧 PUT request - ID:', id, 'Updates:', Object.keys(updates));

        if (!id) {
            return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
        }

        // Find test (no longer restricted to creator, admins/checkers can edit)
        const test = await OnlineTest.findOne({ _id: id });
        if (!test) {
            console.log('❌ Test not found');
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        console.log('📋 Current test status:', test.status, 'Current folderId:', test.folderId);

        // If deployed test, handle grace marks OR question updates (re-grading)
        // We ALWAYS check for question updates if status is deployed, to support "Auto-update correct option"
        if (test.status === 'deployed' && updates.questions) {
            const StudentTestAttempt = (await import('@/models/StudentTestAttempt')).default;

            // Check if global grace marks are being added via the dialog
            // NOTE: Global Grace Marks are now handled inside the re-grading loop below 
            // to ensure they are set/overwritten correctly rather than accumulated.

            // AUTO-REGRADING LOGIC
            // If questions changed, we must re-evaluate ALL completed attempts.
            // This handles:
            // 1. Correct Option changed.
            // 2. "Grace Question" enabled (isGrace=true).
            // 3. Marks changed.

            console.log('🔄 Re-grading all completed attempts for test:', id);
            const attempts = await StudentTestAttempt.find({ testId: id, status: 'completed' });

            // Map new questions for fast lookup (including comprehension sub-questions)
            const newQuestionsMap = new Map();
            updates.questions.forEach((q: any) => {
                newQuestionsMap.set(q.id, q);
                // Also map comprehension sub-questions so their answers can be re-graded
                if (q.type === 'comprehension' && q.subQuestions) {
                    q.subQuestions.forEach((sq: any) => newQuestionsMap.set(sq.id, sq));
                }
            });

            for (const attempt of attempts) {
                let newScore = 0;

                // If attempt has snapshot 'questions', update them.
                if (attempt.questions && attempt.questions.length > 0) {
                    attempt.questions = attempt.questions.map((q: any) => {
                        const updatedQ = newQuestionsMap.get(q.id);
                        if (updatedQ) {
                            // Explicitly overwrite properties including isGrace to ensure false overrides true
                            return { ...q, ...updatedQ, isGrace: updatedQ.isGrace };
                        }
                        return q;
                    });
                    attempt.markModified('questions');
                }

                // Track whether any per-question isGrace flags are active
                let hasPerQuestionGrace = false;

                // Re-grade answers
                attempt.answers = attempt.answers.map((ans: any) => {
                    const qDef = newQuestionsMap.get(ans.questionId);
                    if (!qDef) return ans; // Question removed? Keep old status.

                    let isCorrect = false;
                    let marksAwarded = 0;

                    // Logic source: similar to submit route
                    if (qDef.isGrace) {
                        // Grace question: Always correct, full marks
                        isCorrect = true;
                        marksAwarded = qDef.marks || 1;
                        ans.isGraceAwarded = true;
                        hasPerQuestionGrace = true;
                    } else {
                        ans.isGraceAwarded = false; // Reset if grace removed

                        // Standard Grading
                        if (qDef.type === 'mcq') {
                            const studentIdx = Array.isArray(ans.answer) ? ans.answer[0] : parseInt(ans.answer);
                            if (qDef.correctIndices?.includes(studentIdx)) {
                                isCorrect = true;
                                marksAwarded = qDef.marks || 1;
                            } else {
                                marksAwarded = -Math.abs(qDef.negativeMarks || 0);
                            }
                        } else if (qDef.type === 'msq') {
                            const studentIndices = Array.isArray(ans.answer) ? ans.answer.map((i: any) => parseInt(i)) : [];
                            const correctSorted = [...(qDef.correctIndices || [])].sort();
                            const studentSorted = [...studentIndices].sort();

                            const isMatch = JSON.stringify(correctSorted) === JSON.stringify(studentSorted);
                            if (isMatch) {
                                isCorrect = true;
                                marksAwarded = qDef.marks || 1;
                            } else {
                                marksAwarded = -Math.abs(qDef.negativeMarks || 0);
                            }
                        } else if (qDef.type === 'fillblank') {
                            if (qDef.isNumberRange) {
                                const val = parseFloat(ans.answer);
                                if (!isNaN(val) && val >= qDef.numberRangeMin && val <= qDef.numberRangeMax) {
                                    isCorrect = true;
                                    marksAwarded = qDef.marks || 1;
                                }
                            } else {
                                const studentAns = (ans.answer || '').toString().trim();
                                const correctAns = (qDef.fillBlankAnswer || '').toString().trim();
                                if (qDef.caseSensitive) {
                                    if (studentAns === correctAns) {
                                        isCorrect = true;
                                        marksAwarded = qDef.marks || 1;
                                    }
                                } else {
                                    if (studentAns.toLowerCase() === correctAns.toLowerCase()) {
                                        isCorrect = true;
                                        marksAwarded = qDef.marks || 1;
                                    }
                                }
                            }
                        }
                    }

                    ans.isCorrect = isCorrect;
                    ans.marksAwarded = marksAwarded;
                    // Preserve existing per-question adjustment marks
                    newScore += marksAwarded + (ans.adjustmentMarks || 0);

                    return ans;
                });

                // Handle global grace marks — but ONLY if no per-question isGrace flags are active.
                // Per-question isGrace already gives full marks for the affected question(s), so 
                // adding global graceMarks on top would double-count the same correction.
                if (hasPerQuestionGrace) {
                    // Per-question grace is handling the correction; reset global grace to avoid double-counting
                    attempt.graceMarks = 0;
                    attempt.graceReason = '';
                } else {
                    // No per-question grace — apply global grace marks from dialog
                    attempt.graceMarks = body.graceMarks || 0;
                    if (attempt.graceMarks > 0) {
                        attempt.graceReason = body.graceReason || 'Grace marks awarded';
                    } else {
                        attempt.graceReason = '';
                    }
                    newScore += attempt.graceMarks;
                }

                // Calculate Total Marks — properly handle comprehension sub-questions
                let currentTotalMarks = 0;
                const questionsSource = (attempt.questions && attempt.questions.length > 0) ? attempt.questions : updates.questions;
                for (const q of questionsSource) {
                    if (q.type === 'comprehension' && q.subQuestions) {
                        for (const sq of q.subQuestions) currentTotalMarks += sq.marks || 1;
                    } else {
                        currentTotalMarks += q.marks || 0;
                    }
                }

                if (currentTotalMarks === 0) currentTotalMarks = 1; // Prevent div/0

                attempt.score = newScore;
                attempt.percentage = Math.round((newScore / currentTotalMarks) * 100);

                attempt.markModified('answers');
                await attempt.save();
            }
        }

        // MERGE deployment updates instead of overwriting (prevents losing batches/times)
        if (updates.deployment) {
            if (!test.deployment) test.deployment = {};
            Object.assign(test.deployment, updates.deployment);
            test.markModified('deployment');
            delete updates.deployment;
        }

        // Update test - allow remaining fields
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

        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager', 'copy_checker'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
        }

        // Find test
        const test = await OnlineTest.findOne({ _id: id });
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
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
