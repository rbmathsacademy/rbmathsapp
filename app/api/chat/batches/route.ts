import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import ChatBatchMetadata from '@/models/ChatBatchMetadata';
import BatchStudent from '@/models/BatchStudent';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getPayload(req: NextRequest) {
    // Try cookie first
    let token = req.cookies.get('auth_token')?.value;
    
    // Fallback: Authorization header
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
        console.error('[Chat Batches] JWT verify error:', e);
        return null;
    }
}

export async function GET(req: NextRequest) {
    try {
        const payload = await getPayload(req);
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const role = payload.role as string;
        const adminRoles = ['admin', 'superadmin', 'manager', 'copy_checker'];
        
        console.log(`[Chat Batches API] Role from token: "${role}", isAdmin: ${adminRoles.includes(role)}`);
        
        if (!adminRoles.includes(role)) {
             return NextResponse.json({ error: 'Forbidden', detail: `Role "${role}" not in admin roles` }, { status: 403 });
        }
        
        await dbConnect();

        // Get all unique batches from students
        const batches: string[] = await BatchStudent.distinct('courses');
        
        console.log(`[Chat Batches API] Found ${batches.length} batches:`, batches);

        // Get metadata for all batches
        const metadata = await ChatBatchMetadata.find({ batchId: { $in: batches } }).lean();
        
        const metadataMap = new Map(metadata.map((m: any) => [m.batchId, m]));

        const result = batches.map(batchName => {
            const m: any = metadataMap.get(batchName);
            return {
                id: batchName,
                name: batchName,
                hasUnread: m ? m.lastMessageAt > m.lastAdminReadAt : false,
                lastMessageAt: m ? m.lastMessageAt : null
            };
        });

        // Sort: unread first, then by most recent message
        result.sort((a: any, b: any) => {
            if (a.hasUnread && !b.hasUnread) return -1;
            if (!a.hasUnread && b.hasUnread) return 1;
            if (a.lastMessageAt && b.lastMessageAt) {
                return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
            }
            if (a.lastMessageAt) return -1;
            if (b.lastMessageAt) return 1;
            return a.name.localeCompare(b.name);
        });

        return NextResponse.json({ batches: result });
    } catch (error: any) {
        console.error('Chat Batches API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
