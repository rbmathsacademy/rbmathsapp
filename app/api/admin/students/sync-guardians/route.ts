import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        await dbConnect();

        const students = await BatchStudent.find({}).select('name phoneNumber');
        let createdCount = 0;
        let errors = 0;

        for (const student of students) {
            try {
                if (!student.phoneNumber) continue;

                // 1. Create Login User if not exists
                const userExists = await User.findOne({
                    phoneNumber: student.phoneNumber,
                    role: 'guardian'
                });

                if (!userExists) {
                    const hashedPassword = await bcrypt.hash(student.phoneNumber, 10);
                    await User.create({
                        email: `guardian.${student.phoneNumber}@portal.local`,
                        phoneNumber: student.phoneNumber,
                        password: hashedPassword,
                        role: 'guardian',
                        name: `Guardian of ${student.name}`,
                    });
                    createdCount++;
                }

                // 2. Update Student Record to show Guardian Info in list
                // We set the guardianPhone to the student's phone (since that's the login identifier used)
                // and the name to the generated name.
                await BatchStudent.findByIdAndUpdate(student._id, {
                    guardianName: `Guardian of ${student.name}`,
                    guardianPhone: student.phoneNumber
                });

            } catch (err) {
                console.error(`Failed to sync guardian for ${student.phoneNumber}:`, err);
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Sync complete. Created ${createdCount} accounts. Student list updated.`,
            stats: { total: students.length, created: createdCount, errors }
        });

    } catch (error: any) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
