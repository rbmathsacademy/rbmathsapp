import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema({
    date: { type: String, required: true }, // YYYY-MM-DD
    teacherName: { type: String, required: true },
    teacherEmail: { type: String },
    department: { type: String, required: true },
    year: { type: String, required: true },
    course_code: { type: String, required: true },
    timeSlot: { type: String, required: true },
    presentStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    absentStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    createdAt: { type: Date, default: Date.now }
});

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Attendance;
}

export default mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
