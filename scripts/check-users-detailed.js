require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

// Define inline schema
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

async function checkUsers() {
    try {
        const uri = process.env.MONGODB_URI;
        console.log('Connecting to:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Hide password

        await mongoose.connect(uri);
        console.log('✅ Connected to DB:', mongoose.connection.name);
        console.log('Database:', mongoose.connection.db.databaseName);

        // List all users
        const users = await User.find({});

        console.log('\n--- ALL USERS IN DATABASE ---');
        if (users.length === 0) {
            console.log('❌ NO USERS FOUND');
        } else {
            console.log(`Found ${users.length} users:`);
            users.forEach(u => {
                console.log(`\n- Name: ${u.name}`);
                console.log(`  Email: ${u.email}`);
                console.log(`  Role: ${u.role}`);
                console.log(`  Password Hash: ${u.password ? u.password.substring(0, 30) + '...' : 'MISSING'}`);
            });
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkUsers();
