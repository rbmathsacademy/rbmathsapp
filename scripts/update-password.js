require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function updatePassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const user = await User.findOne({ email: 'ritwick92@gmail.com' });

        if (!user) {
            console.log('❌ User not found');
            process.exit(1);
        }

        console.log('Current user:', user.email);
        console.log('Updating password to: ritwick@12\n');

        // Hash the new password
        const hashedPassword = await bcrypt.hash('ritwick@12', 10);

        // Update the user's password
        user.password = hashedPassword;
        await user.save();

        console.log('✅ Password updated successfully!');
        console.log('\nYou can now sign in with:');
        console.log('Email: ritwick92@gmail.com');
        console.log('Password: ritwick@12');

        // Verify the password works
        const isMatch = await bcrypt.compare('ritwick@12', user.password);
        console.log('\nPassword verification:', isMatch ? '✅ SUCCESS' : '❌ FAILED');

        await mongoose.connection.close();
        console.log('\n✓ Connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updatePassword();
