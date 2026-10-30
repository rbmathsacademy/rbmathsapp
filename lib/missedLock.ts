import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import { isOutOfScope } from '@/lib/assignmentScope';
import { resolveStudentJoinedAt } from '@/lib/studentJoinDate';
import { unlimitedExpiry } from '@/lib/unlimitedAccess';

/** The "missed assignment" lock counts assignments that open on or after this day (India time). */
export const MISSED_RULE_FROM = new Date('2026-10-15T00:00:00+05:30');

export interface MissedLockItem { assignmentId: string; title: string; reason: string }

/** When the assignment opens to students: its scheduled time, else when it was created. */
function openedAt(a: any): Date {
    if (a.scheduledFor) return new Date(a.scheduledFor);
    if (a.createdAt) return new Date(a.createdAt);
    return new Date(parseInt(String(a._id).slice(0, 8), 16) * 1000);
}

/**
 * True when this assignment counts as missed for the lock (so the student may also hand it in late):
 * opened on/after the cut-off, deadline + late window over, not handed in, the student was in the
 * batch before the deadline, was not excluded / not left out of a selected-students assignment,
 * and has no active unlimited access.
 */
export function countsAsMissed(a: any, student: any, hasSubmission: boolean, now: Date = new Date()): boolean {
    if (hasSubmission) return false;
    if (openedAt(a).getTime() < MISSED_RULE_FROM.getTime()) return false;
    const deadline = new Date(a.deadline);
    const lateWindowEnd = new Date(deadline.getTime() + (a.cooldownDuration || 0) * 60000);
    if (now.getTime() <= lateWindowEnd.getTime()) return false;
    if (isOutOfScope(a, student.phoneNumber)) return false;
    if (resolveStudentJoinedAt(student).getTime() > deadline.getTime()) return false;
    if (unlimitedExpiry(student, now)) return false;
    return true;
}

/** Missed assignments that lock the student's portal until they are handed in (late). */
export async function getMissedLock(student: any): Promise<MissedLockItem[]> {
    const courses: string[] = student.courses || [];
    if (courses.length === 0) return [];
    const assignments = await Assignment.find({
        batch: { $in: courses },
        $or: [{ scheduledFor: { $gte: MISSED_RULE_FROM } }, { createdAt: { $gte: MISSED_RULE_FROM } }],
    }).select('title deadline cooldownDuration scheduledFor createdAt excludedStudents targetStudents').lean() as any[];
    if (assignments.length === 0) return [];
    const subs = await AssignmentSubmission.find({ student: student._id, assignment: { $in: assignments.map(a => a._id) } }).select('assignment').lean() as any[];
    const done = new Set(subs.map(s => String(s.assignment)));
    const now = new Date();
    return assignments
        .filter(a => countsAsMissed(a, student, done.has(String(a._id)), now))
        .map(a => ({ assignmentId: String(a._id), title: String(a.title || 'Assignment').split('||')[0].trim(), reason: '' }));
}
