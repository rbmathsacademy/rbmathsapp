/**
 * Migration Script: Fix timezone-corrupted deployment times
 * 
 * PROBLEM:
 * Tests deployed BEFORE the timezone fix had their times stored incorrectly.
 * The admin entered IST times (e.g., 9:01 AM IST), but on Vercel (UTC server),
 * `new Date("2026-02-26T09:01")` was interpreted as 09:01 UTC instead of
 * 09:01 IST (which would be 03:31 UTC). So stored times are +5:30 ahead.
 * 
 * FIX:
 * Subtract 5 hours 30 minutes from startTime and endTime for affected tests.
 * 
 * BEFORE: Start 09:01 UTC (displays 2:31 PM IST) / End 23:00 UTC (displays 4:30 AM IST)
 * AFTER:  Start 03:31 UTC (displays 9:01 AM IST) / End 17:30 UTC (displays 11:00 PM IST)
 * 
 * Usage:
 *   DRY RUN (default):  node scripts/fix-timezone-deployed-tests.js
 *   APPLY FIX:          node scripts/fix-timezone-deployed-tests.js --apply
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

// The timezone fix was applied around this time (from conversation log)
// Tests updated BEFORE this timestamp have corrupted times
const TIMEZONE_FIX_APPLIED_AT = new Date('2026-02-26T03:40:00Z');

const OnlineTestSchema = new mongoose.Schema({
    title: String,
    status: String,
    deployment: {
        startTime: Date,
        endTime: Date,
        durationMinutes: Number,
        batches: [String]
    }
}, { strict: false, timestamps: true });

const OnlineTest = mongoose.models.OnlineTest || mongoose.model('OnlineTest', OnlineTestSchema);

async function fixTimezones() {
    const applyFix = process.argv.includes('--apply');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB\n');

        // Find all deployed/completed tests that were updated before the timezone fix
        const tests = await OnlineTest.find({
            status: { $in: ['deployed', 'completed'] },
            'deployment.startTime': { $exists: true },
            updatedAt: { $lt: TIMEZONE_FIX_APPLIED_AT }
        }).lean();

        console.log(`Found ${tests.length} test(s) deployed before the timezone fix.\n`);

        if (tests.length === 0) {
            // Also check if there are tests that might have been re-saved after the fix
            // but still have corrupted data (admin clicked save without noticing the wrong times)
            console.log('No tests found with updatedAt before the fix.');
            console.log('Checking ALL deployed tests for manual review...\n');

            const allTests = await OnlineTest.find({
                status: { $in: ['deployed', 'completed'] },
                'deployment.startTime': { $exists: true }
            }).lean();

            for (const test of allTests) {
                const start = new Date(test.deployment.startTime);
                const end = new Date(test.deployment.endTime);
                const correctedStart = new Date(start.getTime() - IST_OFFSET_MS);
                const correctedEnd = new Date(end.getTime() - IST_OFFSET_MS);

                console.log('='.repeat(60));
                console.log(`Title: ${test.title}`);
                console.log(`ID: ${test._id}`);
                console.log(`Status: ${test.status}`);
                console.log(`Updated: ${test.updatedAt}`);
                console.log('---');
                console.log(`CURRENT  Start: ${start.toISOString()} → IST: ${start.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                console.log(`CURRENT  End:   ${end.toISOString()} → IST: ${end.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                console.log('---');
                console.log(`FIXED    Start: ${correctedStart.toISOString()} → IST: ${correctedStart.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                console.log(`FIXED    End:   ${correctedEnd.toISOString()} → IST: ${correctedEnd.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                console.log('');
            }

            if (!applyFix) {
                console.log('\n⚠️  DRY RUN - No changes made.');
                console.log('    Review the FIXED times above.');
                console.log('    If they look correct, run with --apply flag:');
                console.log('    node scripts/fix-timezone-deployed-tests.js --apply\n');
            } else {
                // Apply fix to all deployed tests
                for (const test of allTests) {
                    const start = new Date(test.deployment.startTime);
                    const end = new Date(test.deployment.endTime);
                    const correctedStart = new Date(start.getTime() - IST_OFFSET_MS);
                    const correctedEnd = new Date(end.getTime() - IST_OFFSET_MS);

                    await OnlineTest.updateOne(
                        { _id: test._id },
                        {
                            $set: {
                                'deployment.startTime': correctedStart,
                                'deployment.endTime': correctedEnd
                            }
                        }
                    );
                    console.log(`✅ Fixed: "${test.title}" (${test._id})`);
                    console.log(`   Start: ${start.toISOString()} → ${correctedStart.toISOString()}`);
                    console.log(`   End:   ${end.toISOString()} → ${correctedEnd.toISOString()}\n`);
                }
                console.log('🎉 All tests fixed successfully!');
            }
            return;
        }

        // Process found tests
        for (const test of tests) {
            const start = new Date(test.deployment.startTime);
            const end = new Date(test.deployment.endTime);
            const correctedStart = new Date(start.getTime() - IST_OFFSET_MS);
            const correctedEnd = new Date(end.getTime() - IST_OFFSET_MS);

            console.log('='.repeat(60));
            console.log(`Title: ${test.title}`);
            console.log(`ID: ${test._id}`);
            console.log('---');
            console.log(`CURRENT  Start: ${start.toISOString()} → IST: ${start.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
            console.log(`CURRENT  End:   ${end.toISOString()} → IST: ${end.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
            console.log('---');
            console.log(`FIXED    Start: ${correctedStart.toISOString()} → IST: ${correctedStart.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
            console.log(`FIXED    End:   ${correctedEnd.toISOString()} → IST: ${correctedEnd.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
            console.log('');

            if (applyFix) {
                await OnlineTest.updateOne(
                    { _id: test._id },
                    {
                        $set: {
                            'deployment.startTime': correctedStart,
                            'deployment.endTime': correctedEnd
                        }
                    }
                );
                console.log(`✅ Fixed!\n`);
            }
        }

        if (!applyFix) {
            console.log('\n⚠️  DRY RUN - No changes made.');
            console.log('    Review the FIXED times above.');
            console.log('    If they look correct, run with --apply flag:');
            console.log('    node scripts/fix-timezone-deployed-tests.js --apply\n');
        } else {
            console.log('\n🎉 All affected tests fixed successfully!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixTimezones();
