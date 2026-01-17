import mongoose from 'mongoose';

const FolderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    course: { type: String, required: true }, // Corresponds to Batch Name from CSV
    createdAt: { type: Date, default: Date.now }
});

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Folder;
}

export default mongoose.models.Folder || mongoose.model('Folder', FolderSchema);
