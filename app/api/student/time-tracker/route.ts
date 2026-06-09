import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import PageTimeLog from '@/models/PageTimeLog';
import BatchStudent from '@/models/BatchStudent';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getStudentFromToken(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        return {
            phoneNumber: (payload.phoneNumber || payload.userId) as string,
            studentName: payload.studentName as string,
            courses: payload.courses as string[] || []
        };
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const student = await getStudentFromToken(req);
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const logs: Array<{ pageName: string, date: string, durationSeconds: number }> = body.logs;

        if (!Array.isArray(logs) || logs.length === 0) {
            return NextResponse.json({ message: 'No logs to process' });
        }

        await dbConnect();

        // Get student's batches from MongoDB to ensure they are up to date
        const cleanPhone = student.phoneNumber.replace(/\D/g, '');
        const dbStudent = await BatchStudent.findOne({ phoneNumber: cleanPhone }).lean();
        const batchNames = (dbStudent as any)?.courses || student.courses || [];

        // Prepare bulk operations
        const bulkOps = logs.map(log => ({
            updateOne: {
                filter: {
                    studentPhone: student.phoneNumber,
                    date: log.date,
                    pageName: log.pageName
                },
                update: {
                    $inc: { durationSeconds: log.durationSeconds },
                    $setOnInsert: {
                        studentName: student.studentName,
                        batchNames: batchNames
                    }
                },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            await PageTimeLog.bulkWrite(bulkOps);
        }

        return NextResponse.json({ success: true, processed: bulkOps.length });
    } catch (error: any) {
        console.error('Error saving time logs:', error);
        return NextResponse.json({ error: 'Failed to save time logs' }, { status: 500 });
    }
}
