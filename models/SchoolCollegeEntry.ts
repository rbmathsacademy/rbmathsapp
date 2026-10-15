import mongoose from 'mongoose';

// A standalone, append-only directory of school/college names ever entered for a
// student. Deliberately NOT derived from BatchStudent via distinct() — that list
// shrinks when students are deleted. Entries here are added once and kept forever,
// so admins always see every school/college that's ever been used, for the
// add/edit-student dropdown, regardless of which students still exist.
const SchoolCollegeEntrySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, trim: true, lowercase: true },
    type: { type: String, enum: ['school', 'college'], required: true },
}, { timestamps: true });

SchoolCollegeEntrySchema.index({ type: 1, nameLower: 1 }, { unique: true });

export default mongoose.models.SchoolCollegeEntry || mongoose.model('SchoolCollegeEntry', SchoolCollegeEntrySchema);
