/**
 * Unlimited access: a student the admin has given "unlimited access" until a chosen date (`unlimitedUntil`).
 * While it lasts: every online test already started and every assignment of the batch (also ones from before
 * the student joined, and ones that were missed) is open to them, and deadlines / test ends are shown as the
 * access expiry. The moment it expires everything is computed from the real deadlines again - nothing is
 * stored, so there is nothing to clean up.
 */
const FOREVER = new Date('2100-01-01T00:00:00Z'); // old unlimited students that were set without an end date

export interface UnlimitedStudent { noExpiry?: boolean | null; unlimitedUntil?: Date | string | null }

/** The expiry date while the student's unlimited access is active, otherwise null. */
export function unlimitedExpiry(student: UnlimitedStudent | null | undefined, now: Date = new Date()): Date | null {
    if (!student?.noExpiry) return null;
    if (!student.unlimitedUntil) return FOREVER;
    const until = new Date(student.unlimitedUntil);
    return until.getTime() > now.getTime() ? until : null;
}

/** The later of the real date and the access expiry (the date shown to the student). */
export function stretchTo(real: Date | string | null | undefined, until: Date | null): Date | null {
    const r = real ? new Date(real) : null;
    if (!until) return r;
    return !r || until.getTime() > r.getTime() ? until : r;
}

/** ISO string for the student-facing note; null for "forever" (old setting) or inactive. */
export function unlimitedNoteDate(until: Date | null): string | null {
    return until && until.getTime() < FOREVER.getTime() ? until.toISOString() : null;
}
