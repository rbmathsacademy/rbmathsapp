
import mongoose from 'mongoose';

const AssignmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, enum: ['PDF', 'QUESTIONS'], required: true },
    content: {
        type: mongoose.Schema.Types.Mixed,
        required: true
        // If PDF: Base64 String (or Link)
        // If QUESTIONS: Array of question IDs (the full pool)
    },
    randomCount: { type: Number, default: 0 }, // If > 0, each student gets this many random questions from the pool
    batch: { type: String, required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentFolder', default: null },
    deadline: { type: Date, required: true },
    cooldownDuration: { type: Number, default: 0 }, // in minutes
    createdAt: { type: Date, default: Date.now }
});

// Force recompilation
if (mongoose.models.Assignment) {
    delete mongoose.models.Assignment;
}

export default mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
