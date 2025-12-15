require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

async function createAdminInCurrentDB() {
    try {
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);

        const dbName = mongoose.connection.db.databaseName;
        console.log('✅ Connected to database:', dbName);

        const email = 'ritwick92@gmail.com';
        const password = 'admin123';
        const name = 'Dr. Ritwick Banerjee';

        // Check if user exists
        const existing = await User.findOne({ email });
        if (existing) {
            console.log('User already exists. Updating password...');
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.updateOne({ _id: existing._id }, { password: hashedPassword, role: 'admin' });
            console.log('✅ Password updated!');
        } else {
            console.log('Creating new admin user...');
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({
                name,
                email,
                password: hashedPassword,
                role: 'admin'
            });
            console.log('✅ Admin user created!');
        }

        // Verify
        const user = await User.findOne({ email });
        const isMatch = await bcrypt.compare(password, user.password);

        console.log('\n✅ LOGIN CREDENTIALS FOR LOCALHOST:');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('Database:', dbName);
        console.log('Verification:', isMatch ? 'PASSED ✅' : 'FAILED ❌');

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

createAdminInCurrentDB();
