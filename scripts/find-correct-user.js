require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function findCorrectUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));

        // Find ALL users with this email
        const users = await User.find({ email: 'ritwick92@gmail.com' });

        console.log(`Found ${users.length} user(s) with email ritwick92@gmail.com\n`);
        console.log('='.repeat(80));

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            console.log(`\nUSER #${i + 1}:`);
            console.log(`  ID: ${user._id}`);
            console.log(`  Email: ${user.email}`);
            console.log(`  Name: ${user.name}`);
            console.log(`  Role: ${user.role}`);

            // Check how many students are associated with this user
            // Students might be linked by faculty email or faculty name
            const studentsByEmail = await Student.countDocuments({
                $or: [
                    { faculty: user.email },
                    { 'facultyDetails.email': user.email }
                ]
            });

            const studentsByName = await Student.countDocuments({
                $or: [
                    { faculty: user.name },
                    { 'facultyDetails.name': user.name }
                ]
            });

            // Get total students
            const totalStudents = await Student.countDocuments();

            console.log(`  Students linked by email: ${studentsByEmail}`);
            console.log(`  Students linked by name: ${studentsByName}`);
            console.log(`  Total students in DB: ${totalStudents}`);

            // Test password
            const bcrypt = require('bcryptjs');
            const testPasswords = ['ritwick@12', 'admin123'];
            for (const pwd of testPasswords) {
                const match = await bcrypt.compare(pwd, user.password);
                if (match) {
                    console.log(`  ✅ Password matches: ${pwd}`);
                }
            }
            console.log('  Created at:', user.createdAt || 'N/A');
            console.log('-'.repeat(80));
        }

        // Check all students to see their faculty associations
        console.log('\n\nALL STUDENTS IN DATABASE:');
        console.log('='.repeat(80));
        const allStudents = await Student.find({}).limit(10);
        console.log(`Showing first 10 of ${await Student.countDocuments()} students:\n`);

        allStudents.forEach((s, idx) => {
            console.log(`${idx + 1}. ${s.name} (Roll: ${s.rollNumber})`);
            console.log(`   Faculty: ${s.faculty || 'N/A'}`);
            console.log(`   Faculty Details:`, s.facultyDetails || 'N/A');
        });

        await mongoose.connection.close();
        console.log('\n✓ Connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

findCorrectUser();
