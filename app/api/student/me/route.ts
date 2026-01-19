import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';

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

        // If name is missing (e.g. Admin token), fetch from DB
        if (!studentName) {
            await dbConnect();
            if (payload.role === 'admin') {
                const admin = await User.findById(payload.userId);
                if (admin) {
                    studentName = admin.name;
                }
            } else {
                // Try finding student by phone/userId
                const student = await BatchStudent.findOne({ phoneNumber: payload.phoneNumber || payload.userId });
                if (student) {
                    studentName = student.name;
                    courses = student.courses;
                }
            }
        }

        // Final fallback
        studentName = studentName || payload.name as string || payload.email as string || 'Guest';

        return NextResponse.json({
            studentName,
            courses,
            phoneNumber
        });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}
