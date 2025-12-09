
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/hit-assignment-generator';

async function verifyDuplicates() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const Student = mongoose.connection.collection('students');

        // Aggregate to find duplicates by Roll
        const cursor = Student.aggregate([
            {
                $group: {
                    _id: "$roll",
                    count: { $sum: 1 },
                    courses: { $push: "$course_code" },
                    ids: { $push: "$_id" }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        const results = await cursor.toArray();
        console.log(`Found ${results.length} students with multiple records:`);
        results.forEach(r => {
            console.log(`Roll: ${r._id}, Count: ${r.count}, Courses: ${r.courses.join(', ')}`);
        });

        if (results.length === 0) {
            console.log("No duplicate student records found. The CSV upload might not be creating new docs as expected.");
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyDuplicates();
