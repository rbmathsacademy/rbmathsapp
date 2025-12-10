
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function inspect() {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) process.exit(1);

    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    const snapshot = await db.collection('attendanceRecords').limit(1).get();
    if (!snapshot.empty) {
        const d = snapshot.docs[0].data();
        console.log('Sample Attendance Record:');
        console.log('ID:', snapshot.docs[0].id);
        console.log('Present (first 5):', JSON.stringify(d.presentStudentIds ? d.presentStudentIds.slice(0, 5) : []));
        console.log('Absent (first 5):', JSON.stringify(d.absentStudentIds ? d.absentStudentIds.slice(0, 5) : []));
    } else {
        console.log('Empty collection');
    }
    process.exit(0);
}
inspect();
