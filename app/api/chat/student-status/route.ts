import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import ChatBatchMetadata from '@/models/ChatBatchMetadata';
import BatchStudent from '@/models/BatchStudent';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { payload } = await jwtVerify(token, key);
        const phoneNumber = (payload.phoneNumber || payload.userId) as string;
        
        await dbConnect();

        const student = await BatchStudent.findOne({ phoneNumber }).lean();
        if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        const batches = student.courses || [];
        const metadata = await ChatBatchMetadata.find({ batchId: { $in: batches } }).lean();
        
        let unreadCount = 0;
        const readStatus = (student as any).chatReadStatus || {};

        metadata.forEach((m: any) => {
            const lastRead = readStatus instanceof Map ? readStatus.get(m.batchId) : readStatus[m.batchId];
            const lastReadDate = lastRead ? new Date(lastRead) : new Date(0);
            const msgDate = m.lastMessageAt ? new Date(m.lastMessageAt) : new Date(0);
            
            if (msgDate.getTime() > lastReadDate.getTime()) {
                unreadCount++;
            }
        });

        return NextResponse.json({ unreadCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
