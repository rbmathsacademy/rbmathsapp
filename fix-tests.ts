import mongoose from 'mongoose';
import connectDB from './lib/db';
import OnlineTest from './models/OnlineTest';

async function fix() {
    await connectDB();
    const tests = await OnlineTest.find({ isBoardSpecific: true });
    
    let updatedCount = 0;
    for (const test of tests) {
        let changed = false;
        
        // Re-grade attempts for this test!
        const StudentTestAttempt = (await import('./models/StudentTestAttempt')).default;
        const BatchStudent = (await import('./models/BatchStudent')).default;
        const { seededShuffleArray, shuffleOptionsForQuestion } = require('./lib/seededRandom');

        const attempts = await StudentTestAttempt.find({ testId: test._id, status: 'completed' });
        for (const attempt of attempts) {
            const cleanPhone = attempt.studentPhone.replace(/\D/g, '');
            const dbStudent = await BatchStudent.findOne({ phoneNumber: cleanPhone }).lean();
            const studentBoard = (dbStudent as any)?.board || '';

            let sourceQuestions = [];
            if (test.boardQuestionSets && test.boardQuestionSets.length > 0) {
                const assignedSet = test.boardQuestionSets.find((set: any) => 
                    set.boards.some((b: string) => b.toLowerCase() === studentBoard.toLowerCase())
                );
                sourceQuestions = assignedSet ? [...assignedSet.questions] : [...test.boardQuestionSets[0].questions];
            }

            if (test.config?.maxQuestionsToAttempt || test.config?.shuffleQuestions) {
                const seedString = `${attempt.studentPhone}_${test._id}`;
                const randomFunc = getSeededRandom(seedString);
                sourceQuestions = seededShuffleArray(sourceQuestions, randomFunc);
                if (test.config?.maxQuestionsToAttempt && test.config.maxQuestionsToAttempt > 0) {
                    sourceQuestions = sourceQuestions.slice(0, test.config.maxQuestionsToAttempt);
                }
            }

            const questionMap = new Map();
            sourceQuestions.forEach((sq: any) => {
                const qObj = sq.toObject ? sq.toObject() : JSON.parse(JSON.stringify(sq));
                const processed = shuffleOptionsForQuestion(qObj, attempt.studentPhone);
                questionMap.set(processed.id, processed);
            });

            let newScore = 0;
            const attemptAnswersMap = new Map();
            for (const a of (attempt.answers || [])) {
                attemptAnswersMap.set(a.questionId, a);
            }
            const normalizedAnswers = [];
            for (const qId of questionMap.keys()) {
                if (attemptAnswersMap.has(qId)) {
                    normalizedAnswers.push(attemptAnswersMap.get(qId));
                } else {
                    normalizedAnswers.push({ questionId: qId, answer: null, timeTaken: 0 });
                }
            }

            attempt.answers = normalizedAnswers.map((ans: any) => {
                const qDef = questionMap.get(ans.questionId);
                if (!qDef) return ans;

                let isCorrect = false;
                let marksAwarded = 0;

                if (ans.answer === null || ans.answer === undefined || ans.answer === '' || (Array.isArray(ans.answer) && ans.answer.length === 0)) {
                    if (!qDef.isGrace) {
                        marksAwarded = 0;
                        isCorrect = false;
                    }
                } else if (qDef.isGrace) {
                    isCorrect = true;
                    marksAwarded = qDef.marks || 1;
                } else if (qDef.type === 'mcq') {
                    if (qDef.correctIndices && qDef.correctIndices.length > 0) {
                        isCorrect = qDef.correctIndices[0] === ans.answer;
                    }
                    marksAwarded = isCorrect ? (qDef.marks || 1) : -(qDef.negativeMarks || 0);
                } else if (qDef.type === 'msq') {
                    if (qDef.correctIndices && Array.isArray(ans.answer)) {
                        const correct = new Set(qDef.correctIndices);
                        const selected = new Set(ans.answer);
                        isCorrect = correct.size === selected.size && [...correct].every((i:any) => selected.has(i));
                    }
                    marksAwarded = isCorrect ? (qDef.marks || 1) : -(qDef.negativeMarks || 0);
                }

                ans.isCorrect = isCorrect;
                ans.marksAwarded = Number(marksAwarded.toFixed(2));
                newScore += ans.marksAwarded + (ans.adjustmentMarks || 0);
                return ans;
            });

            newScore += (attempt.graceMarks || 0);
            
            let currentTotalMarks = 0;
            for (const q of sourceQuestions) {
                currentTotalMarks += q.marks || 0;
            }
            if (currentTotalMarks === 0) currentTotalMarks = 1;

            newScore = Math.max(0, newScore);
            attempt.score = Number(newScore.toFixed(2));
            attempt.percentage = Math.round((attempt.score / currentTotalMarks) * 100);

            attempt.markModified('answers');
            await attempt.save();
            updatedCount++;
        }
    }
    console.log(`Regraded ${updatedCount} attempts with proper slicing.`);
    process.exit(0);
}

// Add getSeededRandom implementation inside script because it might not be exported directly if not required properly
function getSeededRandom(seedStr: string): () => number {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    }
    const seed = function () {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return (h ^= h >>> 16) >>> 0;
    };
    const sfc32 = (a: number, b: number, c: number, d: number) => {
        return function () {
            a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
            var t = (a + b) | 0;
            a = b ^ b >>> 9;
            b = c + (c << 3) | 0;
            c = (c << 21 | c >>> 11);
            d = d + 1 | 0;
            t = t + d | 0;
            c = c + t | 0;
            return (t >>> 0) / 4294967296;
        }
    };
    return sfc32(seed(), seed(), seed(), seed());
}

fix();
