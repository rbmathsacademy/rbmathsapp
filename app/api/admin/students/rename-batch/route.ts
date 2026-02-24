import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import FeeRecord from '@/models/FeeRecord';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { studentIds, oldBatch, newBatch } = body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: 'studentIds array is required' }, { status: 400 });
        }
        if (!oldBatch || !newBatch) {
            return NextResponse.json({ error: 'oldBatch and newBatch are required' }, { status: 400 });
        }
        if (oldBatch.trim() === newBatch.trim()) {
            return NextResponse.json({ error: 'Old and new batch names are the same' }, { status: 400 });
        }

        const trimmedNew = newBatch.trim();
        const trimmedOld = oldBatch.trim();

        // 1. Update BatchStudent.courses[] — replace oldBatch with newBatch for selected students
        //    Uses MongoDB positional operator to find and replace the exact element
        const studentUpdateResult = await BatchStudent.updateMany(
            {
                _id: { $in: studentIds },
                courses: trimmedOld
            },
            {
                $set: { 'courses.$': trimmedNew }
            }
        );

        // 2. Update FeeRecord.batch — change all fee records for these students from oldBatch to newBatch
        const feeUpdateResult = await FeeRecord.updateMany(
            {
                student: { $in: studentIds },
                batch: trimmedOld
            },
            {
                $set: { batch: trimmedNew }
            }
        );

        return NextResponse.json({
            success: true,
            message: `Renamed batch for ${studentUpdateResult.modifiedCount} student(s). Updated ${feeUpdateResult.modifiedCount} fee record(s).`,
            studentsUpdated: studentUpdateResult.modifiedCount,
            feeRecordsUpdated: feeUpdateResult.modifiedCount
        });
    } catch (error: any) {
        console.error('Rename batch failed:', error);
        return NextResponse.json({ error: error.message || 'Rename batch failed' }, { status: 500 });
    }
}
