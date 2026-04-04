import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import DeletedStudent from '@/models/DeletedStudent';

// DELETE - Permanently delete an archived student (bypass 100-day wait)
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await props.params;

        const archived = await DeletedStudent.findByIdAndDelete(id);
        if (!archived) {
            return NextResponse.json({ error: 'Archived student not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            success: true, 
            message: `${archived.studentData?.name || 'Student'} permanently deleted` 
        });
    } catch (error: any) {
        console.error('Failed to permanently delete archived student:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
    }
}
