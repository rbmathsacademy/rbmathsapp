import mongoose from 'mongoose';

const BatchStudentSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    alternativePhone: { type: String, trim: true },
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
    },
    collegeName: { type: String, trim: true },
    modeOfClass: { type: String, enum: ['online', 'offline', ''], default: '' },
    noExpiry: { type: Boolean, default: false }  // If true, all online tests never expire for this student
}, { timestamps: true });

// Prevent overwrite
const BatchStudent = mongoose.models.BatchStudent || mongoose.model('BatchStudent', BatchStudentSchema);
export default BatchStudent;
