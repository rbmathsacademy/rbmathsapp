import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';

export interface RedoLockItem { assignmentId: string; title: string; reason: string }

/**
 * Assignments a student must re-submit because the teacher rejected them. While this list is not
 * empty the student portal is locked except for Assignments and Student Chat. It empties by itself
 * when the student re-submits: the rejected copy is replaced (or, in the older flow, the redo
 * permission is used up), so nothing has to be unlocked by hand.
 */
export async function getRedoLock(studentId: string): Promise<RedoLockItem[]> {
    const [rejected, redo] = await Promise.all([
        AssignmentSubmission.find({ student: studentId, rejection: { $ne: null } }).select('assignment rejection').lean() as Promise<any[]>,
        // older flow: the rejected copy was deleted and the redo permission is still waiting to be used
        Assignment.find({ redoAllowed: String(studentId) }).select('_id').lean() as Promise<any[]>,
    ]);
    const pendingRedo = redo.length
        ? await AssignmentSubmission.find({ student: studentId, assignment: { $in: redo.map(a => a._id) } }).select('assignment').lean() as any[]
        : [];
    const submitted = new Set(pendingRedo.map(s => String(s.assignment)));

    const reasons = new Map<string, string>();
    for (const s of rejected) reasons.set(String(s.assignment), s.rejection?.reason || '');
    for (const a of redo) if (!submitted.has(String(a._id)) && !reasons.has(String(a._id))) reasons.set(String(a._id), '');
    if (reasons.size === 0) return [];

    const titles = await Assignment.find({ _id: { $in: [...reasons.keys()] } }).select('title').lean() as any[];
    return titles.map(a => ({
        assignmentId: String(a._id),
        title: String(a.title || 'Assignment').split('||')[0].trim(),
        reason: reasons.get(String(a._id)) || '',
    }));
}
