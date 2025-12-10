
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function fixEmails() {
    console.log('🔧 Fixing Faculty Emails...');
    if (!process.env.MONGODB_URI) process.exit(1);
    await mongoose.connect(process.env.MONGODB_URI);

    const AttendanceSchema = new mongoose.Schema({ teacherName: String, teacherEmail: String }, { strict: false });
    const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

    // Update RB
    const resRB = await Attendance.updateMany(
        { teacherName: 'RB' },
        { $set: { teacherEmail: 'ritwick92@gmail.com' } }
    );
    console.log(`✅ Updated RB: ${resRB.modifiedCount} records.`);

    // Update SDS
    const resSDS = await Attendance.updateMany(
        { teacherName: 'SDS' },
        { $set: { teacherEmail: 'sudipta.sarkar@heritageit.edu' } }
    );
    console.log(`✅ Updated SDS: ${resSDS.modifiedCount} records.`);

    process.exit(0);
}

fixEmails().catch(console.error);
