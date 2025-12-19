import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import { jwtVerify } from 'jose';

export async function GET(req: Request) {
    try {
        await connectDB();

        // Manual Token Verification (since middleware passes x-user-id, but we want to be sure)
        // Actually middleware already validates and sets x-user-id.
        const studentId = req.headers.get('x-user-id');

        if (!studentId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // AGGREGATION: Find ALL records for this student (same roll) to get all enrolled courses
        const allStudentDocs = await Student.find({ roll: student.roll });

        // Check if ALL accounts are disabled
        const allDisabled = allStudentDocs.every(doc => doc.loginDisabled);
        if (allDisabled) {
            return NextResponse.json(
                { error: 'Your account has been disabled. Contact admin.' },
                { status: 403 }
            );
        }

        // Filter only ACTIVE courses
        // Exclude 'DISABLED_' courses and loginDisabled=true
        const activeStudentDocs = allStudentDocs.filter(doc => !doc.loginDisabled);
        const allCourseCodes = activeStudentDocs
            .map(doc => doc.course_code)
            .filter(code => code && !code.startsWith('DISABLED_'));

        return NextResponse.json({
            _id: student._id,
            roll: student.roll,
            name: student.name,
            email: student.email,
            department: student.department,
            year: student.year,
            course_code: allCourseCodes, // Return array of active courses
            role: 'student',
        });

    } catch (error) {
        console.error('Fetch Profile Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
