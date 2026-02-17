
import mongoose from 'mongoose';

const AssignmentSubmissionSchema = new mongoose.Schema({
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchStudent', required: true },
    link: { type: String, required: true }, // Drive File URL
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
    status: { type: String, enum: ['PENDING', 'CORRECTED'], default: 'PENDING' }
}, { timestamps: true });

// Force recompilation
if (mongoose.models.AssignmentSubmission) {
    delete mongoose.models.AssignmentSubmission;
}

export default mongoose.models.AssignmentSubmission || mongoose.model('AssignmentSubmission', AssignmentSubmissionSchema);
