import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import BatchStudent from '@/models/BatchStudent';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Verify student token
        const token = req.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { payload } = await jwtVerify(token, key);

        await dbConnect();
        const assignment = await Assignment.findById(id).lean() as any;
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        if (assignment.type !== 'PDF') {
            return NextResponse.json({ error: 'Not a PDF assignment' }, { status: 400 });
        }

        // Handle board-wise assignments
        if (assignment.boardWise) {
            const phoneNumber = (payload as any).phoneNumber || (payload as any).userId;
            const student = await BatchStudent.findOne({ phoneNumber }).lean() as any;
            if (!student?.board) {
                return NextResponse.json({ error: 'Board not set for student' }, { status: 400 });
            }
            const bc = assignment.boardContent;
            const boardUrl = bc?.get?.(student.board) || bc?.[student.board] || null;
            if (!boardUrl) {
                return NextResponse.json({ error: 'No PDF available for your board' }, { status: 404 });
            }
            return NextResponse.json({ content: boardUrl });
        }

        return NextResponse.json({ content: assignment.content });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
    }
}
