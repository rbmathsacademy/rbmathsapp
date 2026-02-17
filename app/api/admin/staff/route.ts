import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        const staff = await User.find({
            role: { $in: ['manager', 'copy_checker'] }
        }).select('name phoneNumber role email createdAt').sort({ createdAt: -1 });

        return NextResponse.json({ staff });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { name, phoneNumber, role } = await req.json();

        if (!['manager', 'copy_checker'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const cleanPhone = phoneNumber.replace(/\D/g, '');
        if (!cleanPhone) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
        }

        const existing = await User.findOne({ phoneNumber: cleanPhone });
        if (existing) {
            return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(cleanPhone, 10);

        const staff = await User.create({
            name: name.trim(),
            phoneNumber: cleanPhone,
            email: `${role}.${cleanPhone}@portal.local`,
            password: hashedPassword,
            role: role
        });

        return NextResponse.json({ success: true, staff }, { status: 201 });

    } catch (error: any) {
        console.error('Add staff error:', error);
        return NextResponse.json({ error: error.message || 'Failed to add staff' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await User.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
    }
}
