import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
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
        //    Format: phone@password (e.g., 9876543210@9876543210)
        // ---------------------------------------------------------
        const hasPasswordSeparator = rawInput.includes('@');
        let staffPhone = cleanPhone;
        let staffPassword = '';

        if (hasPasswordSeparator) {
            const atIndex = rawInput.indexOf('@');
            const phonePart = rawInput.substring(0, atIndex).trim();
            staffPassword = rawInput.substring(atIndex + 1).trim();
            staffPhone = phonePart.replace(/\D/g, '');
        }

        const staffUser = await User.findOne({
            phoneNumber: staffPhone,
            role: { $in: ['manager', 'copy_checker', 'admin', 'superadmin'] }
        });

        if (staffUser) {
            // Staff account found — enforce strict password authentication
            if (!hasPasswordSeparator || !staffPassword) {
                return NextResponse.json(
                    { error: 'Staff login requires password. Use format: phone@password' },
                    { status: 401 }
                );
            }

            // Validate password against stored bcrypt hash
            const isPasswordValid = await bcrypt.compare(staffPassword, staffUser.password);
            if (!isPasswordValid) {
                return NextResponse.json(
                    { error: 'Invalid staff password.' },
                    { status: 401 }
                );
            }

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
            else if (staffUser.role === 'copy_checker') redirectUrl = '/admin/questions';

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

        // If input had @ but no staff user found, it might be a typo — don't fall through to student login
        if (hasPasswordSeparator) {
            return NextResponse.json(
                { error: 'Staff account not found. Check your phone number.' },
                { status: 401 }
            );
        }

        // ---------------------------------------------------------
        // 3. FREE BATCH STUDENT LOGIN (loginId = DDMMYYYYPPPPP)
        // ---------------------------------------------------------
        const loginIdStudent = await BatchStudent.findOne({ loginId: rawInput }).lean();

        if (loginIdStudent) {
            const token = await new SignJWT({
                userId: loginIdStudent.phoneNumber,
                phoneNumber: loginIdStudent.phoneNumber,
                studentName: loginIdStudent.name,
                courses: loginIdStudent.courses,
                role: 'student'
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('30d')
                .sign(new TextEncoder().encode(JWT_SECRET));

            const response = NextResponse.json({
                success: true,
                role: 'student',
                user: {
                    name: loginIdStudent.name,
                    role: 'student',
                    phoneNumber: loginIdStudent.phoneNumber
                },
                student: {
                    studentName: loginIdStudent.name,
                    batches: loginIdStudent.courses || []
                },
                redirectUrl: '/student'
            });
            setAuthCookie(response, token);
            return response;
        }

        // ---------------------------------------------------------
        // 4. STUDENT LOGIN (BatchStudent - by phone number)
        // ---------------------------------------------------------
        const student = await BatchStudent.findOne({ phoneNumber: cleanPhone }).lean();

        if (!student) {
            return NextResponse.json({ error: 'Invalid password. Please try again.' }, { status: 401 });
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
