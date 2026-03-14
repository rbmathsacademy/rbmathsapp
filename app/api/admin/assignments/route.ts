
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import BatchStudent from '@/models/BatchStudent';
import Question from '@/models/Question';
import AssignmentFolder from '@/models/AssignmentFolder';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();

        // Validation
        if (!body.title || !body.type || !body.batch || !body.deadline || !body.content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const assignment = await Assignment.create({
            ...body,
            ...body,
            folderId: body.folderId || null,
            createdAt: new Date()
        });

        return NextResponse.json({ success: true, assignment });
    } catch (error: any) {
        console.error('Failed to create assignment', error);
        return NextResponse.json({ error: error.message || 'Failed to create assignment' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const batch = searchParams.get('batch');

        const query: any = {};
        if (batch) query.batch = batch;

        const assignments = await Assignment.find(query).sort({ createdAt: -1 }).lean();

        // Pre-fetch student counts per batch for efficiency
        const uniqueBatches = [...new Set(assignments.map((a: any) => a.batch))];
        const batchStudentCounts: Record<string, number> = {};
        await Promise.all(uniqueBatches.map(async (b) => {
            batchStudentCounts[b] = await BatchStudent.countDocuments({ courses: b });
        }));

        const now = new Date();

        // Attach full stats to each assignment
        const assignmentsWithStats = await Promise.all(assignments.map(async (a: any) => {
            const submissions = await AssignmentSubmission.find({ assignment: a._id }, 'submittedAt student');
            const submissionCount = submissions.length;
            const totalStudents = batchStudentCounts[a.batch] || 0;

            const deadlineTime = new Date(a.deadline).getTime();
            const cooldownEnd = new Date(deadlineTime + (a.cooldownDuration || 0) * 60000);

            // Late = submitted after deadline
            let lateCount = 0;
            submissions.forEach((sub: any) => {
                const subTime = new Date(sub.submittedAt).getTime();
                if (subTime > deadlineTime) {
                    lateCount++;
                }
            });

            // Missed = no submission AND cooldown has expired
            let missedCount = 0;
            if (now > cooldownEnd) {
                // Students who didn't submit = total - submitted
                missedCount = Math.max(0, totalStudents - submissionCount);
            }

            return { ...a, submissionCount, lateCount, missedCount, totalStudents };
        }));

        const folders = await AssignmentFolder.find({}).sort({ createdAt: -1 }).lean();

        return NextResponse.json({ assignments: assignmentsWithStats, folders });
    } catch (error: any) {
        console.error('Failed to fetch assignments', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch assignments' }, { status: 500 });
    }
}
