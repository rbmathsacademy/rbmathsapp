import mongoose from 'mongoose';

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300, // 5 minutes TTL
    },
});

export default mongoose.models.OTP || mongoose.model('OTP', OTPSchema);
