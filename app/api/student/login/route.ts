import { NextRequest, NextResponse } from 'next/server';
import { getStudentCourses } from '@/lib/googleSheet';
import { SignJWT } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

// Helper to upsert student
async function getStudent(phoneNumber: string, name: string, courses: string[]) {
    await dbConnect();
    return BatchStudent.findOneAndUpdate(
        { phoneNumber },
        {
            phoneNumber,
            name,
            courses, // Update courses from sheet
            $setOnInsert: { bookmarks: [] }
        },
        { upsert: true, new: true }
    );
}

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export async function POST(req: NextRequest) {
    try {
        const { phoneNumber } = await req.json();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const studentData = await getStudentCourses(phoneNumber);

        if (!studentData) {
            return NextResponse.json({ error: 'Phone number not found in records' }, { status: 401 });
        }

        // Ensure Student exists in MongoDB
        await getStudent(phoneNumber, studentData.studentName, studentData.batches);

        // Create JWT
        const token = await new SignJWT({
            userId: phoneNumber, // Map phoneNumber to userId for middleware compatibility
            phoneNumber,
            studentName: studentData.studentName,
            courses: studentData.batches,
            role: 'student'
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('24h') // 24 hour session
            .sign(new TextEncoder().encode(JWT_SECRET));

        const response = NextResponse.json({ success: true, student: studentData });

        // Use auth_token to match middleware expectation
        response.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 // 24 hours
        });

        return response;

    } catch (error: any) {
        console.error("Login Error Details:", error.message || error);
        return NextResponse.json({ error: `Login failed: ${error.message}` }, { status: 500 });
    }
}
