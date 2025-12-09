
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const StudentSchema = new mongoose.Schema({}, { strict: false });
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

async function listStudents() {
    try {
        await mongoose.connect(MONGODB_URI);
        const students = await Student.find();
        console.log(`Found ${students.length} students`);
        students.forEach(s => {
            console.log(`Name: ${s.name}, Roll: '${s.roll}' (Type: ${typeof s.roll}), Verified: ${s.isVerified}, ID: ${s._id}`);
            console.log(`Password Hash: ${s.password ? s.password.substring(0, 10) + '...' : 'NONE'}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

listStudents();
