require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function testLogin() {
    try {
        console.log('Testing login with production database...\n');
        console.log('MONGODB_URI:', process.env.MONGODB_URI);
        console.log();

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');
        console.log('Database:', mongoose.connection.db.databaseName);
        console.log();

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));

        // Test login
        const user = await User.findOne({ email: 'ritwick92@gmail.com' });

        if (!user) {
            console.log('❌ User not found!');
            process.exit(1);
        }

        console.log('✅ User found:');
        console.log('   ID:', user._id);
        console.log('   Name:', user.name);
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log();

        // Test password
        const isMatch = await bcrypt.compare('ritwick@12', user.password);
        console.log('Password test (ritwick@12):', isMatch ? '✅ CORRECT' : '❌ WRONG');
        console.log();

        // Check students
        const studentCount = await Student.countDocuments();
        console.log('📚 Total students in database:', studentCount);
        console.log();

        if (isMatch && studentCount > 74) {
            console.log('='.repeat(80));
            console.log('🎉 SUCCESS! Everything is configured correctly!');
            console.log('='.repeat(80));
            console.log('\nYou can now sign in at http://localhost:3000 with:');
            console.log('  Email: ritwick92@gmail.com');
            console.log('  Password: ritwick@12');
            console.log('\nYour database has', studentCount, 'students ready to go!');
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testLogin();
