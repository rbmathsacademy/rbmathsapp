
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

const StudentSchema = new mongoose.Schema({}, { strict: false });
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

async function testResetAndLogin(roll, newPassword) {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log(`Connected to DB.`);

        const student = await Student.findOne({ roll });
        if (!student) {
            console.log('Student not found for test.');
            return;
        }

        console.log(`Resetting password for ${student.name} (${roll}) to '${newPassword}'...`);

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        console.log(`Generated Hash: ${hashedPassword}`);

        // Update DB
        const updateRes = await Student.updateOne({ _id: student._id }, { password: hashedPassword });
        console.log('Update Result:', updateRes);

        // Fetch again to verify
        const updatedStudent = await Student.findOne({ roll });
        console.log(`Stored Hash after update: ${updatedStudent.password}`);

        // Verify
        const isMatch = await bcrypt.compare(newPassword, updatedStudent.password);
        console.log(`Login Verification with '${newPassword}': ${isMatch ? 'SUCCESS ✅' : 'FAILED ❌'}`);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

const roll = process.argv[2] || '123';
const pass = process.argv[3] || 'newpass123';

testResetAndLogin(roll, pass);
