import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import { countsAsMissed, MISSED_RULE_FROM } from '@/lib/missedLock';

export interface LockItem { assignmentId: string; title: string; reason: string }

const titleOf = (a: any) => String(a?.title || 'Assignment').split('||')[0].trim();

/**
 * Both portal locks in two queries (instead of one set of queries per lock):
 *  - redoLock: assignments the teacher rejected, still to be re-submitted
 *  - missedLock: missed assignments (opening from 15 Oct 2026) still to be handed in late
 * Missed-assignment rules live in lib/missedLock.ts.
 */
export async function getPortalLocks(student: any): Promise<{ redoLock: LockItem[]; missedLock: LockItem[] }> {
    const sid = String(student._id);
    const courses: string[] = student.courses || [];

    const subs = await AssignmentSubmission.find({ student: student._id }).select('assignment rejection').lean() as any[];
    const submitted = new Set(subs.map(s => String(s.assignment)));
    const rejected = subs.filter(s => s.rejection);

    const or: any[] = [{ redoAllowed: sid }];
    if (rejected.length) or.push({ _id: { $in: rejected.map(s => s.assignment) } });
    if (courses.length) or.push({ batch: { $in: courses }, $or: [{ scheduledFor: { $gte: MISSED_RULE_FROM } }, { createdAt: { $gte: MISSED_RULE_FROM } }] });
    const assignments = await Assignment.find({ $or: or })
        .select('title batch deadline cooldownDuration scheduledFor createdAt excludedStudents targetStudents redoAllowed').lean() as any[];
    const byId = new Map(assignments.map(a => [String(a._id), a]));

    // Rejected copies, plus redo permissions whose rejected copy was already deleted (older flow)
    const redo = new Map<string, LockItem>();
    for (const s of rejected) {
        const id = String(s.assignment);
        redo.set(id, { assignmentId: id, title: titleOf(byId.get(id)), reason: s.rejection?.reason || '' });
    }
    for (const a of assignments) {
        const id = String(a._id);
        if ((a.redoAllowed || []).includes(sid) && !submitted.has(id) && !redo.has(id)) redo.set(id, { assignmentId: id, title: titleOf(a), reason: '' });
    }

    const now = new Date();
    const missedLock = assignments
        .filter(a => courses.includes(a.batch) && !redo.has(String(a._id)) && countsAsMissed(a, student, submitted.has(String(a._id)), now))
        .map(a => ({ assignmentId: String(a._id), title: titleOf(a), reason: '' }));

    return { redoLock: [...redo.values()], missedLock };
}
