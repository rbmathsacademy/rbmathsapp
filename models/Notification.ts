import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    // For standard 1-to-1 notifications (backward compatibility)
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, 
    
    // Core fields
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    
    // Type of notification
    type: { type: String, enum: ['popup', 'standard'], default: 'standard' },
    
    // For broadcast/popup notifications
    targetBatches: [{ type: String }],
    targetStudents: [{ 
        phoneNumber: String,
        studentName: String,
        batchName: String 
    }],
    startDate: { type: Date },
    endDate: { type: Date },
    
    // Tracking who has read broadcast notifications
    readBy: [{ type: String }], // Array of student phone numbers
    // When true, a popup is shown to each student only until they dismiss it (used for personal warnings)
    oncePerStudent: { type: Boolean, default: false },
    
    // Backward compatibility
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    isRead: { type: Boolean, default: false },
}, { timestamps: true });

// Expired notifications (endDate passed) are removed from the database automatically (MongoDB TTL index, checked about once a minute)
NotificationSchema.index({ endDate: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
