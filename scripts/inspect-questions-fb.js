
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function inspectQuestions() {
    // Connect to Firebase
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
        console.error('No serviceAccountKey.json found');
        process.exit(1);
    }
    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    const db = admin.firestore();

    const snapshot = await db.collection('questions').limit(5).get();
    if (snapshot.empty) {
        console.log('No questions found in "questions" collection.');
    } else {
        snapshot.docs.forEach(doc => {
            console.log(`\n📄 Question ID: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }

    // Check if there's a 'questionPool' collection too?
    const poolSnap = await db.collection('questionPool').limit(1).get();
    if (!poolSnap.empty) {
        console.log('\n🏊 Found "questionPool" collection too. Sample:');
        console.log(JSON.stringify(poolSnap.docs[0].data(), null, 2));
    }

    process.exit(0);
}

inspectQuestions();
