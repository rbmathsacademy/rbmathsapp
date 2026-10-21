import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const ADMIN_ROLES = ['admin', 'superadmin', 'manager', 'copy_checker'];
const key = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod');

/** Returns the logged-in admin's token payload, or null if the caller is not an admin. */
export async function getAdminPayload(req: NextRequest): Promise<Record<string, any> | null> {
    let token = req.cookies.get('auth_token')?.value;
    if (!token) {
        const auth = req.headers.get('authorization');
        if (auth?.startsWith('Bearer ')) token = auth.slice(7);
    }
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        return ADMIN_ROLES.includes(payload.role as string) ? (payload as Record<string, any>) : null;
    } catch {
        return null;
    }
}
