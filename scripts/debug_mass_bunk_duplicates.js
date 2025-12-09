
// Using global fetch
const BASE_URL = 'http://localhost:3000/api';

async function run() {
    console.log('--- DEBUG DUPLICATES ---');

    console.log('Fetching students...');
    const sRes = await fetch(`${BASE_URL}/admin/students/all`);
    const students = await sRes.json();
    const s2 = students.find(s => s.roll === '124');

    if (!s2) return;

    // Dates of interest
    const dates = ['2025-12-04', '2025-12-08'];

    // We can't query by date via student/attendance API directly for specific records?
    // The API returns all.
    // Let's just fetch all and filter client side.
    const aRes = await fetch(`${BASE_URL}/student/attendance?studentId=${s2._id}`);
    const data = await aRes.json();

    const records = data.records; // This contains "records where student is present/absent"
    // WAIT. The API returns:
    // 1. `records`: filtered by `presentStudentIds.includes(ANY_ID) OR absentStudentIds.includes(ANY_ID)`
    // 2. `massBunks`: calculated from `allCourseRecords` (which matches course/dept/year)
    //
    // If there is ANY record that DOES NOT contain the student in Present OR Absent list, 
    // it won't be in `data.records`.
    // But it MIGHT be in `massBunks` if it's empty!

    // We need to see if there are overlapping records for these dates in `data.records`.
    // Actually, `data.records` only has records where the student is involved.
    // If the student is "present" in a parallel record, it should be in `data.records`.

    dates.forEach(datePrefix => {
        console.log(`\nChecking records for ${datePrefix}...`);

        // Find in `records` (Student involved)
        const relevant = records.filter(r => r.date.startsWith(datePrefix));
        relevant.forEach(r => {
            console.log(`  [RECORD] ${r.course_code} | ${r.timeSlot} | Teacher: ${r.teacherName} | Status: ${r.status}`);
            console.log(`           Present: ${r.presentStudentIds.length}, Absent: ${r.absentStudentIds.length}`);
        });

        // Find in massBunks (Student NOT involved usually, or empty)
        const bunks = data.massBunkDates.filter(mb => mb.date.startsWith(datePrefix));
        bunks.forEach(mb => {
            console.log(`  [MASS BUNK] ${mb.course_code} | ${mb.timeSlot} | Teacher: ${mb.teacherName}`);
        });
    });

}

run();
