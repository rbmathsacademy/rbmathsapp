import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import ChatBatchMetadata from '@/models/ChatBatchMetadata';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getPayload(req: NextRequest) {
    let token = req.cookies.get('auth_token')?.value;
    if (!token) {
        const authHeader = req.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        return payload;
    } catch (e) {
        return null;
    }
}

export async function GET(req: NextRequest) {
    try {
        const payload = await getPayload(req);
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminRoles = ['admin', 'superadmin', 'manager', 'copy_checker'];
        if (!adminRoles.includes(payload.role as string)) {
            // Silently return 0 for non-admin (student sidebar might call this)
            return NextResponse.json({ status: {}, unreadCount: 0 });
        }
        
        await dbConnect();

        const metadata = await ChatBatchMetadata.find().lean();
        
        let unreadCount = 0;
        const status: Record<string, boolean> = {};
        
        metadata.forEach((m: any) => {
            const isUnread = !m.lastAdminReadAt || new Date(m.lastMessageAt).getTime() > new Date(m.lastAdminReadAt).getTime();
            status[m.batchId] = isUnread;
            if (isUnread) unreadCount++;
        });

        return NextResponse.json({ status, unreadCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
