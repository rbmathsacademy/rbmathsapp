
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids)) {
            return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
        }

        const questions = await Question.find({ _id: { $in: ids } }).lean();

        // Security: Remove correct answer/hint/explanation if you don't want eager students to see it via network tab inspection.
        // Usually fine for assignments unless it's a test. Assuming assignments meant to be solved.
        // Let's strip answers just in case.
        const sanitized = questions.map(q => {
            const { answer, hint, explanation, ...rest } = q;
            return rest;
        });

        return NextResponse.json({ questions: sanitized });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
