
import mongoose from 'mongoose';

const AssignmentFolderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Force recompilation
if (mongoose.models.AssignmentFolder) {
    delete mongoose.models.AssignmentFolder;
}

export default mongoose.models.AssignmentFolder || mongoose.model('AssignmentFolder', AssignmentFolderSchema);
