import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SurveyResponse from '@/models/SurveyResponse';
import User from '@/models/User';

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string; phone: string }> }
) {
    try {
        await dbConnect();
        const { id, phone } = await props.params;

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await User.findOne({ email: userEmail });
        if (!user || !['admin', 'manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await SurveyResponse.findOneAndDelete({
            surveyId: id,
            studentPhone: phone
        });

        if (!result) {
            return NextResponse.json({ error: 'Response not found' }, { status: 404 });
        }

        return NextResponse.json({
            message: `Response from ${result.studentName} deleted. The survey popup will reappear for this student.`
        });
    } catch (error: any) {
        console.error('Error deleting survey response:', error);
        return NextResponse.json({ error: 'Failed to delete response' }, { status: 500 });
    }
}
