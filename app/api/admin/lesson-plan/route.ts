import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import LessonPlan from '@/models/LessonPlan';

// GET: Fetch plans for a specific batch
export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const batch = searchParams.get('batch');

        if (!batch) {
            return NextResponse.json({ error: 'Batch is required' }, { status: 400 });
        }

        const lessonPlan = await LessonPlan.findOne({ batch });

        // Sort plans by date descending by default (newest first) or ascending?
        // Usually lesson plans are future-looking, so maybe ascending to show schedule?
        // Let's return as is, frontend can sort.
        // Actually, let's sort descending (newest at top) for admin management usually.
        // But for a "Lesson Plan" / Schedule, ascending (future) makes sense.
        // Let's sort Descending for now so recent entries are at top of grid.

        const plans = lessonPlan ? lessonPlan.plans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

        return NextResponse.json({ success: true, plans });
    } catch (error: any) {
        console.error('Failed to fetch lesson plans', error);
        return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
    }
}

// POST: Save (Upsert) plans for a batch
export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { batch, plans } = body;

        if (!batch) {
            return NextResponse.json({ error: 'Batch is required' }, { status: 400 });
        }

        if (!Array.isArray(plans)) {
            return NextResponse.json({ error: 'Plans must be an array' }, { status: 400 });
        }

        // Validate items if needed, or trust schema validation
        // We will replace the entire 'plans' array or merge?
        // The prompt says "delete any particular row or edit".
        // The easiest way for a grid view is to send the *entire* new state of the grid.
        // So we will replace the plans array for that batch.

        // Normalize dates to 12 PM to avoid timezone shifting
        const normalizedPlans = plans.map(p => {
            const d = new Date(p.date);
            d.setHours(12, 0, 0, 0);
            return { ...p, date: d };
        });

        const updatedLessonPlan = await LessonPlan.findOneAndUpdate(
            { batch },
            {
                batch,
                plans: normalizedPlans // complete replacement
            },
            { new: true, upsert: true, runValidators: true }
        );

        return NextResponse.json({ success: true, count: updatedLessonPlan.plans.length });

    } catch (error: any) {
        console.error('Failed to save lesson plan', error);
        return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 500 });
    }
}
