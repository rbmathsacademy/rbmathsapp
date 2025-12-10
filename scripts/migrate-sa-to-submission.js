
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function migrateToSubmission() {
    console.log('🚀 Migrating StudentAssignments to Submissions...');
    await mongoose.connect(process.env.MONGODB_URI);

    const StudentAssignmentSchema = new mongoose.Schema({
        studentId: mongoose.Schema.Types.ObjectId,
        assignmentId: mongoose.Schema.Types.ObjectId,
        status: String,
        submissionUrl: String,
        submittedAt: Date,
        marksObtained: Number
    }, { strict: false });
    const StudentAssignment = mongoose.models.StudentAssignment || mongoose.model('StudentAssignment', StudentAssignmentSchema);

    const SubmissionSchema = new mongoose.Schema({
        student: mongoose.Schema.Types.ObjectId,
        assignment: mongoose.Schema.Types.ObjectId,
        driveLink: String,
        status: String,
        submittedAt: Date,
        marksObtained: Number
    }, { strict: false });
    const Submission = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);

    const sas = await StudentAssignment.find({ status: 'submitted' });
    console.log(`Found ${sas.length} submitted assignments.`);

    let count = 0;
    for (const sa of sas) {
        // Check existence
        const ex = await Submission.findOne({ student: sa.studentId, assignment: sa.assignmentId });
        if (!ex) {
            await Submission.create({
                student: sa.studentId,
                assignment: sa.assignmentId,
                driveLink: sa.submissionUrl || '',
                status: 'submitted',
                submittedAt: sa.submittedAt || new Date(),
                marksObtained: sa.marksObtained || 0
            });
            count++;
        } else {
            // Update drive link if missing
            if (!ex.driveLink && sa.submissionUrl) {
                ex.driveLink = sa.submissionUrl;
                await ex.save();
            }
        }
    }

    console.log(`✅ Created ${count} Submission documents.`);
    process.exit(0);
}
migrateToSubmission();
