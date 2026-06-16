import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { payload } = await jwtVerify(token, key);
        const phoneNumber = (payload.phoneNumber || payload.userId) as string;
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        
        const body = await req.json();
        const notificationId = body.notificationId;
        
        if (!notificationId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await dbConnect();
        
        await Notification.findByIdAndUpdate(notificationId, {
            $addToSet: { readBy: cleanPhone }
        });
        
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
