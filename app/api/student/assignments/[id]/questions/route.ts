import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import BatchStudent from '@/models/BatchStudent';
import AssignmentQuestionSet from '@/models/AssignmentQuestionSet';
import Question from '@/models/Question';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

/**
 * GET /api/student/assignments/[id]/questions
 * Returns the questions for a QUESTIONS-type assignment.
 * If randomCount > 0, generates a persistent per-student random subset on first access.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // 1. Auth
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { payload } = await jwtVerify(token, key);
        const phoneNumber = (payload as any).phoneNumber || (payload as any).userId;

        await dbConnect();

        // 2. Resolve student
        const student = await BatchStudent.findOne({ phoneNumber });
        if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        // 3. Fetch assignment
        const assignment = await Assignment.findById(id).lean() as any;
        if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        if (assignment.type !== 'QUESTIONS') return NextResponse.json({ error: 'Not a question assignment' }, { status: 400 });

        const pool: string[] = Array.isArray(assignment.content) ? assignment.content : [];
        const randomCount = assignment.randomCount || 0;

        let questionIds: string[];

        if (randomCount > 0 && randomCount < pool.length) {
            // Random deploy mode: get or create persistent question set
            let qSet = await AssignmentQuestionSet.findOne({
                assignment: assignment._id,
                student: student._id
            }).lean() as any;

            if (!qSet) {
                // Generate a random subset using Fisher-Yates shuffle seeded by student+assignment
                const shuffled = [...pool];
                // Use a deterministic-ish shuffle (but truly random is fine since we persist it)
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                const selected = shuffled.slice(0, randomCount);

                // Persist it
                qSet = await AssignmentQuestionSet.create({
                    assignment: assignment._id,
                    student: student._id,
                    questions: selected
                });
            }

            questionIds = qSet.questions;
        } else {
            // Non-random: all questions
            questionIds = pool;
        }

        // 4. Fetch question details (strip answers for student view)
        const questions = await Question.find({ _id: { $in: questionIds } })
            .select('-answer -explanation -hint')
            .lean();

        return NextResponse.json({
            title: assignment.title,
            deadline: assignment.deadline,
            questions
        });
    } catch (error: any) {
        console.error('Student assignment questions error:', error);
        return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
    }
}
