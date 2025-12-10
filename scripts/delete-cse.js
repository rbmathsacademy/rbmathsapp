
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function deleteCSE() {
    await mongoose.connect(process.env.MONGODB_URI);
    const StudentSchema = new mongoose.Schema({}, { strict: false });
    const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

    const res = await Student.deleteMany({ department: 'CSE' });
    console.log(`Deleted ${res.deletedCount} CSE students.`);
    process.exit(0);
}
deleteCSE();
