import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Resource from '@/models/Resource';
import Question from '@/models/Question'; // Ensure Question model is registered
import '@/lib/db';

const MONGODB_URI = process.env.MONGODB_URI!;

async function connectDB() {
    if (mongoose.connection.readyState >= 1) return;
    await mongoose.connect(MONGODB_URI);
}

export async function GET(req: NextRequest) {
    await connectDB();

    // Simple registration of Question model to ensure populate works
    // (Actual definition is in models/Question.ts, but mongoose needs it registered)
    // We already imported it.

    const { searchParams } = new URL(req.url);
    const department = searchParams.get('department');
    const year = searchParams.get('year');
    const courseCode = searchParams.get('course_code');

    // Basic Query
    const query: any = {};
    if (department) query.targetDepartments = { $in: [department] };
    if (year) query.targetYear = year;

    // Handle Course Code (can be multiple comma-separated)
    if (courseCode) {
        const codes = courseCode.split(',');
        query.$or = [
            { course_code: { $in: codes } },
            { targetCourse: { $in: codes } }
        ];
    }

    try {
        // Fetch resources and populate questions to get their type
        const resources = await Resource.find(query)
            .sort({ createdAt: -1 })
            .populate({
                path: 'questions',
                model: Question, // Use imported model
                select: 'type' // Only need type for filtering in the list view
            });

        return NextResponse.json(resources);
    } catch (error) {
        console.error('Error fetching resources:', error);
        return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
    }
}
