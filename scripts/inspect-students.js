
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = "mongodb+srv://ritwick:ritwick@cluster0.p78d6.mongodb.net/lms?retryWrites=true&w=majority";

const studentSchema = new mongoose.Schema({
    email: String,
    name: String,
    department: String,
    year: String,
    course_code: String,
}, { strict: false });

const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);

async function inspectData() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to DB");

        const students = await Student.find({});
        console.log(`Total Students: ${students.length}`);

        const depts = {};
        const years = {};
        const courses = {};

        students.forEach(s => {
            const d = JSON.stringify(s.department);
            const y = JSON.stringify(s.year);
            const c = JSON.stringify(s.course_code);

            depts[d] = (depts[d] || 0) + 1;
            years[y] = (years[y] || 0) + 1;
            courses[c] = (courses[c] || 0) + 1;
        });

        console.log("\n--- Departments ---");
        console.table(depts);

        console.log("\n--- Years ---");
        console.table(years);

        console.log("\n--- Courses ---");
        console.table(courses);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

inspectData();
