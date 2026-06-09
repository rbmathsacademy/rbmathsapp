import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Survey from '@/models/Survey';
import User from '@/models/User';

// POST - Exclude a student from this survey
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

        const body = await request.json();
        const { phone, phones } = body;
        if (!phone && (!phones || !phones.length)) return NextResponse.json({ error: 'Phone number(s) required' }, { status: 400 });

        const survey = await Survey.findById(id);
        if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 });

        if (phones && Array.isArray(phones)) {
            phones.forEach(p => {
                if (!survey.excludedStudents.includes(p)) {
                    survey.excludedStudents.push(p);
                }
            });
        } else if (phone && !survey.excludedStudents.includes(phone)) {
            survey.excludedStudents.push(phone);
        }
        await survey.save();

        return NextResponse.json({ message: `Students excluded from survey` });
    } catch (error: any) {
        console.error('Error excluding student:', error);
        return NextResponse.json({ error: 'Failed to exclude student' }, { status: 500 });
    }
}

// DELETE - Re-include a previously excluded student
export async function DELETE(
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

        const body = await request.json();
        const { phone } = body;
        if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });

        const survey = await Survey.findById(id);
        if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 });

        survey.excludedStudents = survey.excludedStudents.filter(p => p !== phone);
        await survey.save();

        return NextResponse.json({ message: `Student ${phone} re-included in survey` });
    } catch (error: any) {
        console.error('Error re-including student:', error);
        return NextResponse.json({ error: 'Failed to re-include student' }, { status: 500 });
    }
}
