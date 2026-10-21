
import mongoose from 'mongoose';

const AssignmentSubmissionSchema = new mongoose.Schema({
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchStudent', required: true },
    link: { type: String, required: false, default: '' }, // Drive File URL (empty for INTERACTIVE type)
    score: { type: Number, default: null }, // Score for INTERACTIVE assignments
    totalQuestions: { type: Number, default: null }, // Total steps for INTERACTIVE assignments
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
    overrideOnTime: { type: Boolean, default: false },
    status: { type: String, enum: ['PENDING', 'CORRECTED'], default: 'PENDING' },
    quality: { type: String, enum: ['GOOD', 'SATISFACTORY', 'POOR', null], default: null },
    // Question-wise review imported from the AI checker (see lib/aiGrading.ts). Shown to the student
    // once the submission is CORRECTED. Comments may contain inline LaTeX ($...$).
    aiReview: {
        type: new mongoose.Schema({
            totalQuestions: { type: Number, default: 0 },
            correct: { type: Number, default: 0 },
            incorrect: { type: Number, default: 0 },
            skippedOrIncomplete: { type: Number, default: 0 },
            unreadable: { type: Boolean, default: false },
            unreadableNote: { type: String, default: '' },
            summary: { type: String, default: '' },
            feedback: [{
                _id: false,
                question: { type: String, default: '' },
                status: { type: String, enum: ['INCORRECT', 'PARTIAL', 'INCOMPLETE', 'SKIPPED'], default: 'INCORRECT' },
                comment: { type: String, default: '' },
                errorType: { type: String, default: null }, // CONCEPT / METHOD / FORMULA / CALCULATION / SIGN / INCOMPLETE_STEPS / NOT_ATTEMPTED / OTHER
            }],
            aiGrade: { type: String, default: null }, // what the AI itself said (the saved grade is recomputed by the portal)
            importedAt: { type: Date, default: Date.now },
        }, { _id: false }),
        default: null,
    },
}, { timestamps: true });

// Force recompilation
if (mongoose.models.AssignmentSubmission) {
    delete mongoose.models.AssignmentSubmission;
}

export default mongoose.models.AssignmentSubmission || mongoose.model('AssignmentSubmission', AssignmentSubmissionSchema);
