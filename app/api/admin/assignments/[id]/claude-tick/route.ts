import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { requireClaudeAccess } from '@/lib/claudeAuth';
import { claudeConfigured } from '@/lib/claudeGrader';
import { jobStatus, tick } from '@/lib/claudeJobs';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/assignments/[id]/claude-tick   (password-protected)
 * One short step of the Claude queue: sends waiting copies as batches and saves the results of any
 * batch Claude has finished. Safe to call repeatedly (the admin panel does, while it is open, and
 * "Check now" calls it once). Returns the current status.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const access = await requireClaudeAccess(req);
    if (access instanceof NextResponse) return access;
    try {
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
        await dbConnect();
        let done = { sent: 0, collected: 0 };
        if (claudeConfigured()) done = await tick(id, 40000);
        return NextResponse.json({ ...done, ...(await jobStatus(id)) });
    } catch (error: any) {
        console.error('[claude-tick] failed:', error);
        return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
    }
}
