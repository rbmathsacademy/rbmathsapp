
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

const StudentSchema = new Schema({
    roll: String,
    department: String,
    year: String,
    course_code: String
});
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // 1. Find Student
        const roll = '124'; // Student2 as mentioned by user
        const students = await Student.find({ roll });
        console.log(`Found ${students.length} student docs for roll ${roll}`);

        if (students.length === 0) return;

        const allCourseCodes = students.map(s => s.course_code);
        const department = students[0].department;
        const year = students[0].year;

        console.log('Courses:', allCourseCodes);

        // 2. Fetch Mass Bunks using the logic from the API
        const allCourseRecords = await Attendance.find({
            course_code: { $in: allCourseCodes },
            department: department,
            year: year
        });

        console.log(`Total Attendance Records for these courses: ${allCourseRecords.length}`);

        const massBunks = allCourseRecords.filter(r =>
            (!r.presentStudentIds || r.presentStudentIds.length === 0) &&
            r.absentStudentIds && r.absentStudentIds.length > 0
        );

        console.log(`Mass Bunks Count: ${massBunks.length}`);

        massBunks.forEach((mb, i) => {
            console.log(`\nMass Bunk #${i + 1}:`);
            console.log(`  ID: ${mb._id}`);
            console.log(`  Date: ${mb.date}`);
            console.log(`  Course: ${mb.course_code}`);
            console.log(`  Present: ${mb.presentStudentIds ? mb.presentStudentIds.length : 'null'}`);
            console.log(`  Absent: ${mb.absentStudentIds ? mb.absentStudentIds.length : 'null'}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
