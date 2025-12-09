
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nextjs-portal';
console.log('URI:', MONGODB_URI);

async function debugData() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        const User = mongoose.connection.collection('users');
        const Attendance = mongoose.connection.collection('attendances');

        const users = await User.find({}).limit(5).toArray();
        console.log('--- All Users (First 5) ---');
        users.forEach(u => console.log(`- ${u.name} (${u.email})`));

        const email = 'admin@admin.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`\nUser not found for email: ${email}`);
            // Let's try to assume the first user is the one we want to test if admin not found
            if (users.length > 0) {
                console.log(`Using first user found: ${users[0].name} for further testing...`);
            } else {
                return;
            }
        } else {
            console.log(`Found User: ${user.name} (${user.email})`);
        }

        const testUser = user || users[0];
        if (!testUser) return;

        console.log(`\nTesting Attendance for: ${testUser.name}`);

        // Check exact match
        const countExact = await Attendance.countDocuments({ teacherName: testUser.name });
        console.log(`Attendance records (Exact Match '${testUser.name}'): ${countExact}`);

        // Check regex match
        const countRegex = await Attendance.countDocuments({ teacherName: { $regex: new RegExp(testUser.name, 'i') } });
        console.log(`Attendance records (Regex Match '${testUser.name}'): ${countRegex}`);

        if (countRegex > 0) {
            const sample = await Attendance.findOne({ teacherName: { $regex: new RegExp(testUser.name, 'i') } });
            console.log('Sample Record:', JSON.stringify(sample, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugData();
