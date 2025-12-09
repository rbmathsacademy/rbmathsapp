import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import OTP from '@/models/OTP';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll, email, otp, password } = await req.json();

        if (!roll || !email || !otp || !password) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        // Verify OTP
        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
        }

        // Find Student again to be safe
        const student = await Student.findOne({ roll });
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Hash, Update, Verify
        const hashedPassword = await bcrypt.hash(password, 10);

        await Student.findByIdAndUpdate(student._id, {
            password: hashedPassword,
            isVerified: true
        });

        // Cleanup
        await OTP.deleteMany({ email });

        return NextResponse.json({ message: 'Registration successful' });

    } catch (error: any) {
        console.error('Register Complete Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
