import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Folder from '@/models/Folder';
// Ensure DB connection
import '@/lib/db'; // Assuming there is a db connection lib, or I should create one/ensure it connects. The current env uses standard nextjs mongo pattern.

// Simple DB Connect helper if not existing
const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

async function connectDB() {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(MONGODB_URI);
    } catch (error) {
        console.error("DB Connect Error", error);
    }
}

export async function GET(req: NextRequest) {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const course = searchParams.get('course');

    if (!course) {
        return NextResponse.json({ error: 'Course is required' }, { status: 400 });
    }

    try {
        const folders = await Folder.find({ course }).sort({ createdAt: -1 });
        return NextResponse.json(folders);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    await connectDB();
    try {
        const body = await req.json();
        const { name, course } = body;

        if (!name || !course) {
            return NextResponse.json({ error: 'Name and Course are required' }, { status: 400 });
        }

        const folder = await Folder.create({ name, course });
        return NextResponse.json(folder);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    try {
        await Folder.findByIdAndDelete(id);
        // TODO: Optionally remove deployments from questions associated with this folder?
        // For now, let's leave them or user handles it.
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }
}
