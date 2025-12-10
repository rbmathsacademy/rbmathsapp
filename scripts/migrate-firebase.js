
const admin = require('firebase-admin');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// --- Schemas ---
const StudentSchema = new mongoose.Schema({ roll: String, name: String, email: String, department: String, year: String, course_code: String, attended_adjustment: Number, total_classes_adjustment: Number, isVerified: Boolean, password: String }, { strict: false });
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

const AttendanceSchema = new mongoose.Schema({ date: String, teacherName: String, department: String, year: String, course_code: String, timeSlot: String, presentStudentIds: [mongoose.Schema.Types.ObjectId], absentStudentIds: [mongoose.Schema.Types.ObjectId] }, { strict: false });
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

const QuestionSchema = new mongoose.Schema({ id: String, text: String, type: String, topic: String, subtopic: String, uploadedBy: String, facultyName: String, marks: Number }, { strict: false });
const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);

const AssignmentSchema = new mongoose.Schema({ title: String, description: String, course_code: String, startTime: Date, deadline: Date, questions: [mongoose.Schema.Types.ObjectId], targetYear: String, targetDepartments: [String], type: String, legacy_firebase_id: String }, { strict: false });
const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);

const StudentAssignmentSchema = new mongoose.Schema({ studentId: mongoose.Schema.Types.ObjectId, studentRoll: String, assignmentId: mongoose.Schema.Types.ObjectId, status: String, submissionUrl: String, marksObtained: Number, submittedAt: Date }, { strict: false });
const StudentAssignment = mongoose.models.StudentAssignment || mongoose.model('StudentAssignment', StudentAssignmentSchema);

// --- Migration ---
async function migrate() {
    console.log('🚀 Starting Migration V4 (ID Linkage Fix)...');
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) process.exit(1);

    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');

    // 1. Students & ID Mapping
    console.log('🔄 Syncing Students...');
    const sSnap = await db.collection('students').get();
    let sNew = 0, sUp = 0;
    const fbIdMap = {}; // FirebaseDocID -> MongoID

    for (const doc of sSnap.docs) {
        const d = doc.data();
        const roll = d.roll ? d.roll.toString().trim() : null;
        if (!roll) continue;

        let ex = await Student.findOne({ roll });
        const att = d.stats?.attended || d.attended_adjustment || 0;
        const tot = d.stats?.total_classes || d.total_classes_adjustment || 0;

        if (!ex) {
            ex = await Student.create({
                roll, name: d.name || 'Imported', email: d.email || `${roll}@hit.edu.in`,
                department: d.department || 'Gen', year: d.year || '1st', course_code: d.course_code || '',
                attended_adjustment: att, total_classes_adjustment: tot, isVerified: false, password: 'legacy-migrated'
            });
            sNew++;
        } else {
            ex.attended_adjustment = att;
            ex.total_classes_adjustment = tot;
            await ex.save();
            sUp++;
        }
        fbIdMap[doc.id] = ex._id;
    }
    console.log(`✅ Students: +${sNew} / ~${sUp}`);

    const sMap = {};
    (await Student.find({})).forEach(s => { if (s.roll) sMap[s.roll.toString()] = s._id; });

    // 2. Attendance Records (Granular)
    console.log('🔄 Syncing Attendance Records...');
    const arSnap = await db.collection('attendanceRecords').get();
    let arNew = 0, arUp = 0;

    for (const doc of arSnap.docs) {
        const d = doc.data();

        // Use Firebase Doc IDs
        const mapIds = (arr) => Array.isArray(arr) ? arr.map(x => fbIdMap[x]).filter(Boolean) : [];
        const pIds = mapIds(d.presentStudentIds);
        const aIds = mapIds(d.absentStudentIds);

        const ex = await Attendance.findOne({ date: d.date, timeSlot: d.timeSlot, course_code: d.course_code, department: d.department });
        if (!ex) {
            await Attendance.create({
                date: d.date, teacherName: d.teacherName || 'Imported',
                department: d.department, year: d.year, course_code: d.course_code,
                timeSlot: d.timeSlot, presentStudentIds: pIds, absentStudentIds: aIds
            });
            arNew++;
        } else {
            // Force update arrays to fix previous empty import
            ex.presentStudentIds = pIds;
            ex.absentStudentIds = aIds;
            await ex.save();
            arUp++;
        }
    }
    console.log(`✅ Attendance Records: +${arNew} / ~${arUp}`);

    // 3. Assignments
    console.log('🔄 Syncing Assignments...');
    const aSnap = await db.collection('assignments').get();
    const aMap = {};

    for (const doc of aSnap.docs) {
        const d = doc.data();
        let qIds = [];
        const srcQ = d.questions || d.questionPool || [];
        if (Array.isArray(srcQ)) {
            for (const q of srcQ) {
                const qId = (typeof q === 'object') ? q.id : q;
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

        let mAss = await Assignment.findOne({ legacy_firebase_id: doc.id });
        if (!mAss) {
            mAss = await Assignment.create({
                title: d.title, description: d.description || '', type: d.type || 'manual',
                course_code: d.targetCourse || d.course || 'Legacy',
                startTime: d.createdAt ? new Date(d.createdAt._seconds * 1000) : new Date(),
                deadline: d.deadline ? new Date(d.deadline._seconds * 1000) : new Date(),
                targetYear: d.targetYear || d.year, targetDepartments: d.targetDepartments || [],
                questions: qIds, legacy_firebase_id: doc.id
            });
        }
        aMap[doc.id] = mAss._id;
    }

    // 4. Submissions
    console.log('🔄 Syncing Submissions...');
    const subSnap = await db.collection('submissions').get();
    let subNew = 0;

    for (const doc of subSnap.docs) {
        const d = doc.data();
        // Try Mapping by Roll First (more reliable if present)
        const sRoll = d.studentRoll ? d.studentRoll.toString().trim() : null;
        let mSId = sRoll ? sMap[sRoll] : null;

        // Fallback to Student ID mapping if Roll missing
        if (!mSId && d.studentId && fbIdMap[d.studentId]) {
            mSId = fbIdMap[d.studentId];
        }

        const mAId = aMap[d.assignmentId];
        if (mSId && mAId) {
            const ex = await StudentAssignment.findOne({ studentId: mSId, assignmentId: mAId });
            if (!ex) {
                await StudentAssignment.create({
                    studentId: mSId, studentRoll: sRoll || 'Unknown', assignmentId: mAId,
                    status: 'submitted', submissionUrl: d.driveLink || '',
                    submittedAt: d.submittedAt ? new Date(d.submittedAt._seconds * 1000) : new Date()
                });
                subNew++;
            }
        }
    }
    console.log(`✅ Submissions: +${subNew}`);
    process.exit(0);
}

migrate().catch(console.error);
