import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Question from '@/models/Question';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const facultyName = searchParams.get('facultyName');

        if (!facultyName) {
            return NextResponse.json({ error: 'Faculty name is required' }, { status: 400 });
        }

        // Fetch all unique topics for this faculty
        const questions = await Question.find({ facultyName }).select('topic');
        const topics = [...new Set(questions.map(q => q.topic))].sort();

        return NextResponse.json(topics);
    } catch (error) {
        console.error('Fetch Topics Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
