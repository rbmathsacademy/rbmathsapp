import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    isRead: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
