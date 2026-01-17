import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Question from '@/models/Question';
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

        // Add deployment to each question if not already there
        const results = await Promise.all(questionIds.map(async (qId) => {
            return Question.findOneAndUpdate(
                { _id: qId, "deployments.folderId": { $ne: folderId } }, // Avoid duplicates for same folder
                {
                    $push: {
                        deployments: {
                            courseId,
                            folderId
                        }
                    }
                },
                { new: true }
            );
        }));

        return NextResponse.json({ success: true, count: results.filter(r => r).length });
    } catch (error) {
        console.error("Deploy Error", error);
        return NextResponse.json({ error: 'Failed to deploy questions' }, { status: 500 });
    }
}

// Get Question IDs for a folder (to show what's inside users view)
// Actually we can just search Questions where deployments.folderId == folderId
export async function GET(req: NextRequest) {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
        return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    try {
        const questions = await Question.find({ "deployments.folderId": folderId });
        return NextResponse.json(questions);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }
}
