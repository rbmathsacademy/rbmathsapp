import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { payload } = await jwtVerify(token, key);

        let studentName = payload.studentName as string;
        let courses = payload.courses as string[] || [];
        const phoneNumber = payload.phoneNumber || payload.userId;

        await dbConnect();

        if (payload.role === 'admin') {
            // Admin logic
            // 1. Get Admin Name from User DB if missing in token
            if (!studentName) {
                const admin = await User.findById(payload.userId);
                if (admin) {
                    studentName = admin.name;
                }
            }

            // 2. Try to find matching student record for Admin (for testing purposes)
            if (studentName) {
                const cleanName = studentName.replace(/^(Dr|Er|Mr|Mrs|Ms)\.?\s+/i, '').trim();

                // RELAXED REGEX: No anchors ^ or $
                const student = await BatchStudent.findOne({
                    name: { $regex: new RegExp(cleanName, 'i') }
                });

                if (student) {
                    return NextResponse.json({
                        _id: student._id,
                        studentName: student.name,
                        courses: student.courses || [],
                        phoneNumber: student.phoneNumber
                    });
                }
            }
        } else {
            // Regular Student logic
            const rawId = payload.phoneNumber || payload.userId;
            const searchId = typeof rawId === 'string' ? rawId.trim() : rawId;

            const student = await BatchStudent.findOne({ phoneNumber: searchId });

            if (student) {
                return NextResponse.json({
                    _id: student._id,
                    studentName: student.name,
                    courses: student.courses || [],
                    phoneNumber: student.phoneNumber
                });
            }
        }

        // Final fallback (Guest/New User/No Link)
        return NextResponse.json({
            _id: 'GUEST',
            studentName: studentName || 'Guest',
            courses: courses,
            phoneNumber: phoneNumber
        });

    } catch (error) {
        console.error("Student Me API Error:", error);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}
