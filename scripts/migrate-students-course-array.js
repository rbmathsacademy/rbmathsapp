
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nextjs-portal';

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        const Student = mongoose.connection.collection('students');
        const students = await Student.find({}).toArray();

        console.log(`Found ${students.length} students.`);

        let updated = 0;
        for (const s of students) {
            if (typeof s.course_code === 'string') {
                console.log(`Migrating student: ${s.email} (Current: ${s.course_code})`);
                await Student.updateOne(
                    { _id: s._id },
                    { $set: { course_code: [s.course_code] } }
                );
                updated++;
            } else if (Array.isArray(s.course_code)) {
                // Already migrated
            } else {
                console.warn(`Student ${s.email} has invalid course_code type: ${typeof s.course_code}`);
            }
        }

        console.log(`Migration complete. Updated ${updated} students.`);

    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

migrate();
