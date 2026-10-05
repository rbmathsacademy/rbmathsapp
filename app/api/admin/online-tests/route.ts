import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import User from '@/models/User';
import { shuffleOptionsForQuestion } from '@/lib/seededRandom';

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
        const { title, description, questions, config, deployment, folderId, isBoardSpecific, boardQuestionSets } = body;

        // Validation
        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }
        
        if (isBoardSpecific) {
            if (!boardQuestionSets || boardQuestionSets.length < 2) {
                return NextResponse.json({ error: 'At least 2 board question sets are required for a board specific test' }, { status: 400 });
            }
        } else if (!questions || questions.length === 0) {
            return NextResponse.json({ error: 'Questions are required' }, { status: 400 });
        }

        // Create test
        const test = new OnlineTest({
            title,
            description,
            isBoardSpecific: isBoardSpecific || false,
            questions: isBoardSpecific ? [] : questions,
            boardQuestionSets: isBoardSpecific ? boardQuestionSets : [],
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
        const { id, ...updates } = body;

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
        if (test.status === 'deployed' && (updates.questions || updates.boardQuestionSets)) {
            const StudentTestAttempt = (await import('@/models/StudentTestAttempt')).default;
            const BatchStudent = (await import('@/models/BatchStudent')).default;

            // AUTO-REGRADING LOGIC
            // If questions changed, we must re-evaluate ALL completed attempts.

            console.log('🔄 Re-grading all completed attempts for test:', id);
            const attempts = await StudentTestAttempt.find({ testId: id, status: 'completed' });

            const isBoardSpecific = updates.isBoardSpecific ?? test.isBoardSpecific;

            for (const attempt of attempts) {
                // Find student's board
                const cleanPhone = attempt.studentPhone.replace(/\D/g, '');
                const dbStudent = await BatchStudent.findOne({ phoneNumber: cleanPhone }).lean();
                const studentBoard = (dbStudent as any)?.board || '';

                // Resolve source questions for this attempt
                let sourceQuestions = [];
                if (isBoardSpecific && updates.boardQuestionSets && updates.boardQuestionSets.length > 0) {
                    const assignedSet = updates.boardQuestionSets.find((set: any) => 
                        set.boards.some((b: string) => b.toLowerCase() === studentBoard.toLowerCase())
                    );
                    sourceQuestions = assignedSet ? [...assignedSet.questions] : [...updates.boardQuestionSets[0].questions];
                } else {
                    sourceQuestions = [...(updates.questions || [])];
                }

                // Map new questions for fast lookup (including comprehension sub-questions)
                const newQuestionsMap = new Map();
                sourceQuestions.forEach((q: any) => {
                    newQuestionsMap.set(q.id, q);
                    // Also map comprehension sub-questions so their answers can be re-graded
                    if (q.type === 'comprehension' && q.subQuestions) {
                        q.subQuestions.forEach((sq: any) => newQuestionsMap.set(sq.id, sq));
                    }
                });

                let newScore = 0;

                // Track whether any per-question isGrace flags are active
                let hasPerQuestionGrace = false;

                const attemptAnswersMap = new Map();
                for (const a of (attempt.answers || [])) {
                    attemptAnswersMap.set(a.questionId, a);
                }
                const normalizedAnswers = [];
                for (const qId of newQuestionsMap.keys()) {
                    if (attemptAnswersMap.has(qId)) {
                        normalizedAnswers.push(attemptAnswersMap.get(qId));
                    } else {
                        normalizedAnswers.push({ questionId: qId, answer: null, timeTaken: 0 });
                    }
                }

                // Re-grade answers using deterministic shuffling
                attempt.answers = normalizedAnswers.map((ans: any) => {
                    const rawQDef = newQuestionsMap.get(ans.questionId);
                    if (!rawQDef) return ans; // Question removed? Keep old status.

                    // Dynamically reconstruct what the student saw
                    const qObj = typeof rawQDef.toObject === 'function' ? rawQDef.toObject() : JSON.parse(JSON.stringify(rawQDef));
                    const qDef = shuffleOptionsForQuestion(qObj, attempt.studentPhone);

                    let isCorrect = false;
                    let marksAwarded = 0;

                    // Check if the question was skipped (unanswered) first.
                    // Skipped questions always get 0 — never negative marks.
                    const isSkipped = ans.answer === null || ans.answer === undefined || ans.answer === '' ||
                        (Array.isArray(ans.answer) && ans.answer.length === 0);

                    // Logic source: similar to submit route
                    if (qDef.isGrace) {
                        // Grace question: Always correct, full marks
                        isCorrect = true;
                        marksAwarded = qDef.marks || 1;
                        ans.isGraceAwarded = true;
                        hasPerQuestionGrace = true;
                    } else if (isSkipped) {
                        // Unanswered: 0 marks, no penalty
                        ans.isGraceAwarded = false;
                        marksAwarded = 0;
                        isCorrect = false;
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
                                } else {
                                    marksAwarded = -Math.abs(qDef.negativeMarks || 0);
                                }
                            } else {
                                const studentAns = (ans.answer || '').toString().trim();
                                const correctAns = (qDef.fillBlankAnswer || '').toString().trim();
                                if (qDef.caseSensitive) {
                                    if (studentAns === correctAns) {
                                        isCorrect = true;
                                        marksAwarded = qDef.marks || 1;
                                    } else {
                                        marksAwarded = -Math.abs(qDef.negativeMarks || 0);
                                    }
                                } else {
                                    if (studentAns.toLowerCase() === correctAns.toLowerCase()) {
                                        isCorrect = true;
                                        marksAwarded = qDef.marks || 1;
                                    } else {
                                        marksAwarded = -Math.abs(qDef.negativeMarks || 0);
                                    }
                                }
                            }
                        }
                    }

                    ans.isCorrect = isCorrect;
                    ans.marksAwarded = Number(marksAwarded.toFixed(2));
                    // Preserve existing per-question adjustment marks
                    newScore += ans.marksAwarded + (ans.adjustmentMarks || 0);

                    return ans;
                });

                // Add any existing global grace marks that were awarded historically
                newScore += (attempt.graceMarks || 0);

                // Calculate Total Marks — properly handle comprehension sub-questions
                let currentTotalMarks = 0;
                const questionsSourceForMarks = (attempt.questions && attempt.questions.length > 0) ? attempt.questions : sourceQuestions;
                for (const q of questionsSourceForMarks) {
                    if (q.type === 'comprehension' && q.subQuestions) {
                        for (const sq of q.subQuestions) currentTotalMarks += sq.marks || 1;
                    } else {
                        currentTotalMarks += q.marks || 0;
                    }
                }

                if (currentTotalMarks === 0) currentTotalMarks = 1; // Prevent div/0

                newScore = Math.max(0, newScore); // Ensure score doesn't go below 0
                attempt.score = Number(newScore.toFixed(2));
                attempt.percentage = Math.round((attempt.score / currentTotalMarks) * 100);

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

        // Strip isGrace from updates.questions so it doesn't affect future attempts
        if (updates.questions) {
            updates.questions = updates.questions.map((q: any) => {
                const cleanQ = { ...q };
                delete cleanQ.isGrace;
                return cleanQ;
            });
        }
        
        if (updates.boardQuestionSets) {
            updates.boardQuestionSets = updates.boardQuestionSets.map((set: any) => ({
                ...set,
                questions: (set.questions || []).map((q: any) => {
                    const cleanQ = { ...q };
                    delete cleanQ.isGrace;
                    return cleanQ;
                })
            }));
        }

        // Update test - allow remaining fields
        Object.assign(test, updates);
        await test.save();

        console.log('✅ Test updated! New folderId:', test.folderId);

        return NextResponse.json(test);
    } catch (error: any) {
        console.error('Error updating test:', error);
        return NextResponse.json({ error: 'Failed to update test', details: error.message || String(error) }, { status: 500 });
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
