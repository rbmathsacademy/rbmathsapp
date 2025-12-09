import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Attendance from '@/models/Attendance';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const { id } = await params;
        const deleted = await Attendance.findByIdAndDelete(id);
        if (!deleted) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Record deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const { id } = await params;
        const body = await req.json();

        const updated = await Attendance.findByIdAndUpdate(id, { $set: body }, { new: true });

        if (!updated) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Record updated successfully', record: updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
