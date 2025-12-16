
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in .env.local");
    process.exit(1);
}

const studentSchema = new mongoose.Schema({
    email: String,
    name: String,
    roll: String,
    department: String,
    year: String,
    course_code: String,
}, { strict: false });

const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);

async function cleanupData() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to DB");

        const students = await Student.find({});
        console.log(`Total Students: ${students.length}`);

        // 1. Identify Invalid Entries (Missing fields)
        const invalid = students.filter(s => !s.email || !s.roll || !s.course_code || !s.department || !s.year);
        console.log(`\nFound ${invalid.length} potential invalid entries (missing fields):`);
        invalid.forEach(s => {
            console.log(`- ID: ${s._id}, Name: ${s.name}, Roll: ${s.roll}, Dept: ${s.department}, Year: ${s.year}, Course: ${s.course_code}`);
        });

        // 2. Identify Potential Duplicates/Typo Ghosts
        // Group by normalized keys to find slight variations
        const courses = {};
        const departments = {};
        const years = {};

        students.forEach(s => {
            if (s.course_code) courses[s.course_code] = (courses[s.course_code] || 0) + 1;
            if (s.department) departments[s.department] = (departments[s.department] || 0) + 1;
            if (s.year) years[s.year] = (years[s.year] || 0) + 1;
        });

        console.log("\n--- Unique Values Found (Check for typos) ---");
        console.log("Departments:", Object.keys(departments).sort());
        console.log("Years:", Object.keys(years).sort());
        console.log("Courses:", Object.keys(courses).sort());

        // 3. Cleanup Logic (Commented out for safety initially)
        /*
        if (invalid.length > 0) {
            console.log(`\nDeleting ${invalid.length} invalid entries...`);
            const ids = invalid.map(s => s._id);
            await Student.deleteMany({ _id: { $in: ids } });
            console.log("Deletion complete.");
        }
        */

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

cleanupData();
