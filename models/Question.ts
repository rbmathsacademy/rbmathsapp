import mongoose from 'mongoose';
import { QUESTION_TRASH_RETENTION_SECONDS } from '../lib/trashRetention';

const QuestionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    text: { type: String, required: true },
    type: { type: String, required: true },
    topic: { type: String, required: true },
    subtopic: { type: String, required: true },
    image: { type: String }, // Base64 string for Image Questions
    uploadedBy: { type: String, required: true }, // User ID or Email
    facultyName: { type: String, required: true },
    examName: { type: String }, // Backwards compatibility
    examNames: { type: [String], default: [] }, // Multiple Exams
    batches: { type: [String], default: [] }, // Batch tags for filtering
    marks: { type: mongoose.Schema.Types.Mixed }, // Marks (can be Number or String like "1+1")
    answer: { type: String },   // Correct Answer
    options: { type: [mongoose.Schema.Types.Mixed] }, // MCQ Options
    hint: { type: String },     // Hint
    explanation: { type: String }, // Explanation
    order: { type: Number, default: 0 },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

// Permanently remove trashed questions QUESTION_TRASH_RETENTION_DAYS after deletion.
// MongoDB's TTL monitor does this on its own (same approach as the student recycle bin).
// The partial filter means ONLY documents with deleted:true can ever expire — a live
// question can't be removed even if it somehow carries a stray deletedAt date.
// Restoring a question sets deletedAt back to null, which TTL ignores.
QuestionSchema.index(
    { deletedAt: 1 },
    { expireAfterSeconds: QUESTION_TRASH_RETENTION_SECONDS, partialFilterExpression: { deleted: true } }
);

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Question;
}

export default mongoose.models.Question || mongoose.model('Question', QuestionSchema);

