require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

// Import the actual models
const connectDB = require('./lib/db.ts').default;

async function testActualAPI() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');
        console.log('Database:', mongoose.connection.db.databaseName);
        console.log();

        // Use actual model definitions
        const Submission = require('./models/Submission.ts').default;
        const Student = require('./models/Student.ts').default;
        const Assignment = require('./models/Assignment.ts').default;

        console.log('='.repeat(80));
        console.log('TESTING WITH ACTUAL MODELS:');
        console.log('='.repeat(80));

        const submissions = await Submission.find({})
            .populate('student', 'name email')
            .populate('assignment', 'title')
            .limit(5);

        console.log(`\nFound ${submissions.length} submissions (showing first 5):\n`);

        submissions.forEach((sub, idx) => {
            console.log(`Submission #${idx + 1}:`);
            console.log('  Student:', sub.student);
            console.log('  Assignment:', sub.assignment);
            console.log('  Submitted At:', sub.submittedAt);
            console.log();
        });

        // Check total counts
        const totalSubmissions = await Submission.countDocuments();
        const totalStudents = await Student.countDocuments();
        const totalAssignments = await Assignment.countDocuments();

        console.log('='.repeat(80));
        console.log('TOTALS:');
        console.log('='.repeat(80));
        console.log(`Submissions: ${totalSubmissions}`);
        console.log(`Students: ${totalStudents}`);
        console.log(`Assignments: ${totalAssignments}`);

        // Check if assignments have createdBy field
        console.log('\n' + '='.repeat(80));
        console.log('CHECKING ASSIGNMENT DETAILS:');
        console.log('='.repeat(80));

        const assignment = await Assignment.findOne({});
        if (assignment) {
            console.log('\nAssignment fields:');
            console.log(JSON.stringify(assignment, null, 2));
        }

        await mongoose.connection.close();
        console.log('\n✓ Connection closed');
    } catch (error) {
        console.error('Error:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

testActualAPI();
