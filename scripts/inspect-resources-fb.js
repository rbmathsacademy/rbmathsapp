
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function inspectResources() {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) process.exit(1);

    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    const snapshot = await db.collection('resources').limit(5).get();
    if (snapshot.empty) {
        console.log('No resources found.');
    } else {
        snapshot.docs.forEach(doc => {
            console.log(`\n📄 Resource ID: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }
    process.exit(0);
}

inspectResources();
