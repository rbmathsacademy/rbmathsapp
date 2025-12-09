import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Assignment from '@/models/Assignment';
import Question from '@/models/Question';
import Student from '@/models/Student';
import StudentAssignment from '@/models/StudentAssignment';
import Notification from '@/models/Notification';
import Attendance from '@/models/Attendance';
import Submission from '@/models/Submission';

export async function GET() {
    await connectDB();
    const assignments = await Assignment.find({}).sort({ createdAt: -1 });
    return NextResponse.json(assignments);
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();
        const { type } = body;

        let assignment;
        let targetStudents: any[] = [];
        let studentAssignments: any[] = [];
        let notifications: any[] = [];

        // 1. Fetch Students based on filters (Common for Manual, Randomized, Batch)
        if (['manual', 'randomized', 'batch_attendance'].includes(type)) {
            const query: any = {};
            if (body.targetDepartments && body.targetDepartments.length > 0) {
                query.department = { $in: body.targetDepartments };
            }
            if (body.targetYear && body.targetYear !== 'all') {
                query.year = body.targetYear;
            }
            if (body.targetCourse) {
                query.course_code = body.targetCourse;
            }
            targetStudents = await Student.find(query);
        } else if (type === 'personalized') {
            targetStudents = await Student.find({ _id: { $in: body.targetStudentIds } });
        }

        if (targetStudents.length === 0) {
            return NextResponse.json({ error: 'No students match the criteria' }, { status: 400 });
        }

        // 2. Create Assignment Document
        assignment = (await Assignment.create(body)) as any;

        // 3. Handle Specific Logic
        // 3. Handle Specific Logic
        if (type === 'manual') {
            // Manual: Just notify students
        }
        else if (type === 'randomized') {
            const pool = body.questionPool; // Array of Question IDs
            const count = body.questionCount;

            for (const student of targetStudents) {
                // Shuffle and pick
                const shuffled = [...pool].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, count);

                studentAssignments.push({
                    studentId: student._id,
                    studentRoll: student.roll,
                    assignmentId: assignment._id,
                    questionIds: selected,
                    status: 'pending'
                });
            }
        }
        else if (type === 'batch_attendance') {
            // Fetch Attendance Records
            const facultyCourseCode = body.targetCourse.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            const allAttendance = await Attendance.find({});

            const courseRecords = allAttendance.filter((r: any) =>
                (r.course_code || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase() === facultyCourseCode
            );

            // Filter questions by pool if provided
            let allowedQuestions = await Question.find({});
            if (body.questionPool && Array.isArray(body.questionPool)) {
                allowedQuestions = allowedQuestions.filter((q: any) => body.questionPool.includes(q._id.toString()));
            }

            // Sort rules by min descending to handle overlaps (e.g. 70 in 50-70 vs 70-100)
            // If 70 is boundary, 70-100 (min 70) should come before 50-70 (max 70)
            // Actually, if we use >= min and <= max, both match. 
            // We want 70 to match 70-100. So we check higher ranges first.
            const sortedRules = (body.rules || []).sort((a: any, b: any) => b.min - a.min);

            for (const student of targetStudents) {
                // Calculate Attendance %
                const participatedRecords = courseRecords.filter((r: any) =>
                    (r.presentStudentIds && r.presentStudentIds.includes(student._id)) ||
                    (r.absentStudentIds && r.absentStudentIds.includes(student._id))
                );

                const totalClasses = participatedRecords.length;
                let percent = 100;

                if (totalClasses > 0) {
                    const presentCount = participatedRecords.filter((r: any) => r.presentStudentIds && r.presentStudentIds.includes(student._id)).length;
                    const adj = student.attended_adjustment || 0;
                    percent = ((presentCount + adj) / totalClasses) * 100;
                }

                // Match Rule
                const rule = sortedRules.find((r: any) => percent >= r.min && percent <= r.max);

                if (rule) {
                    const totalQ = rule.count;
                    let qIdsSet = new Set<string>();

                    // Topic Weights
                    if (body.topicWeights && body.topicWeights.length > 0) {
                        body.topicWeights.forEach((tw: any) => {
                            const n = Math.round(totalQ * (tw.weight / 100));
                            const pool = allowedQuestions.filter((q: any) => q.topic === tw.topic);
                            const picked = [...pool].sort(() => 0.5 - Math.random()).slice(0, n);
                            picked.forEach((q: any) => qIdsSet.add(q._id.toString()));
                        });
                    }

                    // Fill remaining from allowed questions
                    if (qIdsSet.size < totalQ) {
                        const rest = allowedQuestions.filter((q: any) => !qIdsSet.has(q._id.toString()));
                        const needed = totalQ - qIdsSet.size;
                        const fill = [...rest].sort(() => 0.5 - Math.random()).slice(0, needed);
                        fill.forEach((q: any) => qIdsSet.add(q._id.toString()));
                    }

                    const finalQIds = Array.from(qIdsSet).slice(0, totalQ);

                    if (finalQIds.length > 0) {
                        studentAssignments.push({
                            studentId: student._id,
                            studentRoll: student.roll,
                            assignmentId: assignment._id,
                            questionIds: finalQIds,
                            status: 'pending'
                        });
                    }
                }
            }
        }
        else if (type === 'personalized') {
            const pool = body.questionPool; // Array of Question IDs
            const count = body.questionCount;

            for (const student of targetStudents) {
                const shuffled = [...pool].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, count);

                if (selected.length > 0) {
                    studentAssignments.push({
                        studentId: student._id,
                        studentRoll: student.roll,
                        assignmentId: assignment._id,
                        questionIds: selected,
                        status: 'pending'
                    });
                }
            }
        }

        // 4. Batch Insert Student Assignments
        if (studentAssignments.length > 0) {
            await StudentAssignment.insertMany(studentAssignments);
        }

        // 5. Create Notifications (for all targeted students, or only assigned ones?)
        // Legacy: "sendNotifications(targetStudents...)" for Manual/Randomized/Batch
        // For Personalized: "notifList.push(student)" only if questions generated.

        let notifStudents = targetStudents;
        if (type === 'personalized' || type === 'batch_attendance') {
            // Only notify students who actually got an assignment
            const assignedIds = new Set(studentAssignments.map(sa => sa.studentId.toString()));
            notifStudents = targetStudents.filter(s => assignedIds.has(s._id.toString()));
        }

        notifications = notifStudents.map(s => ({
            studentId: s._id,
            title: body.title,
            message: `New ${type.replace('_', ' ')} assignment available.`,
            link: '/student/assignments',
            assignmentId: assignment._id,
            isRead: false
        }));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }

        return NextResponse.json(assignment);

    } catch (error: any) {
        console.error("Assignment Creation Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // 1. Delete Assignment
        await Assignment.findByIdAndDelete(id);

        // 2. Delete Student Assignments
        await StudentAssignment.deleteMany({ assignmentId: id });

        // 3. Delete Notifications
        await Notification.deleteMany({ assignmentId: id });

        // 4. Delete Submissions
        await Submission.deleteMany({ assignment: id }); // Note: Submission model uses 'assignment' field

        return NextResponse.json({ message: 'Deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await connectDB();
        const body = await req.json();
        const { id, deadline, startTime } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const updateData: any = {};
        if (deadline) updateData.deadline = new Date(deadline);
        if (startTime) updateData.startTime = new Date(startTime);

        const assignment = await Assignment.findByIdAndUpdate(id, updateData, { new: true });

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        return NextResponse.json(assignment);
    } catch (error: any) {
        console.error('Assignment Update Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

