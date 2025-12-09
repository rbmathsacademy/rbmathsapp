
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hit-assignment-generator';

async function checkIndexes() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.collection('students');
        const indexes = await collection.indexes();

        console.log('Indexes on "students" collection:');
        console.log(JSON.stringify(indexes, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkIndexes();
