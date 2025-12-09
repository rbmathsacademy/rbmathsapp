import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';

export async function GET() {
    try {
        await connectDB();
        const students = await Student.find({}).sort({ createdAt: -1 });
        return NextResponse.json(students);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
