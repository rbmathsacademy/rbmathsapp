import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Survey from '@/models/Survey';
import SurveyResponse from '@/models/SurveyResponse';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';

export async function GET(
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

        const survey = await Survey.findById(id).lean();
        if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 });

        const { searchParams } = new URL(request.url);
        const searchTerm = searchParams.get('search') || '';
        const batchFilter = searchParams.get('batch') || '';

        // Get all responses
        const responseQuery: any = { surveyId: id };
        const responses = await SurveyResponse.find(responseQuery).sort({ submittedAt: -1 }).lean();

        // Apply filters on responses
        let filteredResponses = responses;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredResponses = filteredResponses.filter(r =>
                r.studentName.toLowerCase().includes(term) ||
                r.studentPhone.includes(term)
            );
        }
        if (batchFilter) {
            filteredResponses = filteredResponses.filter(r => r.batchName === batchFilter);
        }

        // Calculate total students in deployed batches (excluding excluded students)
        const deployedBatches = survey.deployment?.batches || [];
        const excludedSet = new Set(survey.excludedStudents || []);
        let totalStudents = 0;
        if (deployedBatches.length > 0) {
            const students = await BatchStudent.find({ courses: { $in: deployedBatches } }).select('phoneNumber').lean();
            totalStudents = students.filter(s => !excludedSet.has((s as any).phoneNumber)).length;
        }

        // Build per-question analytics
        const questionAnalytics = survey.questions.map((q: any) => {
            const qResponses = responses
                .map(r => r.answers.find((a: any) => a.questionId === q.id))
                .filter(Boolean);

            if (q.type === 'mcq') {
                // Count votes per option
                const optionCounts = (q.options || []).map((_: string, idx: number) =>
                    qResponses.filter(a => a!.answer === idx).length
                );
                return {
                    questionId: q.id,
                    text: q.text,
                    type: q.type,
                    options: q.options,
                    optionCounts,
                    totalResponses: qResponses.length
                };
            } else if (q.type === 'checkbox') {
                // Count votes per option (multi-select)
                const optionCounts = (q.options || []).map((_: string, idx: number) =>
                    qResponses.filter(a => Array.isArray(a!.answer) && (a!.answer as number[]).includes(idx)).length
                );
                return {
                    questionId: q.id,
                    text: q.text,
                    type: q.type,
                    options: q.options,
                    optionCounts,
                    totalResponses: qResponses.length
                };
            } else if (q.type === 'rating') {
                // Calculate average and distribution
                const ratings = qResponses.map(a => Number(a!.answer)).filter(n => !isNaN(n));
                const ratingMax = q.ratingMax || 5;
                const distribution: number[] = Array(ratingMax).fill(0);
                ratings.forEach(r => {
                    if (r >= 1 && r <= ratingMax) distribution[r - 1]++;
                });
                const avg = ratings.length > 0
                    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
                    : 0;
                return {
                    questionId: q.id,
                    text: q.text,
                    type: q.type,
                    ratingMax,
                    ratingLabels: q.ratingLabels,
                    distribution,
                    averageRating: avg,
                    totalResponses: ratings.length
                };
            } else {
                // Text — collect all answers
                const textAnswers = qResponses.map(a => String(a!.answer));
                // Group duplicates
                const freq = new Map<string, number>();
                textAnswers.forEach(t => freq.set(t, (freq.get(t) || 0) + 1));
                const grouped = Array.from(freq.entries())
                    .map(([text, count]) => ({ text, count }))
                    .sort((a, b) => b.count - a.count);
                return {
                    questionId: q.id,
                    text: q.text,
                    type: q.type,
                    textAnswers: grouped,
                    totalResponses: textAnswers.length
                };
            }
        });

        // Batch-wise response breakdown
        const batchBreakdown: Record<string, { total: number; responded: number }> = {};
        if (deployedBatches.length > 0) {
            const allStudents = await BatchStudent.find({ courses: { $in: deployedBatches } }).select('phoneNumber courses').lean() as any[];
            const respondedPhones = new Set(responses.map(r => r.studentPhone));

            for (const batch of deployedBatches) {
                const batchStudents = allStudents.filter(s =>
                    s.courses.includes(batch) && !excludedSet.has(s.phoneNumber)
                );
                batchBreakdown[batch] = {
                    total: batchStudents.length,
                    responded: batchStudents.filter(s => respondedPhones.has(s.phoneNumber)).length
                };
            }
        }

        return NextResponse.json({
            survey,
            analytics: {
                totalStudents,
                totalResponses: responses.length,
                responseRate: totalStudents > 0
                    ? Math.round((responses.length / totalStudents) * 100)
                    : 0,
                batchBreakdown,
                questionAnalytics
            },
            responses: filteredResponses.map(r => ({
                _id: r._id,
                studentPhone: r.studentPhone,
                studentName: r.studentName,
                batchName: r.batchName,
                answers: r.answers,
                submittedAt: r.submittedAt
            }))
        });
    } catch (error: any) {
        console.error('Error fetching survey responses:', error);
        return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
    }
}
