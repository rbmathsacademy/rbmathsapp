// Shared helpers for resolving a student's board and their assigned question set
// for board-specific online tests. Never silently default to "the first split" —
// an unresolved board must be treated as unresolved by every caller.

export function resolveStudentBoard(dbStudent: any, extraCourses: string[] = []): string {
    const rawBoard = ((dbStudent as any)?.board || '').trim();
    if (rawBoard && rawBoard !== 'Others') return rawBoard;

    const combined = [...((dbStudent as any)?.courses || []), ...extraCourses].join(' ').toUpperCase();
    if (combined.includes('WBCHSE') || combined.includes('WB BOARD') || combined.includes('WEST BENGAL')) {
        return 'WBCHSE';
    } else if (combined.includes('ISC') || combined.includes('ICSE')) {
        return 'ISC';
    } else if (combined.includes('CBSE')) {
        return 'CBSE';
    }
    return rawBoard; // '' or 'Others' — genuinely unresolved
}

export function findBoardSet(boardQuestionSets: any[], studentBoard: string): any | null {
    const cleanBoard = (studentBoard || '').trim().toLowerCase();
    if (!cleanBoard) return null;
    return boardQuestionSets.find((set: any) =>
        (set.boards || []).some((b: string) => b.trim().toLowerCase() === cleanBoard)
    ) || null;
}

/**
 * Resolves which question set a student should be served for a board-specific test.
 * Returns `null` when the board cannot be matched — callers MUST treat this as
 * "access blocked", never fall back to boardQuestionSets[0]. Falling back to the
 * first split is how ISC students previously received CBSE questions.
 */
export function resolveBoardQuestions(test: any, studentBoard: string): any[] | null {
    if (!test.isBoardSpecific || !test.boardQuestionSets || test.boardQuestionSets.length === 0) {
        return test.questions ? [...test.questions] : [];
    }
    const assignedSet = findBoardSet(test.boardQuestionSets, studentBoard);
    return assignedSet ? [...assignedSet.questions] : null;
}

/**
 * For re-grading/review fallback paths only (when an attempt has no stored question
 * snapshot to grade against). Since question ids are unique across all board sets,
 * grading from the union is always correct regardless of which split the student
 * actually saw — unlike guessing a single board, which risks grading against the
 * wrong answer key entirely.
 */
export function unionBoardQuestions(test: any): any[] {
    if (test.isBoardSpecific && test.boardQuestionSets && test.boardQuestionSets.length > 0) {
        return test.boardQuestionSets.flatMap((s: any) => s.questions || []);
    }
    return test.questions ? [...test.questions] : [];
}
