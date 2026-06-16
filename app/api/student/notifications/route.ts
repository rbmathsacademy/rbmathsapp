import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { payload } = await jwtVerify(token, key);
        const phoneNumber = (payload.phoneNumber || payload.userId) as string;
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const courses = payload.courses as string[] || [];
        
        await dbConnect();
        
        const now = new Date();
        
        const query = {
            type: 'popup',
            $and: [
                { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] },
                { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] }
            ],
            $or: [
                { targetBatches: { $in: courses } },
                { 'targetStudents.phoneNumber': { $in: [cleanPhone, phoneNumber] } } // Check both just in case
            ],
            readBy: { $ne: cleanPhone }
        };

        const notifications = await Notification.find(query).sort({ createdAt: 1 }); // Oldest first
        
        return NextResponse.json(notifications);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
