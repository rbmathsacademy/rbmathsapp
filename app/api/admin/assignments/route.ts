
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import BatchStudent from '@/models/BatchStudent';
import Question from '@/models/Question';
import AssignmentFolder from '@/models/AssignmentFolder';
import { isOutOfScope, isTargeted } from '@/lib/assignmentScope';
import { unlimitedExpiry } from '@/lib/unlimitedAccess';

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

        const { removeFromAssignmentId, ...rest } = body;
        const createData: any = {
            ...rest,
            targetStudents: Array.isArray(body.targetStudents) ? body.targetStudents.map((p: any) => String(p)).filter(Boolean) : [],
            deadline: new Date(body.deadline),
            scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
            folderId: body.folderId || null,
            createdAt: new Date()
        };

        const assignment = await Assignment.create(createData);

        // Special version for some students: take them out of the regular assignment so it does not show as Missed there
        if (removeFromAssignmentId && createData.targetStudents.length > 0) {
            await Assignment.updateOne({ _id: removeFromAssignmentId }, { $addToSet: { excludedStudents: { $each: createData.targetStudents } } });
        }

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

        const foldersPromise = AssignmentFolder.find({}).sort({ createdAt: -1 }).lean(); // in parallel
        const assignments = await Assignment.find(query).sort({ createdAt: -1 }).lean();

        // Pre-fetch students per batch with join dates for accurate missed/pending/new-admission counts
        const uniqueBatches = [...new Set(assignments.map((a: any) => a.batch))];
        const batchStudentsMap: Record<string, Array<{ _id: any; createdAt: Date; phoneNumber: string }>> = {};
        await Promise.all(uniqueBatches.map(async (b) => {
            batchStudentsMap[b] = await BatchStudent.find({ courses: b }).select('_id createdAt phoneNumber noExpiry unlimitedUntil').lean();
        }));

        const now = new Date();

        // All submissions of these assignments in ONE query (was one query per assignment)
        const allSubmissions = await AssignmentSubmission.find(
            { assignment: { $in: assignments.map((a: any) => a._id) } },
            'assignment submittedAt student status',
        ).lean();
        const submissionsByAssignment = new Map<string, any[]>();
        for (const s of allSubmissions as any[]) {
            const k = s.assignment.toString();
            (submissionsByAssignment.get(k) || submissionsByAssignment.set(k, []).get(k)!).push(s);
        }

        // Attach full stats to each assignment
        const assignmentsWithStats = assignments.map((a: any) => {
            const submissions = submissionsByAssignment.get(a._id.toString()) || [];
            const submissionCount = submissions.length;
            const correctedCount = submissions.filter((s: any) => s.status === 'CORRECTED').length;
            const batchStudents = batchStudentsMap[a.batch] || [];
            const totalStudents = isTargeted(a) ? batchStudents.filter((s: any) => !isOutOfScope({ targetStudents: a.targetStudents }, s.phoneNumber)).length : batchStudents.length;

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
                if (isOutOfScope(a, student.phoneNumber)) return; // excluded or not selected
                if (unlimitedExpiry(student, now)) { pendingCount++; return; } // unlimited access: still open for them

                const studentJoinDate = new Date(student.createdAt);
                if (studentJoinDate > deadline) {
                    newAdmissionCount++;
                } else if (cooldownExpired) {
                    missedCount++;
                } else {
                    pendingCount++;
                }
            });

            return { ...a, submissionCount, correctedCount, lateCount, missedCount, pendingCount, newAdmissionCount, totalStudents };
        });

        const folders = await foldersPromise;

        return NextResponse.json({ assignments: assignmentsWithStats, folders });
    } catch (error: any) {
        console.error('Failed to fetch assignments', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch assignments' }, { status: 500 });
    }
}
