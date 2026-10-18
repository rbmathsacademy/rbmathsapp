import mongoose from 'mongoose';

// A small, rebuildable summary of one completed test attempt: for each (topic, sub-topic),
// how many questions the student was served / got right / skipped.
//
// Why it exists: the real attempt documents are large (they embed the whole question paper with
// solutions and images), and reading them from the database takes ~20s for a single batch.
// The weakness analysis reads these tiny summaries instead and builds any missing ones on demand.
//
// It is derived data — safe to delete at any time; it simply gets rebuilt. It must be cleared
// for a test whenever that test's attempts are re-graded (see the online-tests PUT route).
const AttemptTopicStatSchema = new mongoose.Schema({
    attemptId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    testId: { type: mongoose.Schema.Types.ObjectId, required: true },
    studentPhone: { type: String, required: true },
    percentage: { type: Number, default: null },
    version: { type: Number, required: true },
    groups: [{
        _id: false,
        t: { type: String, default: '' },
        s: { type: String, default: '' },
        n: { type: Number, default: 0 },
        c: { type: Number, default: 0 },
        k: { type: Number, default: 0 },
    }],
}, { timestamps: true });

AttemptTopicStatSchema.index({ testId: 1, studentPhone: 1 });

if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.AttemptTopicStat;
}

export default mongoose.models.AttemptTopicStat || mongoose.model('AttemptTopicStat', AttemptTopicStatSchema);
