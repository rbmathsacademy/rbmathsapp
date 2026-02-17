import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import { fetchSheetData } from '@/lib/googleSheet';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        await dbConnect();

        // 1. Fetch latest data from Google Sheet
        const rows = await fetchSheetData();
        if (!rows || rows.length === 0) {
            return NextResponse.json({ message: 'No data found in Google Sheet' }, { status: 404 });
        }

        // 2. Group by Phone Number to merge courses
        const studentMap = new Map<string, { name: string, courses: Set<string> }>();

        for (const row of rows) {
            const cleanPhone = row.phoneNumber.replace(/\D/g, '');
            if (!cleanPhone) continue;

            if (!studentMap.has(cleanPhone)) {
                studentMap.set(cleanPhone, {
                    name: row.studentName,
                    courses: new Set()
                });
            }

            const student = studentMap.get(cleanPhone)!;
            if (row.batchName) {
                student.courses.add(row.batchName);
            }
            // Update name (last one wins)
            student.name = row.studentName;
        }

        // 3. Upsert into MongoDB
        let updatedCount = 0;
        let insertedCount = 0;

        const bulkOps = [];

        for (const [phone, data] of studentMap.entries()) {
            const courses = Array.from(data.courses);

            bulkOps.push({
                updateOne: {
                    filter: { phoneNumber: phone },
                    update: {
                        $set: {
                            name: data.name,
                            courses: courses,
                            // We don't touch bookmarks here
                        }
                    },
                    upsert: true
                }
            });
        }

        let deletedCount = 0;

        if (bulkOps.length > 0) {
            const result = await BatchStudent.bulkWrite(bulkOps);
            updatedCount = result.modifiedCount;
            insertedCount = result.upsertedCount;

            // 4. Remove students no longer in the Google Sheet
            const sheetPhones = Array.from(studentMap.keys());
            const deleteResult = await BatchStudent.deleteMany({
                phoneNumber: { $nin: sheetPhones }
            });
            deletedCount = deleteResult.deletedCount || 0;
        }

        return NextResponse.json({
            success: true,
            message: `Sync Complete. Added: ${insertedCount}, Updated: ${updatedCount}, Removed: ${deletedCount}`,
            stats: { inserted: insertedCount, updated: updatedCount, deleted: deletedCount }
        });

    } catch (error: any) {
        console.error('Sync API Error:', error);
        return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
    }
}
