import BatchStudent from '@/models/BatchStudent';
import DeletedStudent from '@/models/DeletedStudent';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import AttemptTopicStat from '@/models/AttemptTopicStat';
import SurveyResponse from '@/models/SurveyResponse';

/** Days a soft-deleted student stays in the recycle bin before their records are purged. */
export const ARCHIVE_DAYS = 100;
/**
 * MongoDB's TTL removes the archive record at `expiresAt`, silently. It is set this many days AFTER
 * the purge date, only as a safety net, so the portal always gets to purge the records first.
 */
export const TTL_GRACE_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/** purgeAt / expiresAt for a student moved to the recycle bin now. */
export function archiveDates(now = new Date()) {
    const purgeAt = new Date(now.getTime() + ARCHIVE_DAYS * DAY);
    return { purgeAt, expiresAt: new Date(purgeAt.getTime() + TTL_GRACE_DAYS * DAY) };
}

/** When an archive record is due for purging (older records have no purgeAt). */
export function purgeDateOf(doc: { purgeAt?: Date | null; expiresAt?: Date | null; deletedAt?: Date | null }): Date {
    if (doc.purgeAt) return new Date(doc.purgeAt);
    if (doc.deletedAt) return new Date(new Date(doc.deletedAt).getTime() + ARCHIVE_DAYS * DAY);
    return new Date(doc.expiresAt || Date.now());
}

/**
 * Deletes a permanently-deleted student's online test attempts (and their derived topic
 * summaries), homework submissions (grades + AI feedback) and survey responses.
 * FEE RECORDS ARE NEVER TOUCHED.
 *
 * Safety: nothing is deleted if the student is active again (restored with the same id). Records
 * keyed by phone number are kept when that number belongs to an active student (re-added, or
 * another student's number), since they can't be told apart.
 */
export async function purgeStudentRecords(studentId: string, phone: string | null | undefined) {
    const result = { submissions: 0, attempts: 0, topicStats: 0, surveys: 0, skipped: '' as string };
    if (await BatchStudent.exists({ _id: studentId })) { result.skipped = 'student is active again'; return result; }

    result.submissions = (await AssignmentSubmission.deleteMany({ student: studentId })).deletedCount || 0;

    const p = (phone || '').trim();
    if (!p) return result;
    const phoneInUse = await BatchStudent.exists({ $or: [{ phoneNumber: p }, { alternativePhone: p }] });
    if (phoneInUse) { result.skipped = 'phone number belongs to an active student'; return result; }

    result.attempts = (await StudentTestAttempt.deleteMany({ studentPhone: p })).deletedCount || 0;
    result.topicStats = (await AttemptTopicStat.deleteMany({ studentPhone: p })).deletedCount || 0;
    result.surveys = (await SurveyResponse.deleteMany({ studentPhone: p })).deletedCount || 0;
    return result;
}

/** Purge every recycle-bin student whose 100 days are over, then remove their archive record. */
export async function purgeDueArchives(limit = 25) {
    const now = new Date();
    const due = await DeletedStudent.find({
        $or: [
            { purgeAt: { $lte: now } },
            { purgeAt: { $exists: false }, deletedAt: { $lte: new Date(now.getTime() - ARCHIVE_DAYS * DAY) } },
            { purgeAt: { $exists: false }, expiresAt: { $lte: now } },
        ],
    }).limit(limit).lean();

    let purged = 0;
    for (const doc of due as any[]) {
        try {
            await purgeStudentRecords(doc.originalId.toString(), doc.studentData?.phoneNumber);
            await DeletedStudent.deleteOne({ _id: doc._id });
            purged++;
        } catch (e) {
            console.error('[studentPurge] failed for', doc._id?.toString(), e);
        }
    }
    return purged;
}
