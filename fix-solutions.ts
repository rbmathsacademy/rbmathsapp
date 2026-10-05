import mongoose from 'mongoose';
import connectDB from './lib/db';
import OnlineTest from './models/OnlineTest';
import Question from './models/Question';

async function fix() {
    await connectDB();
    const tests = await OnlineTest.find({ isBoardSpecific: true });
    
    let updatedCount = 0;
    for (const test of tests) {
        let changed = false;
        
        for (const set of test.boardQuestionSets) {
            for (const q of set.questions) {
                if (!q.solutionText) {
                    const globalQ = await Question.findOne({ id: q.id }).lean();
                    if (globalQ && globalQ.explanation) {
                        q.solutionText = globalQ.explanation;
                        changed = true;
                    }
                }
            }
        }
        
        if (changed) {
            await test.save();
            updatedCount++;
        }
    }
    console.log(`Updated solutionText in ${updatedCount} tests.`);
    process.exit(0);
}

fix();
