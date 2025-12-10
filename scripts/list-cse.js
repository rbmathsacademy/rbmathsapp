
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function listCSE() {
    await mongoose.connect(process.env.MONGODB_URI);
    const StudentSchema = new mongoose.Schema({ name: String, roll: String, department: String }, { strict: false });
    const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

    const cse = await Student.find({ department: 'CSE' }).limit(5);
    console.log(`Found ${await Student.countDocuments({ department: 'CSE' })} CSE Students.`);
    if (cse.length > 0) {
        console.log('Sample:', JSON.stringify(cse, null, 2));
    }
    process.exit(0);
}
listCSE();
