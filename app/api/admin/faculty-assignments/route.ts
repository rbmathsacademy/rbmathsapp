import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Attendance from '@/models/Attendance';
import User from '@/models/User';

const GLOBAL_ADMIN_KEY = 'globaladmin_25';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        const email = req.headers.get('X-User-Email');
        const adminKey = req.headers.get('X-Global-Admin-Key');

        if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let attendanceRecords;
        if (adminKey === GLOBAL_ADMIN_KEY) {
            attendanceRecords = await Attendance.find({}).select('course_code department year');
        } else {
            // Get the actual faculty name from User model
            const user = await User.findOne({ email });
            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            const facultyName = user.name;

            // Find all attendance records where this faculty is the teacher
            attendanceRecords = await Attendance.find({
                teacherName: { $regex: new RegExp(facultyName, 'i') }
            }).select('course_code department year');
        }

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
