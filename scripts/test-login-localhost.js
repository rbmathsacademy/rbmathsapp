require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

async function testLogin(email, password) {
    try {
        const uri = process.env.MONGODB_URI;
        console.log('Testing login for:', email);
        console.log('Using database from URI:', uri.split('/').pop().split('?')[0] || 'default (test)');

        await mongoose.connect(uri);
        console.log('✅ Connected to:', mongoose.connection.db.databaseName);

        // Find user
        const user = await User.findOne({ email });

        if (!user) {
            console.log('❌ User NOT found with email:', email);

            // Show all users
            const allUsers = await User.find({}, { name: 1, email: 1, role: 1 });
            console.log('\nAll users in database:');
            allUsers.forEach(u => console.log(`  - ${u.email} (${u.role})`));

            await mongoose.connection.close();
            return;
        }

        console.log('✅ User found:', user.email);
        console.log('   Name:', user.name);
        console.log('   Role:', user.role);
        console.log('   Has password hash:', !!user.password);

        // Test password
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('\nPassword test with "' + password + '":', isMatch ? '✅ MATCH' : '❌ NO MATCH');

        if (!isMatch) {
            console.log('\nTry these passwords:');
            const testPasswords = ['admin123', 'password123', 'Admin@123', 'secure123portalhitgo'];
            for (const testPwd of testPasswords) {
                const match = await bcrypt.compare(testPwd, user.password);
                if (match) {
                    console.log('✅ FOUND IT:', testPwd);
                    break;
                }
            }
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

const email = process.argv[2] || 'ritwick92@gmail.com';
const password = process.argv[3] || 'admin123';

testLogin(email, password);
