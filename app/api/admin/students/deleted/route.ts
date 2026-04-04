import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import DeletedStudent from '@/models/DeletedStudent';

export const dynamic = 'force-dynamic';

// GET - List all archived (soft-deleted) students
export async function GET() {
    try {
        await dbConnect();

        const archived = await DeletedStudent.find({})
            .sort({ deletedAt: -1 })
            .lean();

        const students = archived.map((doc: any) => ({
            _id: doc._id,
            originalId: doc.originalId,
            name: doc.studentData?.name || 'Unknown',
            phoneNumber: doc.studentData?.phoneNumber || '',
            courses: doc.studentData?.courses || [],
            deletedAt: doc.deletedAt,
            expiresAt: doc.expiresAt,
            daysRemaining: Math.max(0, Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        }));

        return NextResponse.json({ students, total: students.length });
    } catch (error: any) {
        console.error('Failed to fetch deleted students:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch' }, { status: 500 });
    }
}
