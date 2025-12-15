require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function testPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const user = await User.findOne({ email: 'ritwick92@gmail.com' });

        if (!user) {
            console.log('❌ User not found');
            process.exit(1);
        }

        console.log('Testing common passwords...\n');

        const passwordsToTest = [
            'admin123',
            'Admin123',
            'password',
            'Password123',
            '123456',
            'ritwick123',
            'Ritwick@123',
            'RB@123',
            'rb123'
        ];

        let found = false;
        for (const pwd of passwordsToTest) {
            const isMatch = await bcrypt.compare(pwd, user.password);
            if (isMatch) {
                console.log(`✅ PASSWORD FOUND: "${pwd}"`);
                console.log(`\nYou can sign in with:`);
                console.log(`Email: ritwick92@gmail.com`);
                console.log(`Password: ${pwd}`);
                found = true;
                break;
            }
        }

        if (!found) {
            console.log('❌ None of the common passwords matched.');
            console.log('\nThe password hash is:', user.password);
            console.log('\nWould you like me to reset the password to a known value?');
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testPassword();
