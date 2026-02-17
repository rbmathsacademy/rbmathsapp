
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AssignmentFolder from '@/models/AssignmentFolder';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { name } = await req.json();

        if (!name) {
            return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }

        const folder = await AssignmentFolder.create({ name });
        return NextResponse.json({ success: true, folder }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to create folder' }, { status: 500 });
    }
}
