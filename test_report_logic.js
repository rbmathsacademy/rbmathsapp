// Mock Data
const students = [
    { _id: 's1', name: 'Student 1', department: 'CSE', year: '1', course_code: 'C1', roll: '1' },
    { _id: 's2', name: 'Student 2', department: 'CSE', year: '1', course_code: 'C1', roll: '2' }
];

const records = [
    { _id: 'r1', date: '2023-10-01', timeSlot: '9-10AM', teacherEmail: 'prof@test.com', presentStudentIds: ['s1'], absentStudentIds: ['s2'] },
    { _id: 'r2', date: '2023-10-02', timeSlot: '10-11AM', teacherEmail: 'other@test.com', presentStudentIds: ['s2'], absentStudentIds: ['s1'] }
];

const reportFilters = { dept: 'CSE', year: '1', course: 'C1' };
const selectedFaculties = ['prof@test.com'];

// Simulate handleGenerateReport
console.log('--- Testing Report Generation ---');

// 1. Filter Students
const filteredStudents = students.filter(s =>
    s.department === reportFilters.dept &&
    s.year === reportFilters.year &&
    s.course_code === reportFilters.course
);
console.log('Filtered Students:', filteredStudents.length);

// 2. Filter Records (by Faculty)
let filteredRecords = records;
if (selectedFaculties.length > 0) {
    filteredRecords = records.filter(r => selectedFaculties.includes(r.teacherEmail));
}
console.log('Filtered Records (Faculty):', filteredRecords.length);

// 3. Sort Records
const timeSlotOrder = ["9-10AM", "10-11AM", "11-12PM", "12-1PM", "1-2PM", "2-3PM", "3-4PM", "4-5PM", "5-6PM"];
filteredRecords.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return timeSlotOrder.indexOf(a.timeSlot) - timeSlotOrder.indexOf(b.timeSlot);
});

// 4. Generate Ledger Data
const reportData = { students: filteredStudents, records: filteredRecords };

console.log('Report Data Records:', reportData.records.map(r => r._id));

// 5. Simulate Rendering
reportData.students.forEach(student => {
    console.log(`Student: ${student.name}`);
    reportData.records.forEach(r => {
        const isPresent = r.presentStudentIds.includes(student._id);
        const isAbsent = r.absentStudentIds.includes(student._id);
        console.log(`  Record ${r.date} ${r.timeSlot}: ${isPresent ? 'P' : isAbsent ? 'A' : '-'}`);
    });
});

if (filteredStudents.length === 2 && filteredRecords.length === 1 && filteredRecords[0]._id === 'r1') {
    console.log('Report Logic: PASS');
} else {
    console.log('Report Logic: FAIL');
}
