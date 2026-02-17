
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AssignmentFolder from '@/models/AssignmentFolder';
import Assignment from '@/models/Assignment';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await dbConnect();

        // 1. Delete the folder
        const folder = await AssignmentFolder.findByIdAndDelete(id);

        if (!folder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }

        // 2. Move contents to root (set folderId to null)
        await Assignment.updateMany(
            { folderId: id },
            { $unset: { folderId: "" } }
        );

        return NextResponse.json({ success: true, message: 'Folder deleted and assignments moved to root' });
    } catch (error: any) {
        console.error('Folder delete error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete folder' }, { status: 500 });
    }
}
