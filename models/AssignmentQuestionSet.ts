
import mongoose from 'mongoose';

// Stores the per-student randomized question set for assignments with randomCount > 0.
// Generated once when a student first views the assignment, then persisted.
const AssignmentQuestionSetSchema = new mongoose.Schema({
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchStudent', required: true },
    questions: [{ type: String }], // Array of question _id strings
    createdAt: { type: Date, default: Date.now }
});

// Ensure one set per student per assignment
AssignmentQuestionSetSchema.index({ assignment: 1, student: 1 }, { unique: true });

// Force recompilation
if (mongoose.models.AssignmentQuestionSet) {
    delete mongoose.models.AssignmentQuestionSet;
}

export default mongoose.models.AssignmentQuestionSet || mongoose.model('AssignmentQuestionSet', AssignmentQuestionSetSchema);
