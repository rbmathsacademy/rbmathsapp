// Simple script to check what the API actually returns
const fetch = require('node-fetch');

async function testAPIs() {
    const baseUrl = 'http://localhost:3000';

    console.log('Testing API responses...\n');

    // Test submissions
    console.log('1. Fetching /api/admin/submissions');
    const subRes = await fetch(`${baseUrl}/api/admin/submissions`);
    const submissions = await subRes.json();
    console.log(`   Status: ${subRes.status}`);
    console.log(`   Count: ${submissions.length}`);
    if (submissions.length > 0) {
        console.log('   Sample submission:');
        console.log(JSON.stringify(submissions[0], null, 2));
    }

    console.log('\n2. Fetching /api/admin/assignments (needs auth)');
    console.log('   Skipping - requires auth headers');

    console.log('\n3. Fetching /api/admin/students/all');
    const studRes = await fetch(`${baseUrl}/api/admin/students/all`);
    const students = await studRes.json();
    console.log(`   Status: ${studRes.status}`);
    console.log(`   Count: ${students.length}`);
    if (students.length > 0) {
        console.log('   Sample student:');
        const sample = students[0];
        console.log(`   Name: ${sample.name}, Dept: ${sample.department}, Year: ${sample.year}`);
    }
}

testAPIs().catch(console.error);
