
const { MongoClient } = require('mongodb');

// Try a direct connection string commonly used in local setups, bypassing Mongoose
const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        console.log("Connected successfully to server");
        const db = client.db("hit-assignment-generator");
        const collection = db.collection("students");

        // Count duplicates
        const duplicates = await collection.aggregate([
            {
                $group: {
                    _id: "$roll",
                    count: { $sum: 1 },
                    documents: { $push: "$$ROOT" }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]).toArray();

        console.log(`Found ${duplicates.length} students with >1 document.`);
        duplicates.forEach(d => {
            console.log(`Roll: ${d._id} has ${d.count} docs. Courses: ${d.documents.map(x => x.course_code).join(', ')}`);
        });

        // Also just list first 5 students to verify ANY data
        const first5 = await collection.find({}).limit(5).toArray();
        console.log("First 5 students found:", first5.map(s => `${s.roll} (${s.course_code})`).join(', '));

    } finally {
        await client.close();
    }
}
run().catch(console.dir);
