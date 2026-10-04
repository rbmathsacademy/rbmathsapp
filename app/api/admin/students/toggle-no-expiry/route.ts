import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

export async function POST(req: NextRequest) {
    try {
        const adminEmail = req.headers.get('X-User-Email');
        const globalAdminKey = req.headers.get('X-Global-Admin-Key');

        if (!adminEmail && globalAdminKey !== 'globaladmin_25') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const { studentId, noExpiry } = await req.json();

        if (!studentId) {
            return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
        }

        const student = await BatchStudent.findByIdAndUpdate(
            studentId,
            { $set: { noExpiry: Boolean(noExpiry) } },
            { new: true }
        );

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            success: true, 
            message: `Unlimited access has been ${noExpiry ? 'enabled' : 'disabled'} for ${student.name}`,
            noExpiry: student.noExpiry
        });
    } catch (error: any) {
        console.error('Failed to toggle noExpiry:', error);
        return NextResponse.json({ error: 'Failed to update student access' }, { status: 500 });
    }
}
