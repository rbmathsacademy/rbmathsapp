import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { email, newName } = await req.json();

        if (!email || !newName) {
            return NextResponse.json({ error: 'Missing email or newName' }, { status: 400 });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        user.name = newName;
        await user.save();

        return NextResponse.json({
            message: 'Name updated successfully',
            user: { email: user.email, name: user.name }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
