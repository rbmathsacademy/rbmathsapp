import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';
import DeletedStudent from '@/models/DeletedStudent';

const ARCHIVE_DAYS = 100;

// PUT - Update student details
export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await props.params;
        const body = await req.json();
        const { name, phoneNumber, courses, guardianPhone, guardianName, email, schoolName, board } = body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber.replace(/\D/g, '');
        if (courses !== undefined) updateData.courses = courses;
        if (guardianPhone !== undefined) updateData.guardianPhone = guardianPhone?.replace(/\D/g, '') || null;
        if (guardianName !== undefined) updateData.guardianName = guardianName?.trim() || null;
        if (email !== undefined) updateData.email = email?.trim() || null;
        if (schoolName !== undefined) updateData.schoolName = schoolName?.trim() || null;
        if (board !== undefined) updateData.board = board?.trim() || null;

        // Check for phone number conflict if updating phone
        if (updateData.phoneNumber) {
            const conflict = await BatchStudent.findOne({
                phoneNumber: updateData.phoneNumber,
                _id: { $ne: id }
            });
            if (conflict) {
                return NextResponse.json({ error: 'Another student already has this phone number' }, { status: 409 });
            }
        }

        const student = await BatchStudent.findByIdAndUpdate(id, updateData, { new: true });
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, student });
    } catch (error: any) {
        console.error('Failed to update student:', error);
        return NextResponse.json({ error: error.message || 'Failed to update student' }, { status: 500 });
    }
}

// DELETE - Soft delete: archive student + guardian into DeletedStudent collection
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await props.params;

        // 1. Find the student
        const student = await BatchStudent.findById(id).lean();
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. Find the guardian user (if exists)
        const guardian = await User.findOne({ phoneNumber: (student as any).phoneNumber, role: 'guardian' }).lean();

        // 3. Archive into DeletedStudent
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ARCHIVE_DAYS * 24 * 60 * 60 * 1000);

        await DeletedStudent.create({
            originalId: (student as any)._id,
            studentData: student,
            guardianData: guardian || null,
            deletedAt: now,
            expiresAt
        });

        // 4. Delete originals
        await BatchStudent.findByIdAndDelete(id);
        if (guardian) {
            await User.findByIdAndDelete((guardian as any)._id);
        }

        return NextResponse.json({ success: true, message: 'Student moved to recycle bin (auto-deleted after 100 days)' });
    } catch (error: any) {
        console.error('Failed to soft-delete student:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete student' }, { status: 500 });
    }
}
