import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import FeeRecord from '@/models/FeeRecord';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();

        // 1. Validate Token (Async cookies for Next.js 15+)
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { payload } = await jwtVerify(token, key);

        // 2. Resolve Student ID (BatchStudent._id)
        let targetStudentId = null;

        if (payload.role === 'admin') {
            let adminName = (payload.studentName || payload.name) as string;

            // FALLBACK: If name not in token, fetch from User DB
            if (!adminName) {
                const admin = await User.findById(payload.userId);
                if (admin) adminName = admin.name;
            }

            if (adminName) {
                const cleanName = adminName.replace(/^(Dr|Er|Mr|Mrs|Ms)\.?\s+/i, '').trim();
                // console.log(`[StudentFees] Resolving Admin "${adminName}" (Clean: "${cleanName}")`);

                // RELAXED REGEX matching logic
                const student = await BatchStudent.findOne({
                    name: { $regex: new RegExp(cleanName, 'i') }
                }).select('_id');

                if (student) {
                    targetStudentId = student._id;
                }
            }
        } else {
            const rawId = (payload.phoneNumber || payload.userId) as string;
            const searchId = rawId ? rawId.trim() : rawId;
            const student = await BatchStudent.findOne({ phoneNumber: searchId }).select('_id');
            if (student) {
                targetStudentId = student._id;
            }
        }

        if (!targetStudentId) {
            return NextResponse.json({ records: [] });
        }

        // 3. Fetch Fee Records
        const records = await FeeRecord.find({
            student: targetStudentId
        }).sort({ feesMonth: 1 });

        return NextResponse.json({ records });

    } catch (error) {
        console.error('Error fetching student fees:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
