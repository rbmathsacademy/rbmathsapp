import { NextRequest, NextResponse } from 'next/server';
import { getAdminPayload } from '@/lib/adminAuth';
import { issueUnlockToken, passwordMatches } from '@/lib/claudeAuth';
import { claudeConfigured } from '@/lib/claudeGrader';

/** POST { password } -> a 12-hour unlock token for the Claude grading features (checked on the server). */
export async function POST(req: NextRequest) {
    const admin = await getAdminPayload(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { password } = await req.json().catch(() => ({ password: '' }));
    if (!passwordMatches(String(password ?? ''))) {
        await new Promise(r => setTimeout(r, 800)); // slows down guessing
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    }
    const { token, expiresAt } = await issueUnlockToken(String(admin.email || admin.userId || ''));
    return NextResponse.json({ token, expiresAt, configured: claudeConfigured() });
}
