import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { requireClaudeAccess } from '@/lib/claudeAuth';
import { claudeConfigured } from '@/lib/claudeGrader';
import { gradeNow, queueJobs, sendOneChunk } from '@/lib/claudeJobs';

export const maxDuration = 60;

/**
 * POST /api/admin/assignments/[id]/claude-grade   (password-protected)
 *   { action: 'queue', submissionIds: [...], regrade?: boolean, effort? }  -> jobs for the batch queue
 *   { action: 'now',   submissionId,         regrade?: boolean, effort? }  -> grade one copy immediately
 * After 'queue', the page calls claude-tick repeatedly to send the batches and collect results.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const access = await requireClaudeAccess(req);
    if (access instanceof NextResponse) return access;
    try {
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
        if (!claudeConfigured()) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server' }, { status: 503 });
        const body = await req.json();
        const effort = ['low', 'medium', 'high'].includes(body.effort) ? body.effort : undefined;
        await dbConnect();

        if (body.action === 'now') {
            if (!mongoose.isValidObjectId(body.submissionId)) return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
            const out = await gradeNow({ assignmentId: id, submissionId: body.submissionId, regrade: !!body.regrade, by: access.email, effort });
            return NextResponse.json(out, { status: out.ok ? 200 : 422 });
        }

        if (body.action === 'queue') {
            const ids: string[] = (Array.isArray(body.submissionIds) ? body.submissionIds : []).filter((x: string) => mongoose.isValidObjectId(x)).slice(0, 300);
            if (ids.length === 0) return NextResponse.json({ error: 'No submissions selected' }, { status: 400 });
            const out = await queueJobs({ assignmentId: id, submissionIds: ids, regrade: !!body.regrade, by: access.email, effort });
            if (out.queued > 0) await sendOneChunk(id).catch(e => console.error('[claude-grade] first chunk failed:', e)); // get the first batch going right away
            return NextResponse.json({ success: true, ...out });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: any) {
        console.error('[claude-grade] failed:', error);
        return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
    }
}
