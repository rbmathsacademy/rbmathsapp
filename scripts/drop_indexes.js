
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/hit-assignment-generator';

async function dropIndexes() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.collection('students');

        try {
            await collection.dropIndex('roll_1');
            console.log('Dropped roll_1 index');
        } catch (e) {
            console.log('roll_1 index not found or error:', e.message);
        }

        try {
            await collection.dropIndex('email_1');
            console.log('Dropped email_1 index');
        } catch (e) {
            console.log('email_1 index not found or error:', e.message);
        }

        // Also drop secondary_email_1 just in case
        try {
            await collection.dropIndex('secondary_email_1');
            console.log('Dropped secondary_email_1 index');
        } catch (e) {
            console.log('secondary_email_1 index not found or error:', e.message);
        }

        console.log('Indexes dropped. Verify restart.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

dropIndexes();
