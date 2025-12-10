import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';
import User from '@/models/User';

const GLOBAL_ADMIN_KEY = 'globaladmin_25';

export async function GET(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');

    if (adminKey === GLOBAL_ADMIN_KEY) {
        try {
            const questions = await Question.find({}).sort({ createdAt: -1 });
            return NextResponse.json(questions);
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

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
    const adminKey = req.headers.get('X-Global-Admin-Key');

    if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let uploaderEmail = email;
        let facultyName = 'Global Admin';

        if (email) {
            const user = await User.findOne({ email });
            if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
            facultyName = user.name;
            uploaderEmail = email;
        } else {
            // Global Admin without email
            uploaderEmail = 'global_admin';
        }

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
                        uploadedBy: uploaderEmail,
                        facultyName: facultyName
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
    const adminKey = req.headers.get('X-Global-Admin-Key');

    if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        // Only delete questions owned by this user
        const query: any = { id: { $in: ids } };
        if (adminKey !== GLOBAL_ADMIN_KEY) {
            query.uploadedBy = email;
        }

        await Question.deleteMany(query);

        return NextResponse.json({ message: 'Questions deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
