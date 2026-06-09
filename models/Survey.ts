import mongoose, { Schema, Document } from 'mongoose';

// Clean up model in development to avoid OverwriteModelError
if (process.env.NODE_ENV !== 'production') {
    delete (mongoose.models as any).Survey;
}

export interface ISurveyQuestion {
    id: string;
    text: string;
    type: 'mcq' | 'checkbox' | 'text' | 'rating';
    options?: string[];        // For mcq/checkbox
    ratingMax?: number;        // For rating (default 5)
    ratingLabels?: { low: string; high: string }; // e.g. "Poor" / "Excellent"
    required: boolean;
}

export interface ISurvey extends Document {
    title: string;
    description?: string;
    questions: ISurveyQuestion[];
    deployment?: {
        batches: string[];
        deployedAt: Date;
    };
    endDate?: Date;
    excludedStudents: string[];   // Phone numbers
    status: 'draft' | 'deployed' | 'closed';
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const SurveyQuestionSchema = new Schema({
    id: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, enum: ['mcq', 'checkbox', 'text', 'rating'], required: true },
    options: [String],
    ratingMax: { type: Number, default: 5 },
    ratingLabels: {
        low: { type: String, default: 'Poor' },
        high: { type: String, default: 'Excellent' }
    },
    required: { type: Boolean, default: true }
}, { _id: false });

const SurveySchema = new Schema({
    title: { type: String, required: true },
    description: String,
    questions: [SurveyQuestionSchema],
    deployment: {
        batches: [String],
        deployedAt: Date
    },
    endDate: Date,
    excludedStudents: { type: [String], default: [] },
    status: { type: String, enum: ['draft', 'deployed', 'closed'], default: 'draft' },
    createdBy: { type: String, required: true }
}, { timestamps: true });

SurveySchema.index({ status: 1 });
SurveySchema.index({ 'deployment.batches': 1 });

export default mongoose.model<ISurvey>('Survey', SurveySchema);
