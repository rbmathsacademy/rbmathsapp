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
        const { studentId, noExpiry, until } = await req.json();

        if (!studentId) {
            return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
        }

        let untilDate: Date | null = null;
        if (noExpiry) {
            untilDate = until ? new Date(until) : null;
            if (!untilDate || isNaN(untilDate.getTime()) || untilDate.getTime() <= Date.now()) {
                return NextResponse.json({ error: 'Choose an end date in the future for the unlimited access' }, { status: 400 });
            }
        }
        const student = await BatchStudent.findByIdAndUpdate(
            studentId,
            { $set: { noExpiry: Boolean(noExpiry), unlimitedUntil: untilDate, unlimitedReminderFor: '' } },
            { new: true }
        );

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            success: true, 
            message: noExpiry
                ? `Unlimited access enabled for ${student.name} until ${untilDate!.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`
                : `Unlimited access has been disabled for ${student.name}`,
            noExpiry: student.noExpiry,
            unlimitedUntil: student.unlimitedUntil
        });
    } catch (error: any) {
        console.error('Failed to toggle noExpiry:', error);
        return NextResponse.json({ error: 'Failed to update student access' }, { status: 500 });
    }
}
