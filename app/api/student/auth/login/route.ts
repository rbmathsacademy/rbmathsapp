import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll, password } = await req.json();

        if (!roll || !password) {
            return NextResponse.json({ error: 'Roll number and password are required' }, { status: 400 });
        }

        const student = await Student.findOne({ roll });

        if (!student) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        if (!student.isVerified) {
            return NextResponse.json(
                { error: 'Account not verified. Please register first.' },
                { status: 403 }
            );
        }

        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // AGGREGATION: Find ALL records for this student (same roll) to get all enrolled courses
        const allStudentDocs = await Student.find({ roll: student.roll });
        const allCourseCodes = allStudentDocs.map(doc => doc.course_code).filter(Boolean);

        return NextResponse.json({
            user: {
                _id: student._id, // Will use primary doc ID, but APIs should query by Roll for multi-course support
                roll: student.roll,
                name: student.name,
                email: student.email,
                department: student.department,
                year: student.year,
                course_code: allCourseCodes, // Return ARRAY of strings for frontend compatibility
                role: 'student',
            },
        });
    } catch (error) {
        console.error('Student Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
