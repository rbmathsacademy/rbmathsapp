import mongoose from 'mongoose';

// Work queue for Claude grading. One job = one student submission.
//   queued -> preparing (PDF being fetched, request built) -> batched (sent in a Message Batch)
//   -> collecting (result being saved) -> done | failed | skipped
// "Grade now" jobs skip the queue (preparing -> done) unless they time out and fall back to a batch.
const ClaudeGradingJobSchema = new mongoose.Schema({
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    submission: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentSubmission', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchStudent', required: true },
    code: { type: String, default: '' },
    board: { type: String, default: '' }, // key board ('' when the assignment is not board-wise)
    submissionLink: { type: String, default: '' }, // snapshot: a replaced file invalidates the job
    status: { type: String, enum: ['queued', 'preparing', 'batched', 'collecting', 'done', 'failed', 'skipped'], default: 'queued' },
    mode: { type: String, enum: ['batch', 'now'], default: 'batch' },
    effort: { type: String, default: 'medium' },
    batchId: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: '' },
    by: { type: String, default: '' },
    usage: {
        input: { type: Number, default: 0 },
        output: { type: Number, default: 0 },
        cacheRead: { type: Number, default: 0 },
        cacheWrite: { type: Number, default: 0 },
    },
    costUSD: { type: Number, default: 0 },
    // Set when the job reaches a final state; MongoDB's TTL then removes it after 30 days
    expiresAt: { type: Date, default: null, index: { expires: 0 } },
}, { timestamps: true });
ClaudeGradingJobSchema.index({ assignment: 1, status: 1 });
ClaudeGradingJobSchema.index({ batchId: 1 });
ClaudeGradingJobSchema.index({ submission: 1, status: 1 });

export default mongoose.models.ClaudeGradingJob || mongoose.model('ClaudeGradingJob'
, ClaudeGradingJobSchema);
