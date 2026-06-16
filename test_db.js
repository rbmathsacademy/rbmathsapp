const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/rbmathsacademy').then(async () => {
    try {
        const db = mongoose.connection.db;

        const now = new Date();
        const cleanPhone = '9999999999';
        const courses = ['Class XII'];

        const query = {
            type: 'popup',
            $and: [
                { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] },
                { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] }
            ],
            $or: [
                { targetBatches: { $in: courses } },
                { 'targetStudents.phoneNumber': { $in: [cleanPhone] } }
            ]
        };

        // Let's insert and find
        await db.collection('notifications').insertOne({
            title: 'Test Targeted',
            message: 'Hello',
            type: 'popup',
            targetBatches: [],
            targetStudents: [{ phoneNumber: cleanPhone, studentName: 'Test' }],
            startDate: new Date(Date.now() - 10000),
            endDate: new Date(Date.now() + 10000)
        });

        const result = await db.collection('notifications').find(query).toArray();
        console.log("Matched docs:", result.map(r => r.title));

        await db.collection('notifications').deleteOne({ title: 'Test Targeted' });

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
});
