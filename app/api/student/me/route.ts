import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { unlimitedExpiry } from '@/lib/unlimitedAccess';

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
                        phoneNumber: student.phoneNumber,
                        schoolName: student.schoolName || null,
                        board: student.board || null,
                        collegeName: student.collegeName || null
                    });
                }
            }
        } else {
            // Regular Student logic
            const rawId = payload.phoneNumber || payload.userId;
            const searchId = typeof rawId === 'string' ? rawId.trim() : rawId;

            const student = await BatchStudent.findOne({ phoneNumber: searchId });

            if (student) {
                // Unlimited access ends in 3 days or less: one reminder popup per end date
                const until = unlimitedExpiry(student as any);
                const left = until ? until.getTime() - Date.now() : Infinity;
                if (until && student.unlimitedUntil && left <= 3 * 86400000 && student.unlimitedReminderFor !== until.toISOString()) {
                    const endsOn = until.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
                    await Notification.create({
                        title: '♾ Your unlimited access ends soon',
                        message: `Your unlimited access ends on ${endsOn}. Please finish any pending assignments and tests before then: after that they go back to their normal deadlines.`,
                        type: 'popup',
                        oncePerStudent: true,
                        link: '/student/assignments',
                        targetStudents: [{ phoneNumber: student.phoneNumber, studentName: student.name, batchName: (student.courses || [])[0] || '' }],
                        startDate: new Date(),
                        endDate: until,
                    });
                    await BatchStudent.updateOne({ _id: student._id }, { $set: { unlimitedReminderFor: until.toISOString() } });
                }
                return NextResponse.json({
                    _id: student._id,
                    studentName: student.name,
                    courses: student.courses || [],
                    phoneNumber: student.phoneNumber,
                    schoolName: student.schoolName || null,
                    board: student.board || null,
                    collegeName: student.collegeName || null
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
