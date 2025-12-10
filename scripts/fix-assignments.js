
const admin = require('firebase-admin');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// --- Schemas (Minimal for script) ---
const StudentSchema = new mongoose.Schema({ roll: String }, { strict: false });
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

const AssignmentSchema = new mongoose.Schema({
    title: String,
    legacy_firebase_id: String,
    facultyName: String,
    startTime: Date,
    deadline: Date,
    questions: [],
    questionPool: []
}, { strict: false });
const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);

const StudentAssignmentSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    assignmentId: mongoose.Schema.Types.ObjectId,
    submissionUrl: String,
    status: String
}, { strict: false });
const StudentAssignment = mongoose.models.StudentAssignment || mongoose.model('StudentAssignment', StudentAssignmentSchema);

const QuestionSchema = new mongoose.Schema({ id: String }, { strict: false });
const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);

async function fix() {
    console.log('🚀 Starting Assignment Fix...');
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) process.exit(1);

    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');

    // 1. Cleanup Legacy Assignments & Submissions
    console.log('🧹 Cleaning up old migrated data...');
    // Find assignments with legacy_firebase_id
    const legAss = await Assignment.find({ legacy_firebase_id: { $exists: true } });
    const legIds = legAss.map(a => a._id);
    console.log(`Found ${legIds.length} legacy assignments.`);

    // Delete Submissions linked to these
    const subDel = await StudentAssignment.deleteMany({ assignmentId: { $in: legIds } });
    console.log(`Deleted ${subDel.deletedCount} legacy submissions.`);

    // Delete Assignments
    const assDel = await Assignment.deleteMany({ legacy_firebase_id: { $exists: true } });
    console.log(`Deleted ${assDel.deletedCount} legacy assignments.`);


    // 2. Build Maps
    const studentMap = {}; // Roll -> _id
    const fbIdMap = {};   // FbUID -> _id

    // We need to re-fetch students/map IDs because we didn't run student sync this time
    // But we assume students are already synced by V4.
    // We'll iterate the Student collection in Mongo.
    (await Student.find({})).forEach(s => {
        if (s.roll) studentMap[s.roll.toString()] = s._id;
        // We don't have FbUID in Mongo efficiently unless we saved it. 
        // V4 saved 'fbIdMap' in memory but not to DB (except maybe implicitly?).
        // Wait, V4 did NOT save FbUID to Student doc!
        // So I need to fetch Firebase Students AGAIN to build the map.
    });

    console.log('🔄 Building ID Map...');
    const sSnap = await db.collection('students').get();
    for (const doc of sSnap.docs) {
        const d = doc.data();
        const roll = d.roll ? d.roll.toString().trim() : null;
        if (roll && studentMap[roll]) {
            fbIdMap[doc.id] = studentMap[roll];
        }
    }

    // 3. Import Assignments Correctly
    console.log('🔄 Importing Assignments...');
    const assignSnap = await db.collection('assignments').get();
    const assMap = {}; // FbID -> MongoID

    for (const doc of assignSnap.docs) {
        const d = doc.data();

        // Dates
        // Try 'startTime' then 'createdAt'
        let start = d.startTime ? new Date(d.startTime._seconds * 1000) : (d.createdAt ? new Date(d.createdAt._seconds * 1000) : new Date());
        // Try 'deadline' then 'dueDate'
        let due = d.deadline ? new Date(d.deadline._seconds * 1000) : (d.dueDate ? new Date(d.dueDate._seconds * 1000) : new Date());

        // Questions
        let qIds = [];
        const srcQ = d.questions || d.questionPool || [];
        if (Array.isArray(srcQ)) {
            for (const q of srcQ) {
                const qId = (typeof q === 'object') ? q.id : q;
                // Ensure Question exists or create placeholder
                let qDoc = await Question.findOne({ id: qId });
                if (!qDoc) {
                    qDoc = await Question.create({
                        id: qId || new mongoose.Types.ObjectId().toString(),
                        text: (typeof q === 'object' ? q.text : 'Legacy Question'),
                        type: 'broad', topic: 'Legacy', subtopic: 'Legacy', uploadedBy: 'Imported', facultyName: 'Imported', marks: 1
                    });
                }
                qIds.push(qDoc._id);
            }
        }

        const newAss = await Assignment.create({
            title: d.title,
            description: d.description || '',
            type: d.type || 'manual',
            course_code: d.targetCourse || d.course || 'Legacy', // Map course
            targetDepartments: d.targetDepartments || (d.department ? [d.department] : []),
            targetYear: d.targetYear || d.year,
            facultyName: d.facultyName || 'RB', // Default to RB if missing? User said "RB had given assignment"
            startTime: start,
            deadline: due,
            questions: qIds,
            legacy_firebase_id: doc.id
        });
        assMap[doc.id] = newAss._id;
        console.log(`   Imported: ${d.title} (Start: ${start.toISOString()}, Due: ${due.toISOString()})`);
    }

    // 4. Import Submissions
    console.log('🔄 Importing Submissions & Links...');
    const subSnap = await db.collection('submissions').get();
    let subCount = 0;

    for (const doc of subSnap.docs) {
        const d = doc.data();

        let mSId = null;
        // Try Roll
        if (d.studentRoll) {
            mSId = studentMap[d.studentRoll.toString().trim()];
        }
        // Try UID
        if (!mSId && d.studentId) {
            mSId = fbIdMap[d.studentId];
        }

        const mAId = assMap[d.assignmentId];

        if (mSId && mAId) {
            // Check dup
            const exists = await StudentAssignment.findOne({ studentId: mSId, assignmentId: mAId });
            if (!exists) {
                await StudentAssignment.create({
                    studentId: mSId,
                    studentRoll: d.studentRoll || 'Unknown',
                    assignmentId: mAId,
                    status: 'submitted',
                    submissionUrl: d.driveLink || '',
                    submittedAt: d.submittedAt ? new Date(d.submittedAt._seconds * 1000) : new Date()
                });
                subCount++;
            }
        }
    }
    console.log(`✅ Imported ${subCount} submissions with Drive Links.`);
    process.exit(0);
}

fix().catch(console.error);
