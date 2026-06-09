import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import Survey from '@/models/Survey';
import SurveyResponse from '@/models/SurveyResponse';
import BatchStudent from '@/models/BatchStudent';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getStudentFromToken(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        const phoneNumber = (payload.phoneNumber || payload.userId) as string;
        return { phoneNumber, studentName: payload.studentName as string, courses: payload.courses as string[] || [] };
    } catch {
        return null;
    }
}

// POST - Submit survey response
export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const student = await getStudentFromToken(req);
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const { id: surveyId } = await props.params;
        const body = await req.json();
        const { answers } = body;

        if (!answers || !Array.isArray(answers)) {
            return NextResponse.json({ error: 'Answers are required' }, { status: 400 });
        }

        // Find survey and verify access
        const survey = await Survey.findById(surveyId);
        if (!survey || survey.status !== 'deployed') {
            return NextResponse.json({ error: 'Survey not found or not active' }, { status: 404 });
        }

        // Check end date
        if (survey.endDate && new Date() > new Date(survey.endDate)) {
            return NextResponse.json({ error: 'Survey has expired' }, { status: 400 });
        }

        // Verify student is in a deployed batch
        const cleanPhone = student.phoneNumber.replace(/\D/g, '');
        const dbStudent = await BatchStudent.findOne({ phoneNumber: cleanPhone }).lean() as any;
        const studentCourses = dbStudent?.courses || student.courses || [];
        const deployedBatches = survey.deployment?.batches || [];
        const hasAccess = studentCourses.some((c: string) => deployedBatches.includes(c));
        if (!hasAccess) {
            return NextResponse.json({ error: 'You do not have access to this survey' }, { status: 403 });
        }

        // Check not excluded
        if (survey.excludedStudents.includes(student.phoneNumber) || survey.excludedStudents.includes(cleanPhone)) {
            return NextResponse.json({ error: 'You have been excluded from this survey' }, { status: 403 });
        }

        // Check not already responded
        const existing = await SurveyResponse.findOne({
            surveyId,
            studentPhone: { $in: [student.phoneNumber, cleanPhone] }
        });
        if (existing) {
            return NextResponse.json({ error: 'You have already responded to this survey' }, { status: 400 });
        }

        // Validate required questions
        const requiredQuestionIds = survey.questions.filter(q => q.required).map(q => q.id);
        const answeredIds = new Set(answers.map((a: any) => a.questionId));
        const unanswered = requiredQuestionIds.filter(id => !answeredIds.has(id));
        if (unanswered.length > 0) {
            return NextResponse.json({
                error: `Please answer all required questions (${unanswered.length} remaining)`
            }, { status: 400 });
        }

        // Determine batch name
        const batchName = studentCourses.find((c: string) => deployedBatches.includes(c)) || studentCourses[0] || '';

        // Create response
        const response = new SurveyResponse({
            surveyId,
            studentPhone: cleanPhone,
            studentName: dbStudent?.name || student.studentName || 'Unknown',
            batchName,
            answers,
            submittedAt: new Date()
        });

        await response.save();

        return NextResponse.json({ message: 'Survey submitted successfully' }, { status: 201 });
    } catch (error: any) {
        // Handle duplicate key error
        if (error.code === 11000) {
            return NextResponse.json({ error: 'You have already responded to this survey' }, { status: 400 });
        }
        console.error('Error submitting survey:', error);
        return NextResponse.json({ error: 'Failed to submit survey' }, { status: 500 });
    }
}
