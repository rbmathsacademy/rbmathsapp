import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual } from 'crypto';
import { getAdminPayload } from '@/lib/adminAuth';

/**
 * Password protection for the Claude grading features (batch grading, "Grade now", the log).
 * The password is checked ON THE SERVER; a correct password returns a signed 12-hour unlock token
 * that the browser keeps for the session and sends with every Claude request. Without a valid
 * token (and a signed-in admin) every Claude route refuses, so hiding a button in the page is never
 * the only protection. The password can be changed with the CLAUDE_FEATURE_PASSWORD environment
 * variable (default "rbapi").
 */
export const CLAUDE_UNLOCK_HEADER = 'x-claude-unlock';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod');

export function passwordMatches(input: string): boolean {
    const expected = process.env.CLAUDE_FEATURE_PASSWORD || 'rbapi';
    const a = Buffer.from(String(input ?? ''));
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function issueUnlockToken(adminEmail: string): Promise<{ token: string; expiresAt: number }> {
    const token = await new SignJWT({ scope: 'claude-grading', email: adminEmail.toLowerCase() })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('12h')
        .sign(secret);
    return { token, expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
}

/**
 * Use at the top of every Claude route:
 *   const access = await requireClaudeAccess(req);
 *   if (access instanceof NextResponse) return access;
 * Returns the admin's email when allowed.
 */
export async function requireClaudeAccess(req: NextRequest): Promise<{ email: string } | NextResponse> {
    const admin = await getAdminPayload(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const email = String(admin.email || admin.userId || '').toLowerCase();

    const token = req.headers.get(CLAUDE_UNLOCK_HEADER);
    if (!token) return NextResponse.json({ error: 'Claude features are locked', locked: true }, { status: 403 });
    try {
        const { payload } = await jwtVerify(token, secret);
        if (payload.scope !== 'claude-grading' || String(payload.email || '') !== email) throw new Error('wrong token');
    } catch {
        return NextResponse.json({ error: 'Claude features are locked (enter the password again)', locked: true }, { status: 403 });
    }
    return { email };
}
