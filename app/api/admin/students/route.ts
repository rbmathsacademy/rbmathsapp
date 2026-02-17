import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// GET - List all students with optional batch filter and search
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const batch = searchParams.get('batch');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const query: any = {};

        if (batch) {
            const escapedBatch = batch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.courses = { $elemMatch: { $regex: new RegExp(`^${escapedBatch}$`, 'i') } };
        }

        if (search) {
            const fuzzySearch = search.trim().split(/\s+/).join('.*');
            const searchRegex = { $regex: fuzzySearch, $options: 'i' };
            query.$or = [
                { name: searchRegex },
                { phoneNumber: searchRegex }
            ];
        }

        const [students, total] = await Promise.all([
            BatchStudent.find(query)
                .select('name phoneNumber courses guardianPhone guardianName email createdAt')
                .lean()
                .sort({ name: 1 })
                .skip((page - 1) * limit)
                .limit(limit),
            BatchStudent.countDocuments(query)
        ]);

        return NextResponse.json({
            students,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error: any) {
        console.error('Failed to fetch students:', error);
        return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }
}

// POST - Add a new student
export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { name, phoneNumber, courses, guardianPhone, guardianName, email } = body;

        if (!name || !phoneNumber) {
            return NextResponse.json({ error: 'Name and phone number are required' }, { status: 400 });
        }

        // Clean phone number
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        if (!cleanPhone) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
        }

        // Check for duplicate
        const existing = await BatchStudent.findOne({ phoneNumber: cleanPhone });
        if (existing) {
            return NextResponse.json({ error: 'A student with this phone number already exists' }, { status: 409 });
        }

        const student = await BatchStudent.create({
            name: name.trim(),
            phoneNumber: cleanPhone,
            courses: courses || [],
            guardianPhone: guardianPhone?.replace(/\D/g, '') || undefined,
            guardianName: guardianName?.trim() || undefined,
            email: email?.trim() || undefined,
            bookmarks: []
        });

        // Create Guardian User
        try {
            // Check if Guardian User already exists (e.g. sibling case?)
            // For now, simpler implementation: One guardian login per student phone number
            // Identifier will be G + Student Phone
            // Actually, we are using the STUDENT'S phone number as the unique key for the guardian login
            // So multiple students with same phone number is not allowed anyway.

            const hashedPassword = await bcrypt.hash(cleanPhone, 10);

            await User.create({
                email: `guardian.${cleanPhone}@portal.local`, // Dummy email
                phoneNumber: cleanPhone,
                password: hashedPassword,
                role: 'guardian',
                name: `Guardian of ${name}`,
            });

        } catch (err: any) {
            console.error('Failed to create Guardian User:', err);
            // Don't fail the whole request, but maybe log it
            // If duplicate key error (11000), it means guardian user already exists, which is fine
            if (err.code !== 11000) {
                console.error('Critical: Failed to create guardian user for', cleanPhone);
            }
        }

        return NextResponse.json({ success: true, student }, { status: 201 });
    } catch (error: any) {
        console.error('Failed to add student:', error);
        if (error.code === 11000) {
            return NextResponse.json({ error: 'A student with this phone number already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message || 'Failed to add student' }, { status: 500 });
    }
}
