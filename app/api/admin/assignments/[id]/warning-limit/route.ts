import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import { getAdminPayload } from '@/lib/adminAuth';
import { recheckWarnings } from '@/lib/aiGradeSave';

/**
 * PUT /api/admin/assignments/[id]/warning-limit   { limit: number | null }
 * Sets how many wrong + skipped questions are allowed before a graded student is flagged (null = off),
 * then re-checks every graded copy: new warnings notify the student once, old ones that no longer
 * apply are cleared.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await getAdminPayload(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
    const { limit } = await req.json();
    const value = limit === null || limit === '' || limit === undefined ? null : Math.round(Number(limit));
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 500)) {
        return NextResponse.json({ error: 'The limit must be a number from 0 to 500, or empty to switch warnings off' }, { status: 400 });
    }
    await dbConnect();
    const a = await Assignment.findByIdAndUpdate(id, { $set: { warningLimit: value } }, { new: true }).select('_id').lean();
    if (!a) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    const result = await recheckWarnings(id);
    return NextResponse.json({ success: true, limit: value, ...result });
}
