import mongoose from 'mongoose';
import connectDB from './lib/db';
import OnlineTest from './models/OnlineTest';
import BatchStudent from './models/BatchStudent';

async function check() {
    await connectDB();
    const testId = "6ac3ac96541bce552c049105";
    const studentPhone = "8902907084";

    const test = await OnlineTest.findById(testId).lean();
    console.log("TEST:", test.title, "isBoardSpecific:", test.isBoardSpecific);

    const student = await BatchStudent.findOne({ phoneNumber: studentPhone }).lean();
    console.log("STUDENT BOARD:", student.board);

    if (test.isBoardSpecific) {
        console.log("BOARD SETS:", test.boardQuestionSets.map((s:any) => s.boards));
        
        let assignedSet = test.boardQuestionSets.find((set: any) => 
            set.boards.some((b: string) => b.toLowerCase() === student.board.toLowerCase())
        );
        console.log("ASSIGNED SET MATCHED?", !!assignedSet);
        
        if (!assignedSet) assignedSet = test.boardQuestionSets[0];

        const q1 = assignedSet.questions.find((q:any) => q.id === "q_lpp_n7x2v9k3");
        const q2 = assignedSet.questions.find((q:any) => q.id === "q_lpp_h5s6e1q8");

        console.log("Q1 found:", !!q1, "Correct index:", q1?.correctIndices);
        console.log("Q2 found:", !!q2, "Correct index:", q2?.correctIndices);
    } else {
        const q1 = test.questions.find((q:any) => q.id === "q_lpp_n7x2v9k3");
        const q2 = test.questions.find((q:any) => q.id === "q_lpp_h5s6e1q8");
        console.log("Q1 found:", !!q1, "Correct index:", q1?.correctIndices);
        console.log("Q2 found:", !!q2, "Correct index:", q2?.correctIndices);
    }

    process.exit(0);
}

check();
