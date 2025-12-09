
// Using global fetch
const BASE_URL = 'http://localhost:3000/api';

async function run() {
    const res = await fetch(`${BASE_URL}/admin/debug/attendance?course=MTH1102`);
    const records = await res.json();

    console.log(`Fetched ${records.length} records.`);
    records.forEach((r, i) => {
        console.log(`\n${i + 1}. [${r._id}] ${r.date} | ${r.timeSlot} | ${r.teacherName}`);
        console.log(`   Present: ${r.presentStudentIds}`);
        console.log(`   Absent: ${r.absentStudentIds}`);
    });
}
run();
