
// Using global fetch
const BASE_URL = 'http://localhost:3000/api';

async function run() {
    console.log('--- DEBUG MASS BUNK via API ---');

    // 1. Find Student2 ID
    console.log('Fetching students...');
    const sRes = await fetch(`${BASE_URL}/admin/students/all`);
    const students = await sRes.json();
    const s2 = students.find(s => s.roll === '124');

    if (!s2) {
        console.log('Student2 (Roll 124) not found via API');
        return;
    }
    console.log(`Found Student2: ${s2._id} (Roll: ${s2.roll})`);

    // 2. Fetch Attendance
    console.log(`Fetching attendance for ${s2._id}...`);
    const aRes = await fetch(`${BASE_URL}/student/attendance?studentId=${s2._id}`);
    const data = await aRes.json();

    if (aRes.status !== 200) {
        console.log('Error fetching attendance:', data);
        return;
    }

    console.log('Mass Bunk Count:', data.massBunkCount);
    console.log('Mass Bunk Dates:', JSON.stringify(data.massBunkDates, null, 2));
}

run();
