import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';

async function verifyAdmin(req: NextRequest) {
    const email = req.headers.get('x-user-email');
    if (!email) return false;
    // In a real app we'd verify the JWT token from cookies here if it's admin.
    // For now we rely on the header passed from frontend which is standard for this app.
    return true;
}

export async function GET(req: NextRequest) {
    if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await dbConnect();
        const notifications = await Notification.find({ type: 'popup' }).sort({ createdAt: -1 });
        return NextResponse.json(notifications);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await dbConnect();
        const body = await req.json();
        
        const notification = new Notification({
            ...body,
            type: 'popup',
        });
        
        await notification.save();
        return NextResponse.json(notification, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await dbConnect();
        const body = await req.json();
        const { _id, ...updateData } = body;
        
        if (!_id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const notification = await Notification.findByIdAndUpdate(_id, updateData, { new: true });
        if (!notification) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        
        return NextResponse.json(notification);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await dbConnect();
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        await Notification.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
