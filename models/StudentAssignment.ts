import mongoose from 'mongoose';

const StudentAssignmentSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentRoll: { type: String, required: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    status: { type: String, enum: ['pending', 'submitted', 'graded'], default: 'pending' },
    submissionUrl: { type: String },
    marksObtained: { type: Number },
    feedback: { type: String },
    submittedAt: { type: Date },
}, { timestamps: true });

// Compound index to ensure one assignment per student
StudentAssignmentSchema.index({ studentId: 1, assignmentId: 1 }, { unique: true });

export default mongoose.models.StudentAssignment || mongoose.model('StudentAssignment', StudentAssignmentSchema);
