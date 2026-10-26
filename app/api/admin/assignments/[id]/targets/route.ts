import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import { getAdminPayload } from '@/lib/adminAuth';

/**
 * PUT /api/admin/assignments/[id]/targets
 * Body: { add: string[] } - phone numbers of batch students to add to an assignment that was created
 * for selected students only. (To take a student out, use "exclude student".)
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await getAdminPayload(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        const { add } = await req.json();
        const phones: string[] = (Array.isArray(add) ? add : []).map((p: any) => String(p)).filter(Boolean).slice(0, 500);
        if (phones.length === 0) return NextResponse.json({ error: 'No students given' }, { status: 400 });
        await dbConnect();
        const a = await Assignment.findById(id).select('targetStudents').lean() as any;
        if (!a) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        if (!(a.targetStudents || []).length) return NextResponse.json({ error: 'This assignment is for the whole batch' }, { status: 400 });
        await Assignment.updateOne({ _id: id }, { $addToSet: { targetStudents: { $each: phones } }, $pull: { excludedStudents: { $in: phones } } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
    }
}
