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

if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in .env.local');
    process.exit(1);
}

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    name: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function createAdmin() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log('Usage: node scripts/create-admin.js <name> <email> <password>');
        process.exit(1);
    }

    const [name, email, password] = args;

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const existing = await User.findOne({ email });
        if (existing) {
            console.log('User already exists');
            process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'admin'
        });

        console.log(`Admin user created: ${user.email}`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

createAdmin();
