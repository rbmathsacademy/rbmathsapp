
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function inspect() {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
        console.error('No service key');
        process.exit(1);
    }
    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    const db = admin.firestore();

    const snapshot = await db.collection('attendance').limit(1).get();
    if (snapshot.empty) {
        console.log('Attendance collection is empty.');
    } else {
        console.log('Attendance Doc Data:', JSON.stringify(snapshot.docs[0].data(), null, 2));
    }
    process.exit(0);
}
inspect();
