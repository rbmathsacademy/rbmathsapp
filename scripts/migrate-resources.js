
const admin = require('firebase-admin');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function migrateResources() {
    console.log('🚀 Migrating Resources from Firebase...');
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) process.exit(1);

    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    await mongoose.connect(process.env.MONGODB_URI);

    const ResourceSchema = new mongoose.Schema({
        title: String,
        type: String,
        videoLink: String,
        url: String,
        topic: String,
        subtopic: String,
        targetDepartments: [String],
        targetYear: String,
        targetCourse: String,
        uploadedBy: String,
        facultyName: String,
        createdAt: Date
    }, { strict: false });
    const Resource = mongoose.models.Resource || mongoose.model('Resource', ResourceSchema);

    const snapshot = await db.collection('resources').get();
    console.log(`Found ${snapshot.size} resources in Firebase.`);

    let count = 0;
    for (const doc of snapshot.docs) {
        const d = doc.data();

        // Map Type
        let type = 'link';
        if (d.type === 'video_resource') type = 'video';
        else if (d.type === 'pdf') type = 'pdf';

        // Map URL
        const videoLink = d.youtubeLink || '';
        const url = d.link || d.url || '';

        // Check if exists
        const exists = await Resource.findOne({ title: d.title, type: type, uploadedBy: 'ritwick92@gmail.com' });

        if (!exists) {
            await Resource.create({
                title: d.title,
                type: type,
                videoLink: videoLink,
                url: url,
                topic: d.topic || 'General',
                subtopic: d.subtopic || 'General',
                targetDepartments: d.targetDepartments || [],
                targetYear: d.targetYear || '',
                targetCourse: d.targetCourse || '',
                uploadedBy: 'ritwick92@gmail.com',
                facultyName: 'RB',
                createdAt: d.createdAt ? new Date(d.createdAt._seconds * 1000) : new Date()
            });
            count++;
        }
    }

    console.log(`✅ Migrated ${count} new resources.`);
    process.exit(0);
}

migrateResources().catch(console.error);
