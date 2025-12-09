import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import OTP from '@/models/OTP';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll } = await req.json();

        if (!roll) {
            return NextResponse.json({ error: 'Roll Number is required' }, { status: 400 });
        }

        const student = await Student.findOne({ roll });
        if (!student) {
            return NextResponse.json({ error: 'Student not found with this Roll Number' }, { status: 404 });
        }

        const emailToSend = student.email;

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await OTP.deleteMany({ email: emailToSend });
        await OTP.create({ email: emailToSend, otp });

        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = process.env.SENDER_EMAIL;

        // Mask email
        const maskedEmail = emailToSend.replace(/(^.{3}).+(@.+)/, '$1****$2');

        if (!apiKey || !senderEmail) {
            console.log(`DEV MODE RESET OTP for ${emailToSend}:`, otp);
            return NextResponse.json({
                message: `OTP sent to ${maskedEmail} (Dev Mode)`,
                maskedEmail
            });
        }

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                sender: { email: senderEmail, name: 'Student Portal Support' },
                to: [{ email: emailToSend, name: student.name }],
                subject: 'Password Reset OTP',
                htmlContent: `<p>Hello ${student.name},</p><p>Your OTP for password reset is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>`,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Brevo Error:', errorData);
            throw new Error('Failed to send email');
        }

        return NextResponse.json({
            message: `OTP sent to ${maskedEmail}`,
            maskedEmail
        });

    } catch (error: any) {
        console.error('Forgot Password Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
