import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';
import DeletedStudent from '@/models/DeletedStudent';

const ARCHIVE_DAYS = 100;

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { studentIds } = body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: 'studentIds array is required' }, { status: 400 });
        }

        // 1. Fetch all students to archive
        const students = await BatchStudent.find({ _id: { $in: studentIds } }).lean();
        if (students.length === 0) {
            return NextResponse.json({ error: 'No students found' }, { status: 404 });
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + ARCHIVE_DAYS * 24 * 60 * 60 * 1000);

        // 2. For each student, find guardian and create archive record
        const archiveDocs = [];
        const guardianIdsToDelete = [];

        for (const student of students) {
            const guardian = await User.findOne({ phoneNumber: (student as any).phoneNumber, role: 'guardian' }).lean();
            
            archiveDocs.push({
                originalId: (student as any)._id,
                studentData: student,
                guardianData: guardian || null,
                deletedAt: now,
                expiresAt
            });

            if (guardian) {
                guardianIdsToDelete.push((guardian as any)._id);
            }
        }

        // 3. Insert all archive records
        await DeletedStudent.insertMany(archiveDocs);

        // 4. Delete originals
        const result = await BatchStudent.deleteMany({ _id: { $in: studentIds } });
        if (guardianIdsToDelete.length > 0) {
            await User.deleteMany({ _id: { $in: guardianIdsToDelete } });
        }

        return NextResponse.json({
            success: true,
            message: `Moved ${result.deletedCount} student(s) to recycle bin`,
            deletedCount: result.deletedCount
        });
    } catch (error: any) {
        console.error('Bulk soft-delete failed:', error);
        return NextResponse.json({ error: error.message || 'Bulk delete failed' }, { status: 500 });
    }
}
