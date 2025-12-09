const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in .env.local');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Connection error:', err));

const attendanceSchema = new mongoose.Schema({
    date: String,
    department: String,
    year: String,
    course_code: String,
    timeSlot: String,
    presentStudentIds: [String],
    absentStudentIds: [String],
    teacherName: String,
    teacherEmail: String
}, { timestamps: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);

async function fixRecords() {
    try {
        const records = await Attendance.find({ teacherEmail: '' });
        console.log(`Found ${records.length} records with empty teacherEmail.`);

        let fixedCount = 0;
        for (const record of records) {
            if (record.teacherName && record.teacherName.startsWith('{')) {
                try {
                    const parsed = JSON.parse(record.teacherName);
                    if (parsed.name && parsed.email) {
                        record.teacherName = parsed.name;
                        record.teacherEmail = parsed.email;
                        await record.save();
                        fixedCount++;
                        console.log(`Fixed record ${record._id}: ${parsed.name} (${parsed.email})`);
                    }
                } catch (e) {
                    console.log(`Failed to parse teacherName for record ${record._id}: ${record.teacherName}`);
                }
            }
        }

        console.log(`Successfully fixed ${fixedCount} records.`);
    } catch (error) {
        console.error('Error fixing records:', error);
    } finally {
        mongoose.disconnect();
    }
}

fixRecords();
