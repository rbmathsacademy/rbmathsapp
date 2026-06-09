import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Survey from '@/models/Survey';
import User from '@/models/User';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await props.params;

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const survey = await Survey.findById(id);
        if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 });

        if (survey.status !== 'draft') {
            return NextResponse.json({ error: 'Survey is already deployed or closed' }, { status: 400 });
        }

        if (!survey.questions || survey.questions.length === 0) {
            return NextResponse.json({ error: 'Survey must have at least one question' }, { status: 400 });
        }

        const body = await request.json();
        const { batches, endDate } = body;

        if (!batches || !Array.isArray(batches) || batches.length === 0) {
            return NextResponse.json({ error: 'At least one batch is required' }, { status: 400 });
        }

        survey.deployment = {
            batches,
            deployedAt: new Date()
        };
        if (endDate) survey.endDate = new Date(endDate);
        survey.status = 'deployed';

        await survey.save();

        return NextResponse.json({
            message: `Survey deployed to ${batches.length} batch(es)`,
            survey
        });
    } catch (error: any) {
        console.error('Error deploying survey:', error);
        return NextResponse.json({ error: 'Failed to deploy survey' }, { status: 500 });
    }
}
