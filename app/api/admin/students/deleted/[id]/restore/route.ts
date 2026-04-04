import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';
import DeletedStudent from '@/models/DeletedStudent';
import bcrypt from 'bcryptjs';

// POST - Restore a soft-deleted student
export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await props.params;

        // 1. Find the archive record
        const archived = await DeletedStudent.findById(id);
        if (!archived) {
            return NextResponse.json({ error: 'Archived student not found' }, { status: 404 });
        }

        const studentData = archived.studentData;
        const guardianData = archived.guardianData;

        // 2. Check if a student with the same phone already exists (re-added manually)
        const existingStudent = await BatchStudent.findOne({ phoneNumber: studentData.phoneNumber });
        if (existingStudent) {
            return NextResponse.json({ 
                error: `A student with phone ${studentData.phoneNumber} already exists in the active database. Cannot restore duplicate.` 
            }, { status: 409 });
        }

        // 3. Re-insert the BatchStudent with the EXACT original _id
        //    We use the raw MongoDB driver to preserve the _id
        const { _id, __v, ...restStudentData } = studentData;
        await BatchStudent.create({
            _id: archived.originalId,
            ...restStudentData,
            updatedAt: new Date()
        });

        // 4. Restore the guardian user
        if (guardianData) {
            const existingGuardian = await User.findOne({ phoneNumber: studentData.phoneNumber });
            if (!existingGuardian) {
                const { _id: gId, __v: gV, ...restGuardianData } = guardianData;
                await User.create({
                    ...restGuardianData
                });
            }
        } else {
            // No guardian was archived — create a fresh one
            const existingGuardian = await User.findOne({ phoneNumber: studentData.phoneNumber });
            if (!existingGuardian) {
                const hashedPassword = await bcrypt.hash(studentData.phoneNumber, 10);
                await User.create({
                    email: `guardian.${studentData.phoneNumber}@portal.local`,
                    phoneNumber: studentData.phoneNumber,
                    password: hashedPassword,
                    role: 'guardian',
                    name: `Guardian of ${studentData.name}`
                });
            }
        }

        // 5. Remove the archive record
        await DeletedStudent.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: `${studentData.name} has been restored successfully` });
    } catch (error: any) {
        console.error('Failed to restore student:', error);
        return NextResponse.json({ error: error.message || 'Failed to restore student' }, { status: 500 });
    }
}
