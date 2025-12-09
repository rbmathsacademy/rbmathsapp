const mongoose = require('mongoose');
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
    role: { type: String },
    name: { type: String },
}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        console.log('Database Name:', mongoose.connection.name);

        const user = await User.findOne({ email: 'ritwick92@gmail.com' });

        if (!user) {
            console.log('❌ User NOT FOUND with email: ritwick92@gmail.com');
        } else {
            console.log('✅ User FOUND:');
            console.log(`   Name: ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Password Hash: ${user.password}`);

            if (user.role !== 'admin') {
                console.log('⚠️ WARNING: Role is NOT "admin". User will not be able to access the dashboard.');
            }

            if (!user.password.startsWith('$2')) {
                console.log('⚠️ WARNING: Password does not look like a bcrypt hash.');
            }
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

verify();
