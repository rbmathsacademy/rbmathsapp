
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Define minimal schemas to read data
const StudentAssignment = mongoose.model('StudentAssignment', new mongoose.Schema({}, { strict: false }));
const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }));
const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
const Assignment = mongoose.model('Assignment', new mongoose.Schema({}, { strict: false }));

async function inspect() {
    if (!process.env.MONGODB_URI) {
        console.error('No MONGODB_URI');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');

    const subCount = await StudentAssignment.countDocuments();
    const attCount = await Attendance.countDocuments();
    const subOne = await StudentAssignment.findOne();
    const attOne = await Attendance.findOne();

    console.log(`\n📊 Status:`);
    console.log(`- Submissions: ${subCount}`);
    console.log(`- Attendance: ${attCount}`);

    if (subOne) {
        console.log('\n📝 Sample Submission:', JSON.stringify(subOne, null, 2));
        // Verify linkage
        const s = await Student.findById(subOne.studentId);
        const a = await Assignment.findById(subOne.assignmentId);
        console.log('   - Linked Student:', s ? `${s.name} (${s.roll})` : 'MISSING!');
        console.log('   - Linked Assignment:', a ? a.title : 'MISSING!');
    }

    if (attCount > 0) {
        // ... (existing code) ...
    }

    // Check Assignment
    const lastAss = await Assignment.findOne().sort({ createdAt: -1 });
    if (lastAss) {
        console.log('\n📝 Last Assignment:', JSON.stringify({
            title: lastAss.title,
            type: lastAss.type,
            course_code: lastAss.course_code,
            targetCourse: lastAss.targetCourse,
            targetDepartments: lastAss.targetDepartments,
            questions: lastAss.questions?.length
        }, null, 2));
    }

    process.exit(0);
}

inspect().catch(console.error);
