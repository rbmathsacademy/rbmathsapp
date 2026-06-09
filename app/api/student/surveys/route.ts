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

// GET - Fetch pending (unanswered) surveys for this student
export async function GET(req: NextRequest) {
    try {
        const student = await getStudentFromToken(req);
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        // Get most up-to-date student batches from DB
        const cleanPhone = student.phoneNumber.replace(/\D/g, '');
        const dbStudent = await BatchStudent.findOne({ phoneNumber: cleanPhone }).lean() as any;
        const studentCourses = dbStudent?.courses || student.courses || [];

        if (studentCourses.length === 0) {
            return NextResponse.json({ surveys: [] });
        }

        // Find all deployed surveys for student's batches that haven't expired
        const now = new Date();
        const deployedSurveys = await Survey.find({
            status: 'deployed',
            'deployment.batches': { $in: studentCourses },
            excludedStudents: { $nin: [student.phoneNumber, cleanPhone] },
            $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gte: now } }
            ]
        }).sort({ createdAt: 1 }).lean();  // Oldest first

        if (deployedSurveys.length === 0) {
            return NextResponse.json({ surveys: [] });
        }

        // Find which surveys this student has already responded to
        const surveyIds = deployedSurveys.map(s => s._id);
        const existingResponses = await SurveyResponse.find({
            surveyId: { $in: surveyIds },
            studentPhone: { $in: [student.phoneNumber, cleanPhone] }
        }).select('surveyId').lean();

        const respondedIds = new Set(existingResponses.map(r => r.surveyId.toString()));

        // Filter to only unanswered surveys
        const pendingSurveys = deployedSurveys
            .filter(s => !respondedIds.has(s._id.toString()))
            .map(s => ({
                _id: s._id,
                title: s.title,
                description: s.description,
                questions: s.questions.map(q => ({
                    id: q.id,
                    text: q.text,
                    type: q.type,
                    options: q.options,
                    ratingMax: q.ratingMax,
                    ratingLabels: q.ratingLabels,
                    required: q.required
                }))
            }));

        return NextResponse.json({ surveys: pendingSurveys });
    } catch (error: any) {
        console.error('Error fetching pending surveys:', error);
        return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 });
    }
}
