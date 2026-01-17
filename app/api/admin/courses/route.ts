import { NextResponse } from 'next/server';
import { getAllCourses } from '@/lib/googleSheet';

export async function GET() {
    try {
        const courses = await getAllCourses();
        return NextResponse.json(courses);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
    }
}
