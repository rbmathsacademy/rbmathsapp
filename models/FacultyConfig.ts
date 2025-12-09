import mongoose from 'mongoose';

const FacultyConfigSchema = new mongoose.Schema({
    facultyName: { type: String, required: true, unique: true },
    rootFolderId: { type: String, required: true },
    scriptUrl: { type: String, required: true },
}, { timestamps: true });

export default mongoose.models.FacultyConfig || mongoose.model('FacultyConfig', FacultyConfigSchema);
