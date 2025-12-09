import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Attendance from '@/models/Attendance';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);

        // AUTH CHECK (since middleware header is unreliable)
        let token = null;
        const cookieStore = req.headers.get('cookie');
        if (cookieStore) {
            const cookies = cookieStore.split(';').reduce((acc: any, cookie) => {
                const [k, v] = cookie.trim().split('=');
                acc[k] = v;
                return acc;
            }, {});
            token = cookies['auth_token'];
        }

        if (!token) {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        // We don't strictly need user ID here but we do strictly need to be logged in
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
        }


        let course = searchParams.get('course');
        // Handle array-like string e.g. "CSE,ECE" -> just take first
        if (course && course.includes(',')) {
            course = course.split(',')[0];
        }

        const department = searchParams.get('department');
        const year = searchParams.get('year');

        console.log('[MOCK TEST] Fetching faculties for:', { course, department, year });

        if (!course || !department || !year) {
            return NextResponse.json({ error: 'Course, department, and year are required' }, { status: 400 });
        }

        // Use the exact same logic as attendance system:
        // Find all attendance records for this dept/year/course
        // and extract unique faculty names
        const attendanceRecords = await Attendance.find({
            department: department,
            year: year,
            course_code: course
        }).select('teacherName');

        console.log(`[MOCK TEST] Attendance records found: ${attendanceRecords.length}`);

        // Extract unique faculty names
        const facultyNames = [...new Set(
            attendanceRecords
                .filter(r => r.teacherName)
                .map(r => r.teacherName)
        )].sort();

        console.log('[MOCK TEST] Found faculties:', facultyNames);

        return NextResponse.json(facultyNames);
    } catch (error) {
        console.error('Fetch Faculties Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
