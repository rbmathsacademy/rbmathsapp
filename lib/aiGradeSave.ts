import AssignmentSubmission from '@/models/AssignmentSubmission';
import Assignment from '@/models/Assignment';
import BatchStudent from '@/models/BatchStudent';
import GradingLog from '@/models/GradingLog';
import Notification from '@/models/Notification';
import { computeGrade, stripCitations, submissionCode, ERROR_TYPES, type AiReview, type Grade } from '@/lib/aiGrading';

/**
 * THE shared save step. Every way a copy gets graded ends here: a pasted Gemini reply, Claude
 * (batch or "Grade now"), and the admin's manual edits. So grade rule, warnings, student
 * notifications and the audit log behave identically whatever produced the review.
 */
export type GradeSource = 'claude-batch' | 'claude-now' | 'gemini-import' | 'manual-edit';

const GRADES: Grade[] = ['GOOD', 'SATISFACTORY', 'POOR'];
const DAY = 24 * 60 * 60 * 1000;

/** Clamp and trim a review before it is stored. */
export function sanitizeReview(rv: Partial<AiReview> | undefined) {
    const r = rv || {};
    return {
        totalQuestions: Math.max(0, Math.round(Number(r.totalQuestions) || 0)),
        correct: Math.max(0, Math.round(Number(r.correct) || 0)),
        incorrect: Math.max(0, Math.round(Number(r.incorrect) || 0)),
        skippedOrIncomplete: Math.max(0, Math.round(Number(r.skippedOrIncomplete) || 0)),
        unreadable: !!r.unreadable,
        unreadableNote: stripCitations(String(r.unreadableNote || '')).slice(0, 1000),
        summary: stripCitations(String(r.summary || '')).slice(0, 2000),
        feedback: (Array.isArray(r.feedback) ? r.feedback : []).slice(0, 100).map((f: any) => ({
            question: String(f?.question || '').slice(0, 40),
            status: ['INCORRECT', 'PARTIAL', 'INCOMPLETE', 'SKIPPED'].includes(f?.status) ? f.status : 'INCORRECT',
            comment: stripCitations(String(f?.comment || '')).slice(0, 2000),
            errorType: ERROR_TYPES.includes(f?.errorType) ? f.errorType : null,
        })),
        aiGrade: r.aiGrade ? String(r.aiGrade).slice(0, 20) : null,
        importedAt: new Date(),
    };
}

/** Status/quality that go with a review: unreadable copies stay unchecked for manual checking. */
export function gradingFields(review: ReturnType<typeof sanitizeReview>, grade?: string | null) {
    if (review.unreadable) return { status: 'PENDING', quality: null as string | null };
    const chosen = grade && GRADES.includes(grade as Grade) ? grade : computeGrade(review);
    return { status: 'CORRECTED', quality: chosen as string | null };
}

export interface SaveItem {
    submissionId: string;
    review: Partial<AiReview>;
    /** Explicit grade (admin edit); otherwise the grade rule decides. */
    grade?: string | null;
    source: GradeSource;
    model?: string | null;
    usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
    costUSD?: number;
    durationMs?: number;
}

export interface SaveResult {
    graded: number;
    flagged: number; // unreadable
    warned: number;
    notified: number;
    missing: string[]; // submission ids not found in this assignment
    saved: Array<{ submissionId: string; code: string; status: string; quality: string | null; warning: { count: number; limit: number } | null; aiReview: any }>;
}

const titleHead = (t: string) => String(t || 'Homework').split('||')[0].trim();

function warningNotification(assignment: any, student: any, count: number, limit: number) {
    return {
        title: '⚠ Homework needs your attention',
        message: `"${titleHead(assignment.title)}": ${count} question${count === 1 ? ' was' : 's were'} wrong or skipped (the limit set by your teacher is ${limit}).\n\nPlease open Assignments → Completed and study the feedback carefully.`,
        type: 'popup',
        oncePerStudent: true,
        link: '/student/assignments',
        targetStudents: [{ phoneNumber: student.phoneNumber, studentName: student.name, batchName: assignment.batch }],
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * DAY),
        assignmentId: assignment._id,
    };
}

export async function saveReviews(assignmentId: string, items: SaveItem[], opts: { by?: string } = {}): Promise<SaveResult> {
    const result: SaveResult = { graded: 0, flagged: 0, warned: 0, notified: 0, missing: [], saved: [] };
    if (items.length === 0) return result;

    const assignment = await Assignment.findById(assignmentId).select('title batch warningLimit').lean() as any;
    if (!assignment) { result.missing = items.map(i => i.submissionId); return result; }
    const limit: number | null = typeof assignment.warningLimit === 'number' ? assignment.warningLimit : null;

    const subs = await AssignmentSubmission.find({ _id: { $in: items.map(i => i.submissionId) }, assignment: assignmentId })
        .select('student aiReview warning warningNotifiedAt').lean() as any[];
    const subById = new Map(subs.map(s => [s._id.toString(), s]));
    const students = await BatchStudent.find({ _id: { $in: subs.map(s => s.student) } }).select('name phoneNumber').lean() as any[];
    const studentById = new Map(students.map(s => [s._id.toString(), s]));

    const ops: any[] = [];
    const logs: any[] = [];
    const notifications: any[] = [];

    for (const item of items) {
        const sub = subById.get(item.submissionId);
        if (!sub) { result.missing.push(item.submissionId); continue; }

        const review = sanitizeReview({ ...item.review, aiGrade: item.review.aiGrade ?? sub.aiReview?.aiGrade ?? null });
        const claude = item.source === 'claude-batch' || item.source === 'claude-now';
        const reviewSource = claude ? 'claude-api' : item.source === 'gemini-import' ? 'gemini-chat' : (sub.aiReview?.source ?? null);
        const reviewModel = claude ? (item.model ?? null) : item.source === 'gemini-import' ? null : (sub.aiReview?.model ?? null);
        const fields = gradingFields(review, item.grade);

        // Warning: more wrong + skipped questions than the teacher allows (not for unreadable copies)
        const wrongPlusSkipped = review.incorrect + review.skippedOrIncomplete;
        const warn = !review.unreadable && limit !== null && wrongPlusSkipped > limit;
        const unchanged = warn && sub.warning && sub.warning.count === wrongPlusSkipped && sub.warning.limit === limit;
        const warning = warn ? { count: wrongPlusSkipped, limit: limit as number, at: unchanged ? sub.warning.at : new Date() } : null;
        const student = studentById.get(sub.student.toString());
        const notify = warn && !sub.warningNotifiedAt && !!student?.phoneNumber;

        ops.push({
            updateOne: {
                filter: { _id: item.submissionId, assignment: assignmentId },
                update: { $set: { aiReview: { ...review, source: reviewSource, model: reviewModel }, ...fields, warning, ...(notify ? { warningNotifiedAt: new Date() } : {}) } },
            },
        });
        if (notify) notifications.push(warningNotification(assignment, student, wrongPlusSkipped, limit as number));

        logs.push({
            assignment: assignmentId, submission: item.submissionId, student: sub.student,
            studentName: student?.name || '', code: submissionCode(item.submissionId),
            source: item.source, model: item.model ?? null, status: 'done',
            counts: { total: review.totalQuestions, correct: review.correct, incorrect: review.incorrect, skipped: review.skippedOrIncomplete },
            grade: fields.quality, unreadable: review.unreadable, notes: review.feedback.length,
            warning: { triggered: !!warning, count: wrongPlusSkipped, limit, notified: notify },
            usage: item.usage || {}, costUSD: item.costUSD || 0, durationMs: item.durationMs || 0, by: opts.by || '',
        });

        if (review.unreadable) result.flagged++; else result.graded++;
        if (warning) result.warned++;
        if (notify) result.notified++;
        result.saved.push({
            submissionId: item.submissionId, code: submissionCode(item.submissionId),
            status: fields.status, quality: fields.quality, warning: warning ? { count: warning.count, limit: warning.limit } : null,
            aiReview: { ...review, source: reviewSource, model: reviewModel },
        });
    }

    if (ops.length > 0) await AssignmentSubmission.bulkWrite(ops, { ordered: false });
    if (notifications.length > 0) await Notification.insertMany(notifications).catch(e => console.error('[aiGradeSave] notification failed:', e));
    if (logs.length > 0) await GradingLog.insertMany(logs).catch(e => console.error('[aiGradeSave] log failed:', e));
    return result;
}

/** Write a log entry for a check that failed or was skipped (nothing was saved on the submission). */
export async function logGradingProblem(entry: {
    assignmentId: string; submissionId: string; studentId?: any; studentName?: string; source: GradeSource;
    model?: string | null; status: 'failed' | 'skipped'; reason: string; by?: string;
    usage?: SaveItem['usage']; costUSD?: number;
}) {
    await GradingLog.create({
        assignment: entry.assignmentId, submission: entry.submissionId, student: entry.studentId,
        studentName: entry.studentName || '', code: submissionCode(entry.submissionId),
        source: entry.source, model: entry.model ?? null, status: entry.status, reason: String(entry.reason).slice(0, 500),
        usage: entry.usage || {}, costUSD: entry.costUSD || 0, by: entry.by || '',
    }).catch(e => console.error('[aiGradeSave] problem log failed:', e));
}

/**
 * After the warning limit of an assignment changes: re-evaluate every graded copy. Newly warned
 * students are notified once; copies that no longer exceed the limit lose their warning.
 */
export async function recheckWarnings(assignmentId: string): Promise<{ warned: number; cleared: number; notified: number }> {
    const out = { warned: 0, cleared: 0, notified: 0 };
    const assignment = await Assignment.findById(assignmentId).select('title batch warningLimit').lean() as any;
    if (!assignment) return out;
    const limit: number | null = typeof assignment.warningLimit === 'number' ? assignment.warningLimit : null;

    const subs = await AssignmentSubmission.find({ assignment: assignmentId, status: 'CORRECTED', aiReview: { $ne: null }, 'aiReview.unreadable': { $ne: true } })
        .select('student aiReview warning warningNotifiedAt').lean() as any[];
    const students = await BatchStudent.find({ _id: { $in: subs.map(s => s.student) } }).select('name phoneNumber').lean() as any[];
    const studentById = new Map(students.map(s => [s._id.toString(), s]));

    const ops: any[] = [];
    const notifications: any[] = [];
    for (const sub of subs) {
        const count = (sub.aiReview.incorrect || 0) + (sub.aiReview.skippedOrIncomplete || 0);
        const warn = limit !== null && count > limit;
        if (warn) {
            out.warned++;
            const student = studentById.get(sub.student.toString());
            const notify = !sub.warningNotifiedAt && !!student?.phoneNumber;
            ops.push({ updateOne: { filter: { _id: sub._id }, update: { $set: { warning: { count, limit, at: sub.warning?.at || new Date() }, ...(notify ? { warningNotifiedAt: new Date() } : {}) } } } });
            if (notify) { notifications.push(warningNotification(assignment, student, count, limit as number)); out.notified++; }
        } else if (sub.warning) {
            out.cleared++;
            ops.push({ updateOne: { filter: { _id: sub._id }, update: { $set: { warning: null } } } });
        }
    }
    if (ops.length > 0) await AssignmentSubmission.bulkWrite(ops, { ordered: false });
    if (notifications.length > 0) await Notification.insertMany(notifications).catch(e => console.error('[recheckWarnings] notification failed:', e));
    return out;
}
