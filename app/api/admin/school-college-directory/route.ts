import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SchoolCollegeEntry from '@/models/SchoolCollegeEntry';
import BatchStudent from '@/models/BatchStudent';
import { registerDirectoryEntry } from '@/lib/schoolCollegeDirectory';

export const dynamic = 'force-dynamic';

// GET - List every school/college name ever entered. The directory is append-only
// and independent of which students currently exist (see models/SchoolCollegeEntry.ts).
// Names already on existing students are folded in on every read, so the directory
// is complete from the first call rather than only growing from new saves.
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');

        if (type !== 'school' && type !== 'college') {
            return NextResponse.json({ error: 'type must be "school" or "college"' }, { status: 400 });
        }

        const field = type === 'school' ? 'schoolName' : 'collegeName';
        const [studentNames, known] = await Promise.all([
            BatchStudent.distinct(field) as Promise<string[]>,
            SchoolCollegeEntry.find({ type }).select('nameLower').lean(),
        ]);

        // Only write names the directory doesn't have yet — one batched write, and
        // nothing at all on the common path. (Writing every name on every read made
        // this endpoint slow enough to trip the service worker's 10s network timeout.)
        const knownKeys = new Set((known as any[]).map(k => k.nameLower));
        const missing = new Map<string, string>(); // lowercase key -> first spelling seen
        for (const raw of studentNames) {
            const name = (raw || '').trim();
            const key = name.toLowerCase();
            if (name && !knownKeys.has(key) && !missing.has(key)) missing.set(key, name);
        }
        if (missing.size > 0) {
            await SchoolCollegeEntry.bulkWrite(
                [...missing.entries()].map(([key, name]) => ({
                    updateOne: {
                        filter: { type, nameLower: key },
                        update: { $setOnInsert: { name, type, nameLower: key } },
                        upsert: true,
                    },
                })),
                { ordered: false }
            );
        }

        const entries = await SchoolCollegeEntry.find({ type }).sort({ nameLower: 1 }).select('name').lean();
        return NextResponse.json({ names: entries.map((e: any) => e.name) });
    } catch (error) {
        console.error('Failed to fetch school/college directory:', error);
        return NextResponse.json({ error: 'Failed to fetch directory' }, { status: 500 });
    }
}

// POST - Explicitly register a new entry (the "Add new entry" option in the dropdown)
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
        // Return the canonical stored spelling (an existing entry may differ in case).
        const stored: any = await SchoolCollegeEntry.findOne({ type, nameLower: name.trim().toLowerCase() }).select('name').lean();
        return NextResponse.json({ success: true, name: stored?.name || name.trim() });
    } catch (error) {
        console.error('Failed to add school/college directory entry:', error);
        return NextResponse.json({ error: 'Failed to add entry' }, { status: 500 });
    }
}
