import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { claudeConfigured } from '@/lib/claudeGrader';
import { tick } from '@/lib/claudeJobs';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Daily safety net (see vercel.json): sends any queued copies and saves results of finished batches
 * that nobody collected yet. The normal path is the admin panel (it polls while open); this only
 * makes sure nothing stays uncollected for long. Protected by CRON_SECRET when that is set.
 */
export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!claudeConfigured()) return NextResponse.json({ skipped: 'no ANTHROPIC_API_KEY' });
    await dbConnect();
    return NextResponse.json(await tick(undefined, 45000));
}
