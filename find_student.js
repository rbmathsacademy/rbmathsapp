const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Define Schema inline to avoid import issues with TS files in Node
const StudentSchema = new mongoose.Schema({
    name: String,
    email: String,
    roll: String,
    isVerified: Boolean
});

const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

async function run() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI not found');
            return;
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const student = await Student.findOne({ isVerified: false });
        if (student) {
            console.log('Found unverified student:', JSON.stringify(student, null, 2));
        } else {
            console.log('No unverified students found. Creating one...');
            const newStudent = await Student.create({
                name: 'Test Student',
                email: 'test.student@heritageit.edu.in',
                roll: '999999',
                department: 'CSE',
                year: '4th',
                course_code: 'CSE101',
                password: 'temp',
                isVerified: false
            });
            console.log('Created:', newStudent);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
