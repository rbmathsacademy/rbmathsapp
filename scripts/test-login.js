const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
let MONGODB_URI = '';

try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const match = envFile.match(/MONGODB_URI=(.*)/);
    if (match && match[1]) {
        MONGODB_URI = match[1].trim().replace(/["']/g, '');
    }
} catch (e) {
    console.error('Could not read .env.local');
    process.exit(1);
}

const UserSchema = new mongoose.Schema({
    email: { type: String },
    password: { type: String },
}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function testLogin() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const email = 'ritwick92@gmail.com';
        const password = 'password123';

        const user = await User.findOne({ email });

        if (!user) {
            console.log('❌ User not found');
            process.exit(1);
        }

        console.log(`Found user: ${user.email}`);
        console.log(`Stored Hash: ${user.password}`);

        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            console.log('✅ Password MATCHES! Login should work.');
        } else {
            console.log('❌ Password DOES NOT MATCH.');
            console.log('The hash in the database does not correspond to "password123".');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testLogin();
