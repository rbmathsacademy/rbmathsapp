import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();

        // Get all unique course names from BatchStudent collection
        const courses = await BatchStudent.distinct('courses');
        const sortedCourses = courses.filter(Boolean).sort();

        return NextResponse.json(sortedCourses);
    } catch (error: any) {
        console.error('Error fetching courses:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
