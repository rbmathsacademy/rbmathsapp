import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Question from '@/models/Question';
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

export async function POST(req: NextRequest) {
    await connectDB();
    try {
        const body = await req.json();
        const { questionIds, courseId, folderId } = body;

        if (!questionIds || !Array.isArray(questionIds) || !courseId || !folderId) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Add questions to the folder structurally avoiding duplicates per folder
        const result = await Folder.updateOne(
            { _id: folderId },
            { $addToSet: { questions: { $each: questionIds } } }
        );

        return NextResponse.json({ success: true, modification: result.modifiedCount > 0 });
    } catch (error) {
        console.error("Deploy Error", error);
        return NextResponse.json({ error: 'Failed to deploy questions' }, { status: 500 });
    }
}

// Get Question IDs for a folder (to show what's inside users view)
export async function GET(req: NextRequest) {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
        return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    try {
        const folder = await Folder.findById(folderId).populate('questions').lean();
        if (!folder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }
        let questions = folder.questions || [];

        // Backward compatibility fallback for admin viewing legacy deployed questions
        if (questions.length === 0) {
            questions = await Question.find({ resourceFolders: folderId }).sort({ createdAt: 1 }).lean();
        }

        return NextResponse.json(questions);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }
}
