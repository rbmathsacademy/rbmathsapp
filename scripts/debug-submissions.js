require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function debugSubmissions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');
        console.log('Database:', mongoose.connection.db.databaseName);
        console.log();

        const Submission = mongoose.model('Submission', new mongoose.Schema({}, { strict: false }));
        const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
        const Assignment = mongoose.model('Assignment', new mongoose.Schema({}, { strict: false }));

        console.log('='.repeat(80));
        console.log('DATABASE CONTENTS:');
        console.log('='.repeat(80));

        const submissionsCount = await Submission.countDocuments();
        const studentsCount = await Student.countDocuments();
        const assignmentsCount = await Assignment.countDocuments();

        console.log(`📄 Submissions: ${submissionsCount}`);
        console.log(`👨‍🎓 Students: ${studentsCount}`);
        console.log(`📝 Assignments: ${assignmentsCount}`);
        console.log();

        // Check a few submissions
        console.log('='.repeat(80));
        console.log('SAMPLE SUBMISSIONS (First 5):');
        console.log('='.repeat(80));

        const submissions = await Submission.find({}).limit(5);
        submissions.forEach((sub, idx) => {
            console.log(`\nSubmission #${idx + 1}:`);
            console.log('  ID:', sub._id);
            console.log('  Student:', sub.student);
            console.log('  Assignment:', sub.assignment);
            console.log('  Submitted At:', sub.submittedAt);
            console.log('  File URL:', sub.fileUrl);
        });

        console.log('\n' + '='.repeat(80));
        console.log('SAMPLE ASSIGNMENTS (First 3):');
        console.log('='.repeat(80));

        const assignments = await Assignment.find({}).limit(3);
        assignments.forEach((asn, idx) => {
            console.log(`\nAssignment #${idx + 1}:`);
            console.log('  ID:', asn._id);
            console.log('  Title:', asn.title);
            console.log('  Target Departments:', asn.targetDepartments);
            console.log('  Target Course:', asn.targetCourse);
            console.log('  Created At:', asn.createdAt);
            console.log('  Created By:', asn.createdBy);
        });

        console.log('\n' + '='.repeat(80));
        console.log('TESTING POPULATE:');
        console.log('='.repeat(80));

        const populatedSubs = await Submission.find({})
            .populate('student', 'name email')
            .populate('assignment', 'title')
            .limit(3);

        populatedSubs.forEach((sub, idx) => {
            console.log(`\nPopulated Submission #${idx + 1}:`);
            console.log('  Student (populated):', sub.student);
            console.log('  Assignment (populated):', sub.assignment);
        });

        await mongoose.connection.close();
        console.log('\n✓ Connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugSubmissions();
