import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILessonPlanItem {
    date: Date;
    type: 'Class' | 'Online' | 'Offline'; // Types as requested
    description: string;
    _id?: string; // For keying/editing specific rows if needed
}

export interface ILessonPlan extends Document {
    batch: string;
    plans: ILessonPlanItem[];
    createdAt?: Date;
    updatedAt?: Date;
}

const LessonPlanSchema = new Schema<ILessonPlan>({
    batch: {
        type: String,
        required: [true, 'Batch is required'],
        unique: true, // One document per batch containing all plans
        trim: true
    },
    plans: [{
        date: {
            type: Date,
            required: true
        },
        type: {
            type: String,
            enum: ['Class', 'Online', 'Offline'],
            required: true,
            default: 'Class'
        },
        description: {
            type: String,
            required: true,
            trim: true
        }
    }]
}, {
    timestamps: true
});

// Index for fast retrieval by batch
LessonPlanSchema.index({ batch: 1 });

const LessonPlan: Model<ILessonPlan> = mongoose.models.LessonPlan || mongoose.model<ILessonPlan>('LessonPlan', LessonPlanSchema);

export default LessonPlan;
