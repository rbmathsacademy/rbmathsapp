
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
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

        // Attach stats to each assignment
        // This might be expensive if many assignments, but okay for admin view usually
        const assignmentsWithStats = await Promise.all(assignments.map(async (a: any) => {
            const submissionCount = await AssignmentSubmission.countDocuments({ assignment: a._id });
            // We could also count late submissions here
            const lateCount = await AssignmentSubmission.countDocuments({ assignment: a._id, isLate: true });
            return { ...a, submissionCount, lateCount };
        }));

        const folders = await AssignmentFolder.find({}).sort({ createdAt: -1 }).lean();

        return NextResponse.json({ assignments: assignmentsWithStats, folders });
    } catch (error: any) {
        console.error('Failed to fetch assignments', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch assignments' }, { status: 500 });
    }
}
