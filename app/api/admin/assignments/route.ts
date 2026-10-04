
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
        if (!body.title || !body.type || !body.batch || !body.deadline) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        if (body.type !== 'INTERACTIVE' && !body.content) {
            return NextResponse.json({ error: 'Missing content for assignment' }, { status: 400 });
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

        // Pre-fetch students per batch with join dates for accurate missed/pending/new-admission counts
        const uniqueBatches = [...new Set(assignments.map((a: any) => a.batch))];
        const batchStudentsMap: Record<string, Array<{ _id: any; createdAt: Date; phoneNumber: string }>> = {};
        await Promise.all(uniqueBatches.map(async (b) => {
            batchStudentsMap[b] = await BatchStudent.find({ courses: b }).select('_id createdAt phoneNumber').lean();
        }));

        const now = new Date();

        // Attach full stats to each assignment
        const assignmentsWithStats = await Promise.all(assignments.map(async (a: any) => {
            const submissions = await AssignmentSubmission.find({ assignment: a._id }, 'submittedAt student');
            const submissionCount = submissions.length;
            const batchStudents = batchStudentsMap[a.batch] || [];
            const totalStudents = batchStudents.length;

            const deadline = new Date(a.deadline);
            const deadlineTime = deadline.getTime();
            const cooldownEnd = new Date(deadlineTime + (a.cooldownDuration || 0) * 60000);
            const cooldownExpired = now > cooldownEnd;

            // Late = submitted after deadline
            let lateCount = 0;
            submissions.forEach((sub: any) => {
                const subTime = new Date(sub.submittedAt).getTime();
                if (subTime > deadlineTime) {
                    lateCount++;
                }
            });

            const submittedStudentIds = new Set(submissions.map((s: any) => s.student.toString()));
            const excludedPhones: string[] = a.excludedStudents || [];
            const excludedSet = new Set(excludedPhones);

            // Three mutually-exclusive non-submitter buckets:
            // NEW_ADMISSION: joined AFTER deadline (regardless of cooldown)
            // PENDING:       joined on/before deadline, cooldown NOT yet expired
            // MISSED:        joined on/before deadline, cooldown HAS expired
            // Pending and Missed are complementary — only one can be non-zero at a time.
            let missedCount = 0;
            let pendingCount = 0;
            let newAdmissionCount = 0;

            batchStudents.forEach((student: any) => {
                if (submittedStudentIds.has(student._id.toString())) return; // submitted
                if (excludedSet.has(student.phoneNumber)) return; // excluded

                const studentJoinDate = new Date(student.createdAt);
                if (studentJoinDate > deadline) {
                    newAdmissionCount++;
                } else if (cooldownExpired) {
                    missedCount++;
                } else {
                    pendingCount++;
                }
            });

            return { ...a, submissionCount, lateCount, missedCount, pendingCount, newAdmissionCount, totalStudents };
        }));

        const folders = await AssignmentFolder.find({}).sort({ createdAt: -1 }).lean();

        return NextResponse.json({ assignments: assignmentsWithStats, folders });
    } catch (error: any) {
        console.error('Failed to fetch assignments', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch assignments' }, { status: 500 });
    }
}
