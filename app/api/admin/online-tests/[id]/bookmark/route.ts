import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import User from '@/models/User';

/** POST { attemptId, bookmarked } - star / unstar a submission in the monitor's Done list. */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id: testId } = await props.params;
        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await User.findOne({ email: userEmail }).select('role').lean() as any;
        if (!user || !['admin', 'manager', 'copy_checker'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { attemptId, bookmarked } = await request.json();
        if (!mongoose.isValidObjectId(attemptId) || !mongoose.isValidObjectId(testId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }
        const r = await StudentTestAttempt.updateOne({ _id: attemptId, testId }, { $set: { bookmarked: !!bookmarked } });
        if (r.matchedCount === 0) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        return NextResponse.json({ success: true, bookmarked: !!bookmarked });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
    }
}
