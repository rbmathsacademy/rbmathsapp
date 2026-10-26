
import mongoose from 'mongoose';

const AssignmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, enum: ['PDF', 'QUESTIONS', 'INTERACTIVE'], required: true },
    content: {
        type: mongoose.Schema.Types.Mixed,
        required: false
        // If PDF: Base64 String (or Link)
        // If QUESTIONS: Array of question IDs (the full pool)
        // If INTERACTIVE: not used (set to 'INTERACTIVE')
    },
    interactiveHtmlId: { type: String, default: null }, // ID of the interactive HTML assignment variant
    randomCount: { type: Number, default: 0 }, // If > 0, each student gets this many random questions from the pool
    batch: { type: String, required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentFolder', default: null },
    deadline: { type: Date, required: true },
    scheduledFor: { type: Date, default: null }, // If set, students cannot access until this time
    cooldownDuration: { type: Number, default: 0 }, // in minutes
    boardWise: { type: Boolean, default: false },
    boardContent: {
        type: Map,
        of: String, // board name → Drive URL
        default: {}
    },
    excludedStudents: [{ type: String }], // Phone numbers of students excluded from this assignment
    // When not empty, the assignment is only for these students (phone numbers), not the whole batch
    targetStudents: [{ type: String }],
    // Flag graded students with more than this many (wrong + skipped) questions; null = no limit
    warningLimit: { type: Number, default: null },
    // Students (BatchStudent ids) who were asked to redo this assignment: they may delete and
    // upload again even after the deadline. Removed again once they have uploaded.
    redoAllowed: [{ type: String }],
    // Topic / sub-topic of each question in the paper, from the AI checker's reply. Lets each
    // student's question-wise result feed the weakness analysis alongside online tests.
    aiQuestionMap: [{
        _id: false,
        question: { type: String, default: '' },
        topic: { type: String, default: '' },
        subtopic: { type: String, default: '' },
    }],
    // "Prepare paper": the teacher-approved question list of each paper (one entry per board for
    // board-wise assignments, board "" otherwise) with topic, sub-topic and expected answer, plus an
    // optional Drive link to the teacher's own solutions PDF. Batch prompts and PDFs use it, and
    // the weakness analysis prefers it over the AI's per-batch topic map.
    paperKeys: [{
        _id: false,
        board: { type: String, default: '' },
        questions: [{
            _id: false,
            question: { type: String, default: '' },
            topic: { type: String, default: '' },
            subtopic: { type: String, default: '' },
            answer: { type: String, default: '' },
        }],
        solutionsUrl: { type: String, default: '' },
        savedAt: { type: Date, default: Date.now },
    }],
    createdAt: { type: Date, default: Date.now }
});

// Force recompilation
if (mongoose.models.Assignment) {
    delete mongoose.models.Assignment;
}

export default mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
