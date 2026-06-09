import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Survey from '@/models/Survey';
import SurveyResponse from '@/models/SurveyResponse';
import User from '@/models/User';

async function authenticate(request: NextRequest) {
    const userEmail = request.headers.get('X-User-Email');
    if (!userEmail) return null;
    const user = await User.findOne({ email: userEmail });
    if (!user || !['admin', 'manager'].includes(user.role)) return null;
    return user;
}

// GET - List all surveys
export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        const user = await authenticate(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const query: any = {};
        if (status) {
            query.status = { $in: status.split(',') };
        }

        const surveys = await Survey.find(query).sort({ createdAt: -1 }).lean();

        // Get response counts for each survey
        const surveyIds = surveys.map(s => s._id);
        const responseCounts = await SurveyResponse.aggregate([
            { $match: { surveyId: { $in: surveyIds } } },
            { $group: { _id: '$surveyId', count: { $sum: 1 } } }
        ]);
        const countMap = new Map(responseCounts.map(r => [r._id.toString(), r.count]));

        const result = surveys.map(s => ({
            ...s,
            responseCount: countMap.get(s._id.toString()) || 0
        }));

        return NextResponse.json({ surveys: result });
    } catch (error: any) {
        console.error('Error fetching surveys:', error);
        return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 });
    }
}

// POST - Create new survey
export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const user = await authenticate(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { title, description, questions, endDate } = body;

        if (!title?.trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: 'At least one question is required' }, { status: 400 });
        }

        const survey = new Survey({
            title: title.trim(),
            description: description?.trim() || '',
            questions,
            endDate: endDate || undefined,
            status: 'draft',
            createdBy: user.email
        });

        await survey.save();
        return NextResponse.json({ survey, message: 'Survey created successfully' }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating survey:', error);
        return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
    }
}

// PUT - Update survey (draft only)
export async function PUT(request: NextRequest) {
    try {
        await dbConnect();
        const user = await authenticate(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });

        const survey = await Survey.findById(id);
        if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 });

        if (survey.status !== 'draft') {
            return NextResponse.json({ error: 'Can only edit draft surveys' }, { status: 400 });
        }

        if (updates.title !== undefined) survey.title = updates.title.trim();
        if (updates.description !== undefined) survey.description = updates.description?.trim() || '';
        if (updates.questions !== undefined) survey.questions = updates.questions;
        if (updates.endDate !== undefined) survey.endDate = updates.endDate || undefined;

        await survey.save();
        return NextResponse.json({ survey, message: 'Survey updated successfully' });
    } catch (error: any) {
        console.error('Error updating survey:', error);
        return NextResponse.json({ error: 'Failed to update survey' }, { status: 500 });
    }
}

// DELETE - Delete survey and all responses
export async function DELETE(request: NextRequest) {
    try {
        await dbConnect();
        const user = await authenticate(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });

        const survey = await Survey.findById(id);
        if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 });

        // Delete all responses first
        await SurveyResponse.deleteMany({ surveyId: id });
        await Survey.findByIdAndDelete(id);

        return NextResponse.json({ message: 'Survey and all responses deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting survey:', error);
        return NextResponse.json({ error: 'Failed to delete survey' }, { status: 500 });
    }
}
