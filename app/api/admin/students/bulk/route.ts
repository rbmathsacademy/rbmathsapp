import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

// POST - Bulk import students from JSON array
export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { students } = body;

        if (!Array.isArray(students) || students.length === 0) {
            return NextResponse.json({ error: 'Students array is required and must not be empty' }, { status: 400 });
        }

        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        const bulkOps = [];

        for (const s of students) {
            if (!s.name || !s.phoneNumber) {
                errorCount++;
                errors.push(`Missing name or phone for entry: ${JSON.stringify(s).substring(0, 80)}`);
                continue;
            }

            const cleanPhone = String(s.phoneNumber).replace(/\D/g, '');
            if (!cleanPhone) {
                errorCount++;
                errors.push(`Invalid phone number for ${s.name}`);
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { phoneNumber: cleanPhone },
                    update: {
                        $set: {
                            name: s.name.trim(),
                            courses: s.courses || [],
                            ...(s.guardianPhone && { guardianPhone: String(s.guardianPhone).replace(/\D/g, '') }),
                            ...(s.guardianName && { guardianName: s.guardianName.trim() }),
                            ...(s.email && { email: s.email.trim() }),
                        },
                        $setOnInsert: { bookmarks: [] }
                    },
                    upsert: true
                }
            });
        }

        if (bulkOps.length > 0) {
            const result = await BatchStudent.bulkWrite(bulkOps);
            updatedCount = result.modifiedCount;
            insertedCount = result.upsertedCount;
        }

        return NextResponse.json({
            success: true,
            message: `Import complete. Added: ${insertedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`,
            stats: { inserted: insertedCount, updated: updatedCount, errors: errorCount },
            ...(errors.length > 0 && { errorDetails: errors.slice(0, 10) })
        });
    } catch (error: any) {
        console.error('Bulk import error:', error);
        return NextResponse.json({ error: error.message || 'Bulk import failed' }, { status: 500 });
    }
}
