import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Attendance from '@/models/Attendance';
import User from '@/models/User';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        const email = req.headers.get('X-User-Email');
        if (!email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the actual faculty name from User model
        const user = await User.findOne({ email });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const facultyName = user.name;

        // Find all attendance records where this faculty is the teacher
        const attendanceRecords = await Attendance.find({
            teacherName: { $regex: new RegExp(facultyName, 'i') }
        }).select('course_code department year');

        // Extract unique values
        const coursesSet = new Set<string>();
        const depsSet = new Set<string>();
        const yearsSet = new Set<string>();

        attendanceRecords.forEach((record: any) => {
            if (record.course_code) coursesSet.add(record.course_code);
            if (record.department) depsSet.add(record.department);
            if (record.year) yearsSet.add(record.year);
        });

        return NextResponse.json({
            courses: Array.from(coursesSet).sort(),
            departments: Array.from(depsSet).sort(),
            years: Array.from(yearsSet).sort()
        });

    } catch (error) {
        console.error('Error fetching faculty assignments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
