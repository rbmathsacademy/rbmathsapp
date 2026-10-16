// How long a deleted question stays recoverable in the trash before MongoDB
// permanently removes it. Enforced by the TTL index in models/Question.ts, so it
// needs no cron job and no one has to open the trash page for it to happen.
export const QUESTION_TRASH_RETENTION_DAYS = 100;
export const QUESTION_TRASH_RETENTION_SECONDS = QUESTION_TRASH_RETENTION_DAYS * 24 * 60 * 60;

export function daysUntilPurge(deletedAt: string | Date | null | undefined): number | null {
    if (!deletedAt) return null;
    const purgeAt = new Date(deletedAt).getTime() + QUESTION_TRASH_RETENTION_SECONDS * 1000;
    return Math.max(0, Math.ceil((purgeAt - Date.now()) / 86400000));
}
