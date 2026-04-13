import mongoose from 'mongoose';

const OfflineExamSchema = new mongoose.Schema({
    batch: { type: String, required: true },
    chapterName: { type: String, required: true },
    testDate: { type: Date, required: true },
    fullMarks: { type: Number, required: true },
    results: [{
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchStudent', required: true },
        studentPhone: { type: String, required: true },
        studentName: { type: String, required: true },
        marksObtained: { type: mongoose.Schema.Types.Mixed, required: true },
        percentage: { type: mongoose.Schema.Types.Mixed }
    }]
}, { timestamps: true });

// Index for efficient batch queries
OfflineExamSchema.index({ batch: 1, testDate: -1 });

// Prevent model overwrite in dev
if (mongoose.models.OfflineExam) {
    delete mongoose.models.OfflineExam;
}

export default mongoose.models.OfflineExam || mongoose.model('OfflineExam', OfflineExamSchema);
