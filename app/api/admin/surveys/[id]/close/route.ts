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

        if (survey.status !== 'deployed') {
            return NextResponse.json({ error: 'Only deployed surveys can be closed' }, { status: 400 });
        }

        survey.status = 'closed';
        await survey.save();

        return NextResponse.json({ message: 'Survey closed successfully', survey });
    } catch (error: any) {
        console.error('Error closing survey:', error);
        return NextResponse.json({ error: 'Failed to close survey' }, { status: 500 });
    }
}
