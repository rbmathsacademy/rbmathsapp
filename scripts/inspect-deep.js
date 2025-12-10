
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function inspectDeep() {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) { console.error('No key'); process.exit(1); }
    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    console.log('🔍 Deep Inspection Started...');
    const collections = await db.listCollections();

    for (const col of collections) {
        console.log(`\n📂 ROOT COLLECTION: ${col.id}`);
        const snapshot = await col.limit(1).get();
        if (snapshot.empty) {
            console.log('   (Empty)');
        } else {
            const doc = snapshot.docs[0];
            console.log(`   Sample Doc ID: ${doc.id}`);
            console.log(`   Sample Data Keys: ${Object.keys(doc.data()).join(', ')}`);

            // Check Sub-collections
            const subCols = await doc.ref.listCollections();
            if (subCols.length > 0) {
                console.log(`   found ${subCols.length} SUB-COLLECTIONS:`);
                for (const sub of subCols) {
                    console.log(`      👉 ${sub.id}`);
                    const subSnap = await sub.limit(1).get();
                    if (!subSnap.empty) {
                        console.log(`         Sample Sub-Doc Data: ${JSON.stringify(subSnap.docs[0].data(), null, 2)}`);
                    }
                }
            }
        }
    }
    process.exit(0);
}
inspectDeep();
