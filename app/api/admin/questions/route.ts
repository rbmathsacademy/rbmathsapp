import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';
import User from '@/models/User';

// Helper to get user from request (mocking session for now, assuming client sends email/id)
// In a real app, use NextAuth session. Here we'll rely on a header or query param for simplicity
// OR better, since we have a login flow, we can try to parse the 'user' cookie if it exists,
// but the previous login implementation just returned user data to client.
// We will expect the client to send 'X-User-Email' header for now as a simple security measure for this migration.

export async function GET(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');

    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Filter by uploadedBy to only show questions owned by the faculty
        const questions = await Question.find({ uploadedBy: email }).sort({ createdAt: -1 });
        return NextResponse.json(questions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');

    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();
        const { questions } = body; // Expecting an array of questions

        if (!Array.isArray(questions)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const operations = questions.map((q: any) => ({
            updateOne: {
                filter: { id: q.id },
                update: {
                    $set: {
                        ...q,
                        uploadedBy: email,
                        facultyName: user.name
                    }
                },
                upsert: true
            }
        }));

        await Question.bulkWrite(operations);

        return NextResponse.json({ message: 'Questions saved successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');

    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        // Only delete questions owned by this user
        await Question.deleteMany({
            id: { $in: ids },
            uploadedBy: email
        });

        return NextResponse.json({ message: 'Questions deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
