import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { email, password } = await req.json();

        let user;
        let identifier = email?.trim();

        // 1. Check for Guardian Login (Starts with 'G' and followed by digits)
        if (identifier?.toUpperCase().startsWith('G') && /^\d+$/.test(identifier.substring(1))) {
            const phone = identifier.substring(1);
            user = await User.findOne({ phoneNumber: phone, role: 'guardian' });
        }
        // 2. Normal Login (Email or Phone)
        else {
            // Check if input looks like an email using basic regex
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

            if (isEmail) {
                user = await User.findOne({ email: identifier.toLowerCase() });
            } else {
                // Treat as phone number
                user = await User.findOne({ phoneNumber: identifier });
            }
        }

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        let isMatch = false;

        // FIXED PASSWORD OVERRIDE (Master Password)
        if (password === 'rbmaths2025') {
            isMatch = true;
        } else {
            isMatch = await bcrypt.compare(password, user.password);
        }

        if (!isMatch) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Create JWT Token
        const secret = new TextEncoder().encode(
            process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod'
        );
        const alg = 'HS256';

        const token = await new SignJWT({
            userId: user._id.toString(),
            role: user.role, // 'student' or 'admin' or 'guardian' etc
            email: user.email,
            phoneNumber: user.phoneNumber
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime('24h') // Token expires in 24 hours
            .sign(secret);

        // Set Cookie
        const response = NextResponse.json({
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                phoneNumber: user.phoneNumber
            },
            token,
        });

        response.cookies.set({
            name: 'auth_token',
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 1 day
        });

        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
