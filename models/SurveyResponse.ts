import mongoose, { Schema, Document } from 'mongoose';

// Clean up model in development to avoid OverwriteModelError
if (process.env.NODE_ENV !== 'production') {
    delete (mongoose.models as any).SurveyResponse;
}

export interface ISurveyAnswer {
    questionId: string;
    answer: string | number | number[];  // text → string, mcq → number (index), checkbox → number[], rating → number
}

export interface ISurveyResponse extends Document {
    surveyId: mongoose.Types.ObjectId;
    studentPhone: string;
    studentName: string;
    batchName: string;
    answers: ISurveyAnswer[];
    submittedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const SurveyAnswerSchema = new Schema({
    questionId: { type: String, required: true },
    answer: { type: Schema.Types.Mixed, required: true }
}, { _id: false });

const SurveyResponseSchema = new Schema({
    surveyId: { type: Schema.Types.ObjectId, ref: 'Survey', required: true },
    studentPhone: { type: String, required: true },
    studentName: { type: String, required: true },
    batchName: { type: String, required: true },
    answers: [SurveyAnswerSchema],
    submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Unique compound index: one response per student per survey
SurveyResponseSchema.index({ surveyId: 1, studentPhone: 1 }, { unique: true });
SurveyResponseSchema.index({ surveyId: 1 });

export default mongoose.model<ISurveyResponse>('SurveyResponse', SurveyResponseSchema);
