require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function checkDatabase() {
    try {
        console.log('MONGODB_URI from .env.local:', process.env.MONGODB_URI);
        console.log('\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        const connection = mongoose.connection;
        console.log('Database Name:', connection.db.databaseName);
        console.log('\n');

        // List all collections
        const collections = await connection.db.listCollections().toArray();
        console.log('Collections in this database:');
        console.log('='.repeat(80));

        for (const collection of collections) {
            const count = await connection.db.collection(collection.name).countDocuments();
            console.log(`  ${collection.name}: ${count} documents`);
        }

        console.log('\n');
        console.log('='.repeat(80));
        console.log('DATABASE SUMMARY:');
        console.log('='.repeat(80));

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
        const Assignment = mongoose.model('Assignment', new mongoose.Schema({}, { strict: false }));

        const userCount = await User.countDocuments();
        const studentCount = await Student.countDocuments();
        const assignmentCount = await Assignment.countDocuments();

        console.log(`Users: ${userCount}`);
        console.log(`Students: ${studentCount}`);
        console.log(`Assignments: ${assignmentCount}`);

        if (studentCount === 2) {
            console.log('\n⚠️ WARNING: Only 2 students found!');
            console.log('This appears to be a TEST/DEVELOPMENT database, not the PRODUCTION database.');
            console.log('You need to update your .env.local MONGODB_URI to point to the correct database.');
        }

        await mongoose.connection.close();
        console.log('\n✓ Connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDatabase();
