/**
 * Who an assignment is for. By default it is the whole batch minus the students the admin excluded.
 * When "selected students" were chosen at creation (`targetStudents` = phone numbers), only those
 * students are part of it: everyone else - including students who join the batch later - is out of scope.
 */
export interface ScopedAssignment { excludedStudents?: string[] | null; targetStudents?: string[] | null }

export function isTargeted(a: ScopedAssignment): boolean {
    return (a.targetStudents || []).length > 0;
}

/** True when this student should not see / be counted for the assignment at all. */
export function isOutOfScope(a: ScopedAssignment, phone: string): boolean {
    if ((a.excludedStudents || []).includes(phone)) return true;
    return isTargeted(a) && !(a.targetStudents || []).includes(phone);
}
