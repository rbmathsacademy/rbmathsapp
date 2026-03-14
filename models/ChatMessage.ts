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
    }
}, { timestamps: true });

// TTL index: auto-delete messages after 1 week (604800 seconds)
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);
export default ChatMessage;

