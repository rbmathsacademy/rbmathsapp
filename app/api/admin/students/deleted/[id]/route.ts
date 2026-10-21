import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import DeletedStudent from '@/models/DeletedStudent';
import { purgeStudentRecords } from '@/lib/studentPurge';

// DELETE - Permanently delete an archived student (bypass 100-day wait)
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await props.params;

        const archived = await DeletedStudent.findById(id).lean() as any;
        if (!archived) {
            return NextResponse.json({ error: 'Archived student not found' }, { status: 404 });
        }

        // Purge their test attempts, homework submissions and survey responses (never fee records)
        const purged = await purgeStudentRecords(archived.originalId.toString(), archived.studentData?.phoneNumber);
        await DeletedStudent.deleteOne({ _id: id });

        return NextResponse.json({ 
            success: true, 
            purged,
            message: `${archived.studentData?.name || 'Student'} permanently deleted` 
        });
    } catch (error: any) {
        console.error('Failed to permanently delete archived student:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
    }
}
