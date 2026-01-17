import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
    },
    role: {
        type: String,
        enum: ['student', 'admin'],
        default: 'student',
    },
    name: {
        type: String,
        required: [true, 'Please provide a name'],
    },
    otp: {
        type: String,
        select: false,
    },
    otpExpiry: {
        type: Date,
        select: false,
    },
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        default: []
    }],
}, { timestamps: true });

// Force recompilation
if (mongoose.models.User) {
    delete mongoose.models.User;
}

const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;
