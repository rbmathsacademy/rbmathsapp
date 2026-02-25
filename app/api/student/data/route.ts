import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Folder from '@/models/Folder';
// Ensure DB connection
import '@/lib/db';

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

    // Middleware should have verified token, but we can't easily access payload in Next 13+ app dir directly from request headers in all cases cleanly without using `headers()`.
    // However, the middleware sets headers 'x-user-id' etc.
    const courseParams = req.nextUrl.searchParams.get('course');
    const folderId = req.nextUrl.searchParams.get('folderId');
    const parentId = req.nextUrl.searchParams.get('parentId');

    // Fetch Questions for a Folder
    if (folderId) {
        // Need to import Question model dynamically or at top if not already
        const Question = (await import('@/models/Question')).default;
        try {
            const questions = await Question.find({ "deployments.folderId": folderId });
            return NextResponse.json({ questions });
        } catch (error) {
            return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
        }
    }

    // Fetch Folders for a Course
    if (!courseParams) {
        return NextResponse.json({ error: 'Course is required' }, { status: 400 });
    }

    // In a real app we should verify if the student is enrolled in this course using the token.
    // For now, let's trust the client sends correct course (or if we want to be strict, we parse the token again/check headers).
    // The requirement is transparency, so let's start with just fetching.

    try {
        const query: any = { course: courseParams };
        if (parentId && parentId !== 'null') {
            query.parentId = parentId;
        } else {
            query.parentId = null;
        }
        const folders = await Folder.find(query).sort({ createdAt: -1 });
        return NextResponse.json({ folders });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
