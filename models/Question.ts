import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    text: { type: String, required: true },
    type: { type: String, enum: ['broad', 'mcq', 'blanks', 'short'], required: true },
    topic: { type: String, required: true },
    subtopic: { type: String, required: true },
    image: { type: String }, // Base64 string for Image Questions
    uploadedBy: { type: String, required: true }, // User ID or Email
    facultyName: { type: String, required: true },
    examName: { type: String }, // Backwards compatibility
    examNames: { type: [String], default: [] }, // Multiple Exams
    marks: { type: Number },    // Marks for the question
    answer: { type: String },   // Correct Answer
    options: { type: [String] }, // MCQ Options
    hint: { type: String },     // Hint
    explanation: { type: String }, // Explanation
    // Tracks where this question is deployed
    deployments: [{
        courseId: { type: String, required: true }, // Batch Name
        folderId: { type: String, required: true }  // Folder ID
    }],
    createdAt: { type: Date, default: Date.now }
});

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Question;
}

export default mongoose.models.Question || mongoose.model('Question', QuestionSchema);
