import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function inspect() {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const db = mongoose.connection.useDb('test');
    const collection = db.collection('studenttestattempts');
    const attempt = await collection.findOne({ status: 'in_progress' });
    if (attempt) {
        console.log(`Attempt ID: ${attempt._id}`);
        console.log(`Has questions: ${Array.isArray(attempt.questions)} | length: ${attempt.questions?.length}`);
        console.log(`Has answers: ${Array.isArray(attempt.answers)} | length: ${attempt.answers?.length}`);
        console.log(`Time spent: ${attempt.timeSpent}`);
        console.log(JSON.stringify(attempt.answers, null, 2));
    } else {
        // try any attempt
        const anyAttempt = await collection.findOne({});
        console.log(`Any attempt: ${anyAttempt?._id}, questions length: ${anyAttempt?.questions?.length}`);
    }
    process.exit(0);
}
inspect().catch(console.error);
