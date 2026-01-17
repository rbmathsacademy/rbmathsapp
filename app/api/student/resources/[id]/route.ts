import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Folder from '@/models/Folder';
import Question from '@/models/Question';
import Config from '@/models/Config';
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

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    await connectDB();
    const resourceId = params.id;

    try {
        // Fetch Folder (Resource)
        const folder = await Folder.findById(resourceId);
        if (!folder) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        // Fetch Questions for this Folder
        const questions = await Question.find({ "deployments.folderId": resourceId });

        // Check AI Enabled Status
        const config = await Config.findOne({ key: 'data' });
        const enabledTopics = new Set(config?.aiEnabledTopics || []);

        // Determine if AI is enabled for this resource (e.g. check first question's topic)
        let aiEnabled = false;
        if (questions.length > 0) {
            // Check if any question's topic is enabled? Or checks if majority?
            // Simple logic: if ANY question's topic is in enabledTopics, or if the folder name/course is?
            // Usually topic based.
            const firstTopic = questions[0].topic;
            if (firstTopic && enabledTopics.has(firstTopic)) {
                aiEnabled = true;
            }
        }

        // Construct Resource Object
        const resource = {
            _id: folder._id,
            title: folder.name,
            topic: questions.length > 0 ? questions[0].topic : '', // Infer topic from first question
            targetCourse: folder.course,
            facultyName: 'RB', // Hardcoded or fetched? Folder doesn't have faculty. Assuming RB mostly.
            createdAt: folder.createdAt,
            aiEnabled: aiEnabled
            // hints: {} // Legacy hints map not needed as Questions have hints.
        };

        return NextResponse.json({
            resource: resource,
            questions: questions
        });

    } catch (error) {
        console.error("Error fetching resource:", error);
        return NextResponse.json({ error: 'Failed to fetch resource' }, { status: 500 });
    }
}
