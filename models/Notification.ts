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
    
    // Backward compatibility
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    isRead: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
