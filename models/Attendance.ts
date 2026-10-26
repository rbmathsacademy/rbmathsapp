import mongoose from 'mongoose';

/** One class-day of attendance for a batch. Every student of the batch at the time of saving has a record. */
const AttendanceSchema = new mongoose.Schema({
    batch: { type: String, required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD (India time)
    records: [{
        _id: false,
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchStudent' },
        name: { type: String, default: '' },
        present: { type: Boolean, default: true },
    }],
    savedBy: { type: String, default: '' },
}, { timestamps: true });

AttendanceSchema.index({ batch: 1, date: 1 }, { unique: true });

export default mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
