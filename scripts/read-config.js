
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function readConfig() {
    if (!process.env.MONGODB_URI) process.exit(1);
    await mongoose.connect(process.env.MONGODB_URI);

    const ConfigSchema = new mongoose.Schema({ teacherAssignments: Object }, { strict: false });
    const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);

    const conf = await Config.findOne();
    if (conf) {
        console.log('Teacher Assignments:', JSON.stringify(conf.teacherAssignments, null, 2));
    } else {
        console.log('No Config found.');
    }
    process.exit(0);
}
readConfig();
