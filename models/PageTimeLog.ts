import mongoose from 'mongoose';

const pageTimeLogSchema = new mongoose.Schema({
    studentPhone: { type: String, required: true },
    studentName: { type: String, required: true },
    batchNames: { type: [String], required: true },
    date: { type: String, required: true }, // Format YYYY-MM-DD
    pageName: { type: String, required: true, enum: ['assignments', 'question-bank'] },
    durationSeconds: { type: Number, required: true, default: 0 },
}, { timestamps: true });

// Compound index for fast queries and upserts
pageTimeLogSchema.index({ studentPhone: 1, date: 1, pageName: 1 }, { unique: true });
pageTimeLogSchema.index({ batchNames: 1, date: 1 });

export default mongoose.models.PageTimeLog || mongoose.model('PageTimeLog', pageTimeLogSchema);
