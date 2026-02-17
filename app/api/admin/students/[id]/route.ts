import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

// PUT - Update student details
export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await props.params;
        const body = await req.json();
        const { name, phoneNumber, courses, guardianPhone, guardianName, email } = body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber.replace(/\D/g, '');
        if (courses !== undefined) updateData.courses = courses;
        if (guardianPhone !== undefined) updateData.guardianPhone = guardianPhone?.replace(/\D/g, '') || null;
        if (guardianName !== undefined) updateData.guardianName = guardianName?.trim() || null;
        if (email !== undefined) updateData.email = email?.trim() || null;

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

// DELETE - Hard delete student
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await props.params;

        const student = await BatchStudent.findByIdAndDelete(id);
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Student deleted permanently' });
    } catch (error: any) {
        console.error('Failed to delete student:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete student' }, { status: 500 });
    }
}
