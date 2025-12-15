require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function checkUser() {
    try {
        console.log('Connecting to MongoDB...');
        console.log('MONGODB_URI:', process.env.MONGODB_URI);

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        // Get the User model
        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

        // Find user with email ritwick92@gmail.com
        const user = await User.findOne({ email: 'ritwick92@gmail.com' });

        if (user) {
            console.log('Found user with email ritwick92@gmail.com:');
            console.log('User ID:', user._id);
            console.log('Email:', user.email);
            console.log('Role:', user.role);
            console.log('Has password:', !!user.password);
            console.log('Password hash (first 20 chars):', user.password ? user.password.substring(0, 20) + '...' : 'N/A');
            console.log('\nFull user object:');
            console.log(JSON.stringify(user, null, 2));
        } else {
            console.log('❌ No user found with email ritwick92@gmail.com');

            // List all users
            const allUsers = await User.find({});
            console.log(`\nTotal users in database: ${allUsers.length}`);
            if (allUsers.length > 0) {
                console.log('\nAll users:');
                allUsers.forEach(u => {
                    console.log(`- ${u.email} (${u.role})`);
                });
            }
        }

        // Check how many students exist
        const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
        const studentCount = await Student.countDocuments();
        console.log(`\n📚 Total students in database: ${studentCount}`);

        // Check how many assignments exist
        const Assignment = mongoose.model('Assignment', new mongoose.Schema({}, { strict: false }));
        const assignmentCount = await Assignment.countDocuments();
        console.log(`📝 Total assignments in database: ${assignmentCount}`);

        await mongoose.connection.close();
        console.log('\n✓ Connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUser();
