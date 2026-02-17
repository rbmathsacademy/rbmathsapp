import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const { phoneNumber } = await req.json();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const rawInput = phoneNumber.trim();
        const cleanPhone = rawInput.replace(/\D/g, '');

        // ---------------------------------------------------------
        // 1. GUARDIAN LOGIN (Starts with 'G' or 'g')
        // ---------------------------------------------------------
        if (rawInput.toUpperCase().startsWith('G')) {
            const guardianUser = await User.findOne({
                phoneNumber: cleanPhone,
                role: 'guardian'
            });

            if (!guardianUser) {
                return NextResponse.json({ error: 'Guardian account not found.' }, { status: 401 });
            }

            const token = await new SignJWT({
                userId: guardianUser._id.toString(),
                phoneNumber: guardianUser.phoneNumber,
                role: 'guardian',
                email: guardianUser.email
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('30d')
                .sign(new TextEncoder().encode(JWT_SECRET));

            const response = NextResponse.json({
                success: true,
                role: 'guardian',
                user: {
                    name: guardianUser.name,
                    role: 'guardian',
                    phoneNumber: guardianUser.phoneNumber
                },
                redirectUrl: '/student'
            });
            setAuthCookie(response, token);
            return response;
        }

        // ---------------------------------------------------------
        // 2. STAFF LOGIN (Manager / Copy Checker / Admin)
        // ---------------------------------------------------------
        const staffUser = await User.findOne({
            phoneNumber: cleanPhone,
            role: { $in: ['manager', 'copy_checker', 'admin', 'superadmin'] }
        });

        if (staffUser) {
            const token = await new SignJWT({
                userId: staffUser._id.toString(),
                phoneNumber: staffUser.phoneNumber,
                role: staffUser.role,
                email: staffUser.email
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('30d')
                .sign(new TextEncoder().encode(JWT_SECRET));

            // Redirect based on role
            let redirectUrl = '/admin/dashboard';
            if (staffUser.role === 'manager') redirectUrl = '/admin/fees';
            else if (staffUser.role === 'copy_checker') redirectUrl = '/admin/assignments';

            // CRITICAL: Return role and user details so frontend can enforce RBAC
            const response = NextResponse.json({
                success: true,
                role: staffUser.role,
                user: {
                    name: staffUser.name,
                    role: staffUser.role,
                    phoneNumber: staffUser.phoneNumber
                },
                redirectUrl: redirectUrl
            });
            setAuthCookie(response, token);
            return response;
        }

        // ---------------------------------------------------------
        // 3. STUDENT LOGIN (BatchStudent)
        // ---------------------------------------------------------
        const student = await BatchStudent.findOne({ phoneNumber: cleanPhone }).lean();

        if (!student) {
            return NextResponse.json({ error: 'Number not found in student or staff records.' }, { status: 401 });
        }

        const token = await new SignJWT({
            userId: cleanPhone,
            phoneNumber: cleanPhone,
            studentName: student.name,
            courses: student.courses,
            role: 'student'
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('30d')
            .sign(new TextEncoder().encode(JWT_SECRET));

        const response = NextResponse.json({
            success: true,
            role: 'student',
            user: {
                name: student.name,
                role: 'student',
                phoneNumber: student.phoneNumber
            },
            student: {
                studentName: student.name,
                batches: student.courses || []
            },
            redirectUrl: '/student'
        });
        setAuthCookie(response, token);
        return response;

    } catch (error: any) {
        console.error("Login Error Details:", error.message || error);
        return NextResponse.json({ error: `Login failed: ${error.message}` }, { status: 500 });
    }
}

function setAuthCookie(response: NextResponse, token: string) {
    response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        expires: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000)
    });
}
