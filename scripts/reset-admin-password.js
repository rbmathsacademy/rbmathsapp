require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define inline schema
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('ERROR: MONGODB_URI is missing.');
    process.exit(1);
}

async function resetAdminPassword(email, newPassword) {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to DB:', mongoose.connection.name);

        // Find user
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`❌ User with email "${email}" not found.`);
            console.log('\nAvailable users:');
            const allUsers = await User.find({}, { name: 1, email: 1, role: 1 });
            console.table(allUsers.map(u => ({
                Name: u.name,
                Email: u.email,
                Role: u.role
            })));
            await mongoose.connection.close();
            process.exit(1);
        }

        console.log(`\nFound user: ${user.name} (${user.email}) - Role: ${user.role}`);
        console.log(`Resetting password to: "${newPassword}"`);

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await User.updateOne({ _id: user._id }, { password: hashedPassword });

        // Verify the update
        const updatedUser = await User.findOne({ email });
        const isMatch = await bcrypt.compare(newPassword, updatedUser.password);

        if (isMatch) {
            console.log('✅ Password reset successful!');
            console.log(`\nYou can now login with:`);
            console.log(`Email: ${email}`);
            console.log(`Password: ${newPassword}`);
        } else {
            console.log('❌ Password reset failed - verification check did not pass');
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Get arguments
const email = process.argv[2];
const password = process.argv[3] || 'admin123';

if (!email) {
    console.log('Usage: node scripts/reset-admin-password.js <email> [password]');
    console.log('Example: node scripts/reset-admin-password.js ritwick92@gmail.com myNewPassword');
    console.log('\nIf password is not provided, it will default to: admin123');
    process.exit(1);
}

resetAdminPassword(email, password);
