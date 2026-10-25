import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import GradingLog from '@/models/GradingLog';
import { requireClaudeAccess } from '@/lib/claudeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET   /api/admin/assignments/[id]/claude-log?filter=all|warnings|failed|unreviewed   (password-protected)
 *   The audit log of grading events of this assignment (Claude and Gemini imports and edits), newest first,
 *   with totals (checks, warnings, failures, cost this week and in total).
 * PATCH { logId } | { all: true }  - mark entries as reviewed by the admin.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const access = await requireClaudeAccess(req);
    if (access instanceof NextResponse) return access;
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
    await dbConnect();

    const filter = new URL(req.url).searchParams.get('filter') || 'all';
    const q: any = { assignment: new mongoose.Types.ObjectId(id) };
    if (filter === 'warnings') q['warning.triggered'] = true;
    else if (filter === 'failed') q.status = { $in: ['failed', 'skipped'] };
    else if (filter === 'unreviewed') q['reviewed.at'] = null;

    const [entries, totals] = await Promise.all([
        GradingLog.find(q).sort({ createdAt: -1 }).limit(150).lean(),
        GradingLog.aggregate([
            { $match: { assignment: new mongoose.Types.ObjectId(id) } },
            { $group: {
                _id: null,
                checks: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
                warnings: { $sum: { $cond: ['$warning.triggered', 1, 0] } },
                failures: { $sum: { $cond: [{ $ne: ['$status', 'done'] }, 1, 0] } },
                costTotal: { $sum: '$costUSD' },
                costWeek: { $sum: { $cond: [{ $gte: ['$createdAt', new Date(Date.now() - 7 * 864e5)] }, '$costUSD', 0] } },
                unreviewed: { $sum: { $cond: [{ $eq: ['$reviewed.at', null] }, 1, 0] } },
            } },
        ]),
    ]);
    const t = totals[0] || { checks: 0, warnings: 0, failures: 0, costTotal: 0, costWeek: 0, unreviewed: 0 };
    return NextResponse.json({
        entries,
        totals: { checks: t.checks, warnings: t.warnings, failures: t.failures, unreviewed: t.unreviewed, costTotal: +t.costTotal.toFixed(4), costWeek: +t.costWeek.toFixed(4) },
    });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const access = await requireClaudeAccess(req);
    if (access instanceof NextResponse) return access;
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
    await dbConnect();
    const body = await req.json();
    const filter: any = { assignment: id, 'reviewed.at': null };
    if (!body.all) {
        if (!mongoose.isValidObjectId(body.logId)) return NextResponse.json({ error: 'Invalid log entry' }, { status: 400 });
        filter._id = body.logId;
    }
    const r = await GradingLog.updateMany(filter, { $set: { reviewed: { at: new Date(), by: access.email } } });
    return NextResponse.json({ success: true, updated: r.modifiedCount });
}
