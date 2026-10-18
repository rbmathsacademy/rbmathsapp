import type { QRef, AnswerRef } from './inputs';

/**
 * Bump this when the way a summary is derived changes, so old summaries are rebuilt.
 */
export const DERIVE_VERSION = 1;

/** One row of a per-attempt summary: how a student fared on one (topic, sub-topic) in one test. */
export interface AttemptGroup {
    t: string; // topic exactly as stored on the question (may be empty or a scratch name)
    s: string; // sub-topic exactly as stored
    n: number; // questions served
    c: number; // answered correctly
    k: number; // left unanswered
}

function isSkipped(a?: AnswerRef): boolean {
    if (!a) return true;
    const v = a.answer;
    return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

/**
 * Reduce one completed attempt to per-(topic, sub-topic) counts. This is the only place that
 * has to read the heavy parts of an attempt (answers + the saved question paper).
 *
 * - Attempts that saved their question paper use it; older ones fall back to the test's own
 *   question list, counting only questions that have an answer row (i.e. were actually served).
 * - Comprehension questions are graded per sub-question, under the parent's topic.
 * - Teacher-graded ("broad") questions are skipped: they have no automatic right/wrong.
 */
export function deriveAttemptGroups(
    attemptQuestions: QRef[] | undefined,
    answers: AnswerRef[],
    testQuestions: QRef[],
): AttemptGroup[] {
    const answerById = new Map(answers.map(a => [a.questionId, a]));
    const hasSnapshot = !!(attemptQuestions && attemptQuestions.length > 0);
    const source = hasSnapshot ? attemptQuestions! : testQuestions;

    const groups = new Map<string, AttemptGroup>();
    const add = (id: string, topic: string, sub: string) => {
        const ans = answerById.get(id);
        if (!hasSnapshot && !ans) return;
        const key = topic + '\u0001' + sub;
        const g = groups.get(key) || groups.set(key, { t: topic, s: sub, n: 0, c: 0, k: 0 }).get(key)!;
        g.n++;
        if (ans?.isCorrect === true) g.c++;
        if (isSkipped(ans)) g.k++;
    };

    for (const q of source) {
        const topic = (q.topic || '').trim();
        const sub = (q.subtopic || '').trim();
        if (q.subQuestions && q.subQuestions.length > 0) {
            q.subQuestions.forEach(sq => add(sq.id, topic, sub));
        } else if (q.type !== 'broad') {
            add(q.id, topic, sub);
        }
    }
    return Array.from(groups.values());
}
