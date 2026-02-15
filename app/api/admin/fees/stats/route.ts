import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import FeeRecord from '@/models/FeeRecord';

export async function GET() {
    try {
        await dbConnect();

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Total Collection Today
        const todayStats = await FeeRecord.aggregate([
            { $match: { entryDate: { $gte: startOfDay } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Total Collection This Month
        const monthStats = await FeeRecord.aggregate([
            { $match: { entryDate: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        return NextResponse.json({
            today: todayStats[0]?.total || 0,
            month: monthStats[0]?.total || 0,
            // Pending calculation is complex (total active students * fee - collected?), 
            // for now leaving 0 or simple placeholder if user didn't specify logic.
            // User asked: "see which student has pending fees for the current month"
            // We'll handle per-student pending in the frontend Grid.
            // Global pending might be too heavy to calc here instantly without more constraints.
        });

    } catch (error) {
        console.error('Failed to fetch stats', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
