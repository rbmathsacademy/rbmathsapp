import mongoose from 'mongoose';
import connectDB from './lib/db';
import Question from './models/Question';

async function check() {
    await connectDB();
    const q1 = await Question.findOne({ id: "q_lpp_n7x2v9k3" }).lean();
    console.log(JSON.stringify(q1, null, 2));
    process.exit(0);
}

check();
