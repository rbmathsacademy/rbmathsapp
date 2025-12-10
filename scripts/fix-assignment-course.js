
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function fixCourse() {
    console.log('🔧 Fixing Assignment Course Fields...');
    await mongoose.connect(process.env.MONGODB_URI);

    // Use loose schema to read all fields
    const AssignmentSchema = new mongoose.Schema({ course_code: String, targetCourse: String, title: String }, { strict: false });
    const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);

    const assignments = await Assignment.find({});
    let count = 0;

    for (const a of assignments) {
        let changed = false;
        // Logic: if targetCourse is missing but course_code exists, copy it.
        // Also if course_code is missing but targetCourse exists, copy back (sync).

        if (!a.targetCourse && a.course_code) {
            a.targetCourse = a.course_code;
            changed = true;
            console.log(`   Updated ${a.title}: Set targetCourse = ${a.course_code}`);
        }
        else if (!a.course_code && a.targetCourse) {
            a.course_code = a.targetCourse;
            changed = true;
            console.log(`   Updated ${a.title}: Set course_code = ${a.targetCourse}`);
        }

        if (changed) {
            await Assignment.updateOne({ _id: a._id }, { $set: { targetCourse: a.targetCourse, course_code: a.course_code } });
            count++;
        }
    }

    console.log(`✅ Fixed ${count} assignments.`);
    process.exit(0);
}
fixCourse();
