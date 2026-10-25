import mongoose from 'mongoose';

// One entry per grading event (Claude batch / Claude "grade now" / Gemini import / manual edit),
// written by the shared save step in lib/aiGradeSave.ts. Lets the admin review what was checked,
// what it cost, and which students were warned. Entries are deleted after 180 days.
const GradingLogSchema = new mongoose.Schema({
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    submission: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentSubmission', index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchStudent' },
    studentName: { type: String, default: '' },
    code: { type: String, default: '' }, // short submission code shown on separator pages
    source: { type: String, enum: ['claude-batch', 'claude-now', 'gemini-import', 'manual-edit'], required: true },
    model: { type: String, default: null },
    status: { type: String, enum: ['done', 'failed', 'skipped'], default: 'done' },
    reason: { type: String, default: '' }, // why it failed / was skipped
    counts: {
        total: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        incorrect: { type: Number, default: 0 },
        skipped: { type: Number, default: 0 },
    },
    grade: { type: String, default: null },
    unreadable: { type: Boolean, default: false },
    notes: { type: Number, default: 0 },
    warning: {
        triggered: { type: Boolean, default: false },
        count: { type: Number, default: 0 },
        limit: { type: Number, default: null },
        notified: { type: Boolean, default: false },
    },
    usage: {
        input: { type: Number, default: 0 },
        output: { type: Number, default: 0 },
        cacheRead: { type: Number, default: 0 },
        cacheWrite: { type: Number, default: 0 },
    },
    costUSD: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    by: { type: String, default: '' }, // admin who started it
    reviewed: {
        at: { type: Date, default: null },
        by: { type: String, default: '' },
    },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 },
});
GradingLogSchema.index({ assignment: 1, createdAt: -1 });

export default mongoose.models.GradingLog || mongoose.model('GradingLog', GradingLogSchema);
