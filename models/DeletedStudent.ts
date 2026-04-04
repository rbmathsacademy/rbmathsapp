import mongoose from 'mongoose';

const DeletedStudentSchema = new mongoose.Schema({
    originalId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    studentData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    guardianData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    deletedAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // TTL index — MongoDB auto-deletes when current time >= expiresAt
    }
}, { timestamps: true });

// Force recompilation in dev
if (mongoose.models.DeletedStudent) {
    delete mongoose.models.DeletedStudent;
}

const DeletedStudent = mongoose.model('DeletedStudent', DeletedStudentSchema);
export default DeletedStudent;
