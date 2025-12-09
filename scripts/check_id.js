
const mongoose = require('mongoose');
const { Schema } = mongoose;

const MONGODB_URI = 'mongodb://127.0.0.1:27017/hit-assignment-generator';

const StudentSchema = new Schema({}, { strict: false });
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const id = '693132e2edc944056e874b8b';
        console.log(`Checking ID: ${id}`);
        const doc = await Student.findById(id);
        if (doc) {
            console.log('FOUND:', doc);
        } else {
            console.log('NOT FOUND');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
