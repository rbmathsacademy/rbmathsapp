import mongoose from 'mongoose';

const StudentTestAttemptSchema = new mongoose.Schema({
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnlineTest', required: true },
    studentEmail: { type: String, required: true },
    studentPhone: { type: String, required: true },
    studentName: { type: String, required: true },
    batchName: { type: String, required: true },
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed'],
        default: 'not_started'
    },
    startedAt: { type: Date },
    submittedAt: { type: Date },
    questions: [], // Snapshot of questions for this attempt (handled by code, mixed array)
    answers: [{
        questionId: String,
        answer: mongoose.Schema.Types.Mixed, // Can be string, array, etc.
        isCorrect: Boolean,
        marksAwarded: Number,
        adjustmentMarks: { type: Number, default: 0 },
        timeTaken: { type: Number, default: 0 }
    }],
    score: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 }, // in milliseconds
    graceMarks: { type: Number, default: 0 },
    graceReason: { type: String, default: '' },
    warningCount: { type: Number, default: 0 },
    violationLog: [{
        type: { type: String, enum: ['screen_away', 'google_assistant', 'focus_lost', 'resize_detected', 'bfcache_return', 'unknown'], default: 'unknown' },
        timestamp: { type: Date, default: Date.now },
        detail: { type: String, default: '' }
    }],
    resumeCount: { type: Number, default: 0 },
    terminationReason: { type: String, default: null }
}, { timestamps: true });

// Index for faster queries
StudentTestAttemptSchema.index({ testId: 1, studentPhone: 1 }, { unique: true });
StudentTestAttemptSchema.index({ testId: 1, status: 1 });
// "Covering" index: attempt documents are large (they embed the question paper), but analytics only
// needs these few fields, so MongoDB can answer straight from this index without reading any document.
StudentTestAttemptSchema.index({ testId: 1, studentPhone: 1, status: 1, score: 1, percentage: 1, submittedAt: 1, _id: 1 });

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.StudentTestAttempt;
}

export default mongoose.models.StudentTestAttempt || mongoose.model('StudentTestAttempt', StudentTestAttemptSchema);
