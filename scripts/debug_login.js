
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

const StudentSchema = new mongoose.Schema({}, { strict: false });
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

async function debugLogin(roll, password) {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log(`Connected to DB. Checking user with roll: ${roll}`);

        const student = await Student.findOne({ roll });
        if (!student) {
            console.log('Student not found.');
            return;
        }

        console.log(`Student Found: ID=${student._id}, Name=${student.name}, Verified=${student.isVerified}`);
        console.log(`Stored Password Hash: ${student.password}`);

        if (!student.isVerified) {
            console.log('⚠️ Student is NOT verified. Login will fail regardless of password.');
        }

        const isMatch = await bcrypt.compare(password, student.password);
        console.log(`Password '${password}' match result: ${isMatch}`);

        if (!isMatch) {
            console.log('Trying to hash the input password and see... (just for context)');
            const newHash = await bcrypt.hash(password, 10);
            console.log(`New Hash of '${password}': ${newHash}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

// Ensure the command line args are passed
const roll = process.argv[2];
const password = process.argv[3];

if (!roll || !password) {
    console.log('Usage: node debug_login.js <roll> <password>');
    process.exit(1);
}

debugLogin(roll, password);
