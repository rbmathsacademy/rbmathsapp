import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
    batchId: {
        type: String,
        required: true,
        index: true
    },
    senderId: {
        type: String, // 'admin' or student phone number
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    senderRole: {
        type: String,
        enum: ['student', 'admin'],
        required: true
    },
    content: {
        type: String, // text or image URL
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'image'],
        default: 'text'
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    originalContent: {
        type: String
    },
    replyTo: {
        messageId: { type: String },
        senderName: { type: String },
        content: { type: String },
        senderRole: { type: String }
    },
    isAiResponse: {
        type: Boolean,
        default: false
    },
    doubtMetadata: {
        targetStudentId: { type: String },
        status: { type: String, enum: ['pending', 'resolved', 'unresolved'] },
        doubtSessionId: { type: String }
    }
}, { timestamps: true });

// TTL index: auto-delete messages after 1 week (604800 seconds)
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

// Performance indexes to prevent slow queries that eat Vercel CPU wait time
ChatMessageSchema.index({ batchId: 1, createdAt: 1 });
ChatMessageSchema.index({ 'doubtMetadata.doubtSessionId': 1 });

const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);
export default ChatMessage;

