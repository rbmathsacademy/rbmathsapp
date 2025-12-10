
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function fixUploadedBy() {
    console.log('🔧 Fixing Question Ownership...');
    await mongoose.connect(process.env.MONGODB_URI);

    const QuestionSchema = new mongoose.Schema({ uploadedBy: String, facultyName: String }, { strict: false });
    const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);

    // Update all questions to be owned by ritwick92@gmail.com
    const res = await Question.updateMany(
        {},
        {
            $set: {
                uploadedBy: 'ritwick92@gmail.com',
                facultyName: 'RB'
            }
        }
    );

    console.log(`✅ Updated ownership for ${res.modifiedCount} questions to 'ritwick92@gmail.com'.`);
    process.exit(0);
}
fixUploadedBy();
