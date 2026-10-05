import mongoose from 'mongoose';
import connectDB from './lib/db';
import StudentTestAttempt from './models/StudentTestAttempt';

async function check() {
    await connectDB();
    const latestAttempt = await StudentTestAttempt.findOne().sort({ submittedAt: -1 }).lean();
    console.log(JSON.stringify(latestAttempt, null, 2));
    process.exit(0);
}

check();
