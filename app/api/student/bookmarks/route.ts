import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import Question from '@/models/Question';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getStudent(req: NextRequest) {
    let token = req.cookies.get('auth_token')?.value;

    if (!token) {
        const authHeader = req.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        await dbConnect();
        const student = await BatchStudent.findOne({ phoneNumber: payload.phoneNumber });
        return student;
    } catch (e) {
        return null;
    }
}

export async function POST(req: NextRequest) {
    await dbConnect();
    const student = await getStudent(req);
    if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { questionId } = await req.json();

        const qIdStr = questionId.toString();
        const index = student.bookmarks.findIndex((id: any) => id.toString() === qIdStr);

        let isBookmarked = false;
        if (index === -1) {
            student.bookmarks.push(questionId);
            isBookmarked = true;
        } else {
            student.bookmarks.splice(index, 1);
            isBookmarked = false;
        }
        await student.save();
        return NextResponse.json({ isBookmarked });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    await dbConnect();
    const student = await getStudent(req);
    if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await student.populate('bookmarks');
        // Filter out any nulls (deleted questions)
        const bookmarks = student.bookmarks.filter((b: any) => b);
        return NextResponse.json(bookmarks);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
