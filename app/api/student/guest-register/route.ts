import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

const FREE_BATCH = 'Class XI (Free batch) 2026-27';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const { fullName, schoolName, board, className, phoneNumber, dob } = await req.json();

        // --- Validation ---
        if (!fullName || !fullName.trim()) {
            return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
        }
        if (!schoolName || !schoolName.trim()) {
            return NextResponse.json({ error: 'School name is required.' }, { status: 400 });
        }
        if (!board) {
            return NextResponse.json({ error: 'Board is required.' }, { status: 400 });
        }
        if (!className) {
            return NextResponse.json({ error: 'Class is required.' }, { status: 400 });
        }

        // Phone: strictly 10 digits
        const cleanPhone = (phoneNumber || '').replace(/\D/g, '');
        if (cleanPhone.length !== 10) {
            return NextResponse.json({ error: 'Phone number must be exactly 10 digits.' }, { status: 400 });
        }

        // DOB: strictly 8 digits (DDMMYYYY)
        const cleanDob = (dob || '').replace(/\D/g, '');
        if (cleanDob.length !== 8) {
            return NextResponse.json({ error: 'Date of Birth must be exactly 8 digits (DDMMYYYY).' }, { status: 400 });
        }

        // --- Check for duplicate phone number ---
        const existingStudent = await BatchStudent.findOne({ phoneNumber: cleanPhone });
        if (existingStudent) {
            return NextResponse.json(
                { error: 'Your phone number is already registered. Please login with your password.' },
                { status: 409 }
            );
        }

        // --- Generate loginId: DDMMYYYYPPPPP (DOB + last 5 digits of phone) ---
        const loginId = cleanDob + cleanPhone.slice(-5);

        // Check for unlikely loginId collision
        const existingLoginId = await BatchStudent.findOne({ loginId });
        if (existingLoginId) {
            return NextResponse.json(
                { error: 'A login ID conflict occurred. Please contact the admin for assistance.' },
                { status: 409 }
            );
        }

        // --- Map board value ---
        const boardMap: Record<string, string> = {
            'ISC': 'ISC',
            'CBSE': 'CBSE',
            'WB': 'WBCHSE',
            'Others': 'Others'
        };
        const mappedBoard = boardMap[board] || 'Others';

        // --- Create BatchStudent record ---
        const newStudent = await BatchStudent.create({
            phoneNumber: cleanPhone,
            name: fullName.trim(),
            courses: [FREE_BATCH],
            schoolName: schoolName.trim(),
            board: mappedBoard,
            loginId: loginId,
            dob: cleanDob,
            guestClass: className
        });

        return NextResponse.json({
            success: true,
            loginId: loginId,
            studentName: newStudent.name,
            message: 'Registration successful!'
        });

    } catch (error: any) {
        console.error('Guest Registration Error:', error.message || error);
        return NextResponse.json(
            { error: `Registration failed: ${error.message}` },
            { status: 500 }
        );
    }
}
