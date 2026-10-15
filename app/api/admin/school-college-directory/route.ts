import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SchoolCollegeEntry from '@/models/SchoolCollegeEntry';
import { registerDirectoryEntry } from '@/lib/schoolCollegeDirectory';

// GET - List every school/college name ever entered (this directory is append-only
// and independent of which students currently exist — see models/SchoolCollegeEntry.ts)
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');

        if (type !== 'school' && type !== 'college') {
            return NextResponse.json({ error: 'type must be "school" or "college"' }, { status: 400 });
        }

        const entries = await SchoolCollegeEntry.find({ type }).sort({ name: 1 }).select('name').lean();
        return NextResponse.json({ names: entries.map((e: any) => e.name) });
    } catch (error) {
        console.error('Failed to fetch school/college directory:', error);
        return NextResponse.json({ error: 'Failed to fetch directory' }, { status: 500 });
    }
}

// POST - Explicitly register a custom entry (e.g. typed before any student uses it)
export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { type, name } = body;

        if (type !== 'school' && type !== 'college') {
            return NextResponse.json({ error: 'type must be "school" or "college"' }, { status: 400 });
        }
        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        await registerDirectoryEntry(type, name);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to add school/college directory entry:', error);
        return NextResponse.json({ error: 'Failed to add entry' }, { status: 500 });
    }
}
