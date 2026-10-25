import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { requireClaudeAccess } from '@/lib/claudeAuth';
import { claudeConfigured, CLAUDE_MODEL } from '@/lib/claudeGrader';
import { jobStatus } from '@/lib/claudeJobs';

export const dynamic = 'force-dynamic';

/** GET /api/admin/assignments/[id]/claude-status   (password-protected) - read-only status of the queue. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const access = await requireClaudeAccess(req);
    if (access instanceof NextResponse) return access;
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
    await dbConnect();
    return NextResponse.json({ configured: claudeConfigured(), model: CLAUDE_MODEL, ...(await jobStatus(id)) });
}
