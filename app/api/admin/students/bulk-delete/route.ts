import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { studentIds } = body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: 'studentIds array is required' }, { status: 400 });
        }

        const result = await BatchStudent.deleteMany({ _id: { $in: studentIds } });

        return NextResponse.json({
            success: true,
            message: `Deleted ${result.deletedCount} student(s)`,
            deletedCount: result.deletedCount
        });
    } catch (error: any) {
        console.error('Bulk delete failed:', error);
        return NextResponse.json({ error: error.message || 'Bulk delete failed' }, { status: 500 });
    }
}
