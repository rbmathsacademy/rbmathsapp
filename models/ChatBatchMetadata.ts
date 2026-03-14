import mongoose from 'mongoose';

const ChatBatchMetadataSchema = new mongoose.Schema({
    batchId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    lastAdminReadAt: {
        type: Date,
        default: new Date(0)
    }
}, { timestamps: true });

const ChatBatchMetadata = mongoose.models.ChatBatchMetadata || mongoose.model('ChatBatchMetadata', ChatBatchMetadataSchema);
export default ChatBatchMetadata;
