import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Config from '@/models/Config';
import User from '@/models/User';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const config = await Config.findOne({ key: 'anomaly_settings' }).lean();
        const gapThreshold = (config as any)?.value?.gapThreshold || 25;

        return NextResponse.json({ gapThreshold });
    } catch (error) {
        console.error('Error fetching anomaly settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        await dbConnect();
        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { gapThreshold } = await request.json();
        if (typeof gapThreshold !== 'number') {
            return NextResponse.json({ error: 'Invalid threshold value' }, { status: 400 });
        }

        await Config.findOneAndUpdate(
            { key: 'anomaly_settings' },
            { $set: { value: { gapThreshold } } },
            { upsert: true, new: true }
        );

        return NextResponse.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating anomaly settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
