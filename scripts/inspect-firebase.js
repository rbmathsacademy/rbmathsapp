
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function inspect() {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
        console.error('❌ serviceAccountKey.json NOT FOUND. Please place it in the root directory.');
        process.exit(1);
    }

    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

    const db = admin.firestore();
    console.log('✅ Connected to Firebase. Analyzing collections...');

    const collections = await db.listCollections();
    for (const col of collections) {
        console.log(`\n📦 Collection: ${col.id}`);
        const snapshot = await col.limit(1).get();
        if (snapshot.empty) {
            console.log('   (Empty)');
        } else {
            const data = snapshot.docs[0].data();
            console.log('   Sample Doc Keys:', Object.keys(data));
            console.log('   Sample Data:', JSON.stringify(data, null, 2));

            // Check for subcollections
            const subCols = await snapshot.docs[0].ref.listCollections();
            if (subCols.length > 0) {
                console.log(`   📂 Sub-collections: ${subCols.map(s => s.id).join(', ')}`);
            }
        }
    }
}

inspect().catch(console.error);
