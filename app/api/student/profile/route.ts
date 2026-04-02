import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { payload } = await jwtVerify(token, key);
        const { schoolName, board } = await req.json();

        if (!schoolName?.trim() || !board?.trim()) {
            return NextResponse.json({ error: 'School name and board are required' }, { status: 400 });
        }

        const validBoards = ['CBSE', 'ISC', 'WBCHSE'];
        if (!validBoards.includes(board)) {
            return NextResponse.json({ error: 'Invalid board selection' }, { status: 400 });
        }

        await dbConnect();

        // Find student by phone number (from JWT)
        const phoneNumber = payload.phoneNumber || payload.userId;
        const student = await BatchStudent.findOneAndUpdate(
            { phoneNumber },
            { schoolName: schoolName.trim(), board: board.trim() },
            { new: true }
        );

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            schoolName: student.schoolName,
            board: student.board
        });

    } catch (error) {
        console.error('Student Profile Update Error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
