import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function inspect() {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const db = mongoose.connection.useDb('test');
    const collection = db.collection('studenttestattempts');
    const attempts = await collection.find({}).sort({ createdAt: -1 }).limit(3).toArray();
    for (const attempt of attempts) {
        console.log(`\nAttempt ID: ${attempt._id}`);
        console.log(`Status: ${attempt.status}`);
        console.log(`Questions length: ${attempt.questions?.length}`);
        console.log(`Answers length: ${attempt.answers?.length}`);
        console.log(`Time spent: ${attempt.timeSpent}`);
        console.log(`Resume count: ${attempt.resumeCount}`);
    }
    process.exit(0);
}
inspect().catch(console.error);
