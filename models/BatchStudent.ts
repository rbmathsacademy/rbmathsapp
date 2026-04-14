import mongoose from 'mongoose';

const BatchStudentSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    name: String,
    courses: [String],
    guardianPhone: { type: String, trim: true },
    guardianName: { type: String, trim: true },
    email: { type: String, sparse: true, trim: true, lowercase: true },
    schoolName: { type: String, trim: true },
    board: { type: String, enum: ['CBSE', 'ISC', 'WBCHSE', 'Others'], trim: true },
    loginId: { type: String, unique: true, sparse: true, trim: true },
    dob: { type: String, trim: true },
    guestClass: { type: String, trim: true },
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        default: []
    }],
    chatReadStatus: {
        type: Map,
        of: Date,
        default: {}
    }
}, { timestamps: true });

// Prevent overwrite
const BatchStudent = mongoose.models.BatchStudent || mongoose.model('BatchStudent', BatchStudentSchema);
export default BatchStudent;
