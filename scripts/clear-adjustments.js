
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function clear() {
    console.log('🧹 Clearing Attendance Adjustments...');
    if (!process.env.MONGODB_URI) { console.error('No MONGODB_URI'); process.exit(1); }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');

    // Define Schema to interact with collection
    const StudentSchema = new mongoose.Schema({ attended_adjustment: Number, total_classes_adjustment: Number }, { strict: false });
    const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

    // Reset adjustments to 0
    const res = await Student.updateMany({}, {
        $set: {
            attended_adjustment: 0,
            total_classes_adjustment: 0
        }
    });

    console.log(`✅ Cleared adjustments for ${res.modifiedCount} students.`);
    console.log('The attendance calculation will now rely purely on the "System" (granular) records.');
    process.exit(0);
}

clear().catch(console.error);
