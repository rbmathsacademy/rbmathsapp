import mongoose from 'mongoose';

const FeeRecordSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BatchStudent',
        required: false,
        default: null
    },
    batch: {
        type: String,
        required: true
    },
    isAdhoc: {
        type: Boolean,
        default: false
    },
    adhocStudentName: {
        type: String,
        trim: true,
        default: null
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMode: {
        type: String,
        enum: ['Online', 'Offline'],
        required: true
    },
    paymentReceiver: {
        type: String, // 'MM' | 'RB' | null
        default: null
    },
    entryDate: {
        type: Date,
        default: Date.now
    },
    feesMonth: {
        type: Date, // The 1st of the month this fee is for
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    monthIndex: {
        type: Number, // 0-11
        required: true
    },
    remarks: {
        type: String,
        trim: true
    },
    invoiceNo: {
        type: String,
        unique: true,
        sparse: true, // Allows multiple null/undefined values
        required: false
    },
    recordType: {
        type: String, // 'PAYMENT' | 'NEW_ADMISSION' | 'EXEMPTED'
        enum: ['PAYMENT', 'NEW_ADMISSION', 'EXEMPTED'],
        default: 'PAYMENT',
        required: true
    }
}, { timestamps: true });

// Force recompilation of the model in dev mode if it exists, to ensure schema updates are applied
if (mongoose.models.FeeRecord) {
    delete mongoose.models.FeeRecord;
}

const FeeRecord = mongoose.model('FeeRecord', FeeRecordSchema);

export default FeeRecord;
