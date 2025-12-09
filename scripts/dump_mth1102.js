
const mongoose = require('mongoose');
const { Schema } = mongoose;

const MONGODB_URI = 'mongodb://127.0.0.1:27017/hit-assignment-generator';

const AttendanceSchema = new Schema({
    date: Date,
    timeSlot: String,
    course_code: String,
    department: String,
    year: String,
    teacherName: String,
    presentStudentIds: [Schema.Types.ObjectId],
    absentStudentIds: [Schema.Types.ObjectId]
});
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);

        console.log('Fetching all MTH1102 records...');
        const records = await Attendance.find({ course_code: 'MTH1102' }).sort({ date: 1 });

        console.log(`Found ${records.length} records.`);
        records.forEach((r, i) => {
            console.log(`${i + 1}. [${r._id}] ${r.date.toISOString().split('T')[0]} | ${r.timeSlot} | ${r.teacherName}`);
            console.log(`   Present: ${r.presentStudentIds.length}, Absent: ${r.absentStudentIds.length}`);
            console.log(`   P_IDs: ${r.presentStudentIds}`);
            console.log(`   A_IDs: ${r.absentStudentIds}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
