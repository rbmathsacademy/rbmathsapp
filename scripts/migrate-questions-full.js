
const admin = require('firebase-admin');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function migrateQuestions() {
    console.log('🚀 Migrating Questions from Firebase...');
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) process.exit(1);

    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    await mongoose.connect(process.env.MONGODB_URI);

    // Define Schema with strict: false to capture extra fields if needed (like options)
    const QuestionSchema = new mongoose.Schema({
        id: { type: String, unique: true },
        text: String,
        type: String,
        topic: String,
        subtopic: String,
        uploadedBy: String,
        facultyName: String,
        createdAt: Date,
        latex: String,
        options: [] // Capture options if present
    }, { strict: false });
    const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);

    const snapshot = await db.collection('questions').get();
    console.log(`Found ${snapshot.size} questions in Firebase.`);

    let count = 0;
    for (const doc of snapshot.docs) {
        const d = doc.data();

        // Determine Type
        let type = 'broad';
        const lowerId = d.id ? d.id.toLowerCase() : '';
        if (lowerId.startsWith('mcq')) type = 'mcq';
        else if (lowerId.startsWith('blank') || lowerId.includes('blank')) type = 'blanks';
        else if (lowerId.startsWith('long') || lowerId.startsWith('broad')) type = 'broad';

        // Map Data
        const qData = {
            id: d.id || doc.id,
            text: d.content || d.latex || 'No Content',
            latex: d.latex || '',
            type: type,
            topic: d.topic || 'General',
            subtopic: d.subtopic || 'General',
            uploadedBy: 'Ritwik Banerjee',
            facultyName: 'RB', // Forced as per request
            createdAt: d.createdAt ? new Date(d.createdAt._seconds * 1000) : new Date(),
            // Map options if they exist (common in MCQs)
            options: d.options || []
        };

        await Question.updateOne(
            { id: qData.id },
            { $set: qData },
            { upsert: true }
        );
        count++;
        if (count % 20 === 0) process.stdout.write('.');
    }

    console.log(`\n✅ Successfully migrated/updated ${count} questions.`);
    process.exit(0);
}

migrateQuestions().catch(console.error);
