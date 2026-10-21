import { assignmentLabel, matchTopic, sameHeading, type TopicCandidate } from './assignmentTopic';
import type { AttemptStats, ComputeInput, StudentInput } from './inputs';
import { canonicalSubtopic, cleanTopicName, topicFromTestTitle } from './taxonomy';
import type {
    AssignmentQuality, HomeworkCheck, MistakeNote, RawSubtopicStat, ScoringConfig, StrengthEntry, StudentAssignmentRow,
    StudentWeakness, WeaknessEntry, WeaknessLevel, WeaknessReport,
} from './types';
import { ERROR_TYPE_LABEL, questionOutcomes, type ErrorType } from '../aiGrading';

export const DEFAULT_SCORING: ScoringConfig = {
    minQuestions: 5, // a topic needs at least this many questions before it can be called a weakness...
    minTestsAppeared: 2, // ...across at least this many tests...
    orMinQuestions: 8, // ...or this many questions in total
    criticalMinQuestions: 8, // "Critical" needs this much evidence, otherwise it is shown as "Weak"
    perTestWeakBelow: 50, // a test "counts against" a topic when accuracy there is under this %
    levels: {
        critical: { score: 65, accuracyBelow: 45 },
        weak: { score: 50, accuracyBelow: 60 },
        watch: { score: 38, accuracyBelow: 70 },
    },
    assignmentPoints: { GOOD: 100, SATISFACTORY: 60, POOR: 20 },
    assignmentPenaltyMax: 15,
    assignmentPenaltyStartsBelow: 60,
};

interface Acc {
    topic: string;
    category: string;
    served: number;
    correct: number;
    skipped: number;
    perTest: Map<string, { served: number; correct: number }>; // keyed by test id, or "hw:<assignment id>" for homework
    raw: Map<string, RawSubtopicStat>;
    tServed: number; tCorrect: number; // online tests
    hServed: number; hCorrect: number; // AI-checked homework
    errors: Map<string, number>;
    notes: MistakeNote[];
}

const SEP = '\u0001';
const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)); // partly-correct answers count as half
const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString() : null);

function levelFor(score: number, accuracy: number, questions: number, c: ScoringConfig): WeaknessLevel | null {
    if (score >= c.levels.critical.score && accuracy < c.levels.critical.accuracyBelow) {
        return questions >= c.criticalMinQuestions ? 'Critical' : 'Weak';
    }
    if (score >= c.levels.weak.score && accuracy < c.levels.weak.accuracyBelow) return 'Weak';
    if (score >= c.levels.watch.score && accuracy < c.levels.watch.accuracyBelow) return 'Watch';
    return null;
}

interface Row {
    phone: string; testId: string; topic: string; rawSub: string; category: string; n: number; c: number; k: number;
    src: 'test' | 'hw';
    notes?: MistakeNote[];
    errs?: string[];
}

export function computeWeaknessReport(input: ComputeInput): WeaknessReport {
    const config = input.config || DEFAULT_SCORING;
    const now = input.now || new Date();
    const testById = new Map(input.tests.map(t => [t.id, t]));
    const studentByPhone = new Map(input.students.map(s => [s.phoneNumber, s]));

    // ── pass 1: flatten every attempt summary into rows with cleaned topic + first-pass heading ──
    const rows: Row[] = [];
    const attemptsByStudent = new Map<string, AttemptStats[]>();
    const allPercentages: number[] = [];
    for (const a of input.attempts) {
        const student = studentByPhone.get(a.studentPhone);
        const test = testById.get(a.testId);
        if (!student || !test) continue;
        (attemptsByStudent.get(a.studentPhone) || attemptsByStudent.set(a.studentPhone, []).get(a.studentPhone)!).push(a);
        if (typeof a.percentage === 'number') allPercentages.push(a.percentage);
        for (const g of a.groups) {
            const topic = cleanTopicName(g.t) || topicFromTestTitle(test.title);
            rows.push({ phone: a.studentPhone, testId: a.testId, topic, rawSub: g.s, category: canonicalSubtopic(topic, g.s), n: g.n, c: g.c, k: g.k, src: 'test' });
        }
    }

    // ── pass 1b: AI-checked homework, question by question (same topic/sub-topic rows as tests) ──
    const studentById = new Map(input.students.map(s => [s.id, s]));
    const assignmentById = new Map(input.assignments.map(a => [a.id, a]));
    const homeworkByStudent = new Map<string, HomeworkCheck[]>();
    const aiChecked = new Set<string>(); // assignmentId \1 studentId analysed at question level
    for (const sub of input.submissions) {
        const a = assignmentById.get(sub.assignmentId);
        const st = studentById.get(sub.studentId);
        const rv = sub.review;
        // The prepared paper key for the student's board, else the whole paper's key, else the AI's map
        const byBoard = a?.questionMapByBoard || {};
        const map = (st?.board && byBoard[st.board]?.length ? byBoard[st.board] : null) || byBoard['']?.length && byBoard[''] || a?.questionMap || [];
        if (!a || !st || !rv || rv.unreadable || sub.status !== 'CORRECTED' || map.length === 0) continue;
        aiChecked.add(a.id + SEP + st.id);

        const outcomes = questionOutcomes(map, rv.feedback || []);
        const quality = (sub.quality === 'GOOD' || sub.quality === 'SATISFACTORY' || sub.quality === 'POOR') ? (sub.quality as AssignmentQuality) : null;

        // A question with no feedback note is only "correct" if the notes cover every mistake. When
        // the AI left mistakes un-noted (or the topic map is shorter than the paper), the student's
        // remaining correct answers are shared out evenly over the un-noted questions instead, so a
        // topic never looks better than the student's actual counts.
        const unnoted = outcomes.filter(o => o.outcome === 'CORRECT').length;
        const notedSkips = outcomes.filter(o => o.outcome === 'SKIPPED' || o.outcome === 'INCOMPLETE').length;
        const fullyNoted = unnoted <= rv.correct;
        const creditPerUnnoted = unnoted > 0 ? Math.max(0, Math.min(1, rv.correct / unnoted)) : 0;
        const skipPerUnnoted = unnoted > 0 && !fullyNoted
            ? Math.min(1 - creditPerUnnoted, Math.max(0, rv.skippedOrIncomplete - notedSkips) / unnoted)
            : 0;

        (homeworkByStudent.get(st.id) || homeworkByStudent.set(st.id, []).get(st.id)!).push({
            title: a.title, deadline: iso(a.deadline) || '', grade: quality,
            totalQuestions: rv.totalQuestions || map.length, correct: rv.correct, incorrect: rv.incorrect, skippedOrIncomplete: rv.skippedOrIncomplete,
            questions: outcomes.map(o => ({
                question: o.question, topic: o.topic, subtopic: o.subtopic,
                // NOT_NOTED: no note from the checker, and the counts show not all such questions were right
                outcome: o.outcome === 'CORRECT' && !fullyNoted ? 'NOT_NOTED' : o.outcome,
                errorType: o.errorType || null, comment: o.comment || undefined,
            })),
        });

        const groups = new Map<string, Row>();
        for (const o of outcomes) {
            const topic = cleanTopicName(o.topic) || o.topic.trim();
            const rawSub = (o.subtopic || '').trim();
            const key = topic + SEP + rawSub;
            const row = groups.get(key) || groups.set(key, {
                phone: st.phoneNumber, testId: 'hw:' + a.id, topic, rawSub, category: canonicalSubtopic(topic, rawSub),
                n: 0, c: 0, k: 0, src: 'hw', notes: [], errs: [],
            }).get(key)!;
            row.n++;
            if (o.outcome === 'CORRECT') { row.c += fullyNoted ? 1 : creditPerUnnoted; row.k += skipPerUnnoted; }
            else if (o.outcome === 'PARTIAL') row.c += 0.5;
            if (o.outcome === 'SKIPPED' || o.outcome === 'INCOMPLETE') row.k++;
            if (o.outcome !== 'CORRECT') {
                if (o.errorType) row.errs!.push(o.errorType);
                if (o.comment) row.notes!.push({ assignment: a.title, question: o.question, outcome: o.outcome, errorType: o.errorType || null, comment: o.comment });
            }
        }
        groups.forEach(r => rows.push(r));
    }

    // ── pass 2: merge look-alike headings inside each topic ("Substitution" / "Integration by Substitution") ──
    const servedByHeading = new Map<string, number>(); // topic\1category -> questions, whole batch
    rows.forEach(r => servedByHeading.set(r.topic + SEP + r.category, (servedByHeading.get(r.topic + SEP + r.category) || 0) + r.n));
    const headingsByTopic = new Map<string, string[]>();
    servedByHeading.forEach((_, key) => {
        const [topic, cat] = key.split(SEP);
        (headingsByTopic.get(topic) || headingsByTopic.set(topic, []).get(topic)!).push(cat);
    });
    const headingMap = new Map<string, string>(); // topic\1category -> representative heading
    headingsByTopic.forEach((cats, topic) => {
        const parent = new Map(cats.map(c => [c, c]));
        const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
        for (let i = 0; i < cats.length; i++) {
            for (let j = i + 1; j < cats.length; j++) {
                if (sameHeading(cats[i], cats[j])) parent.set(find(cats[i]), find(cats[j]));
            }
        }
        const clusters = new Map<string, string[]>();
        cats.forEach(c => (clusters.get(find(c)) || clusters.set(find(c), []).get(find(c))!).push(c));
        const preferred = new Set((input.preferredHeadings || {})[topic] || []);
        clusters.forEach(members => {
            const rep = members.slice().sort((a, b) =>
                (preferred.has(b) ? 1 : 0) - (preferred.has(a) ? 1 : 0) ||
                (servedByHeading.get(topic + SEP + b) || 0) - (servedByHeading.get(topic + SEP + a) || 0) ||
                a.length - b.length)[0];
            members.forEach(m => headingMap.set(topic + SEP + m, rep));
        });
    });

    // ── pass 3: accumulate per student and for the whole batch ──
    const accByStudent = new Map<string, Map<string, Acc>>();
    const batchAcc = new Map<string, { served: number; correct: number; students: Set<string> }>();
    for (const r of rows) {
        const category = headingMap.get(r.topic + SEP + r.category) || r.category;
        const key = r.topic + SEP + category;
        const accs = accByStudent.get(r.phone) || accByStudent.set(r.phone, new Map()).get(r.phone)!;
        const acc = accs.get(key) || accs.set(key, {
            topic: r.topic, category, served: 0, correct: 0, skipped: 0, perTest: new Map(), raw: new Map(),
            tServed: 0, tCorrect: 0, hServed: 0, hCorrect: 0, errors: new Map(), notes: [],
        }).get(key)!;
        acc.served += r.n; acc.correct += r.c; acc.skipped += r.k;
        if (r.src === 'hw') {
            acc.hServed += r.n; acc.hCorrect += r.c;
            (r.errs || []).forEach(e => acc.errors.set(e, (acc.errors.get(e) || 0) + 1));
            acc.notes.push(...(r.notes || []));
        } else {
            acc.tServed += r.n; acc.tCorrect += r.c;
        }
        const pt = acc.perTest.get(r.testId) || acc.perTest.set(r.testId, { served: 0, correct: 0 }).get(r.testId)!;
        pt.served += r.n; pt.correct += r.c;
        const rawKey = r.rawSub || '(no sub-topic)';
        const rs = acc.raw.get(rawKey) || acc.raw.set(rawKey, { subtopic: rawKey, served: 0, correct: 0, skipped: 0 }).get(rawKey)!;
        rs.served += r.n; rs.correct += r.c; rs.skipped += r.k;
        const b = batchAcc.get(key) || batchAcc.set(key, { served: 0, correct: 0, students: new Set() }).get(key)!;
        b.served += r.n; b.correct += r.c; b.students.add(r.phone);
    }

    const batchAvgTestPct = allPercentages.length ? Math.round(allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length) : null;
    const batchAccuracyOf = (key: string): number | null => {
        const b = batchAcc.get(key);
        return b && b.students.size >= 3 && b.served > 0 ? pct(b.correct, b.served) : null;
    };

    // topics (with their headings and how much data they have) that assignment titles can be matched to
    const candidates: TopicCandidate[] = [];
    {
        const byTopic = new Map<string, TopicCandidate>();
        batchAcc.forEach((b, key) => {
            const [topic, cat] = key.split(SEP);
            const c = byTopic.get(topic) || byTopic.set(topic, { topic, categories: [], weight: 0 }).get(topic)!;
            c.weight += b.served;
            c.categories.push(cat);
        });
        byTopic.forEach(c => candidates.push(c));
    }

    const students: StudentWeakness[] = input.students.map((student: StudentInput) => {
        const accs = accByStudent.get(student.phoneNumber) || new Map<string, Acc>();
        const attempts = attemptsByStudent.get(student.phoneNumber) || [];

        // ── assignments ──
        const joinedAt = student.createdAt ? new Date(student.createdAt) : null;
        const assignmentRows: StudentAssignmentRow[] = [];
        for (const a of input.assignments) {
            if ((a.excluded || []).includes(student.phoneNumber)) continue;
            const deadline = new Date(a.deadline);
            if (joinedAt && joinedAt > deadline) continue; // closed before they joined: not theirs to judge
            const sub = input.submissions.find(s => s.assignmentId === a.id && s.studentId === student.id);
            const label = assignmentLabel(a.title);
            const quality = (sub?.quality === 'GOOD' || sub?.quality === 'SATISFACTORY' || sub?.quality === 'POOR') ? (sub.quality as AssignmentQuality) : null;
            const state: StudentAssignmentRow['state'] = sub && quality ? 'RATED' : sub ? 'AWAITING_REVIEW' : deadline < now ? 'MISSED' : 'PENDING';
            assignmentRows.push({
                title: a.title, topicLabel: label, topic: label ? matchTopic(label, candidates) : null,
                deadline: deadline.toISOString(), state, quality, isLate: !!sub?.isLate, submittedAt: iso(sub?.submittedAt),
                aiChecked: aiChecked.has(a.id + SEP + student.id),
            });
        }
        const rated = assignmentRows.filter(r => r.state === 'RATED');
        const assignmentStats = {
            total: assignmentRows.length,
            rated: rated.length,
            good: rated.filter(r => r.quality === 'GOOD').length,
            satisfactory: rated.filter(r => r.quality === 'SATISFACTORY').length,
            poor: rated.filter(r => r.quality === 'POOR').length,
            awaitingReview: assignmentRows.filter(r => r.state === 'AWAITING_REVIEW').length,
            missed: assignmentRows.filter(r => r.state === 'MISSED').length,
            late: assignmentRows.filter(r => r.isLate).length,
        };
        const ratingsByTopic = new Map<string, { points: number[]; poor: number }>();
        for (const r of rated) {
            if (r.aiChecked) continue; // already counted question by question; the grade-by-title fallback is only for unchecked ones
            const t = r.topic || r.topicLabel;
            if (!t) continue;
            const e = ratingsByTopic.get(t) || ratingsByTopic.set(t, { points: [], poor: 0 }).get(t)!;
            e.points.push(config.assignmentPoints[r.quality!]);
            if (r.quality === 'POOR') e.poor++;
        }
        const assignmentAvgFor = (topic: string) => {
            const e = ratingsByTopic.get(topic);
            return e && e.points.length ? { avg: Math.round(e.points.reduce((a, b) => a + b, 0) / e.points.length), n: e.points.length } : null;
        };

        // ── online-test weaknesses and strengths ──
        const weaknesses: WeaknessEntry[] = [];
        const strengths: StrengthEntry[] = [];
        let served = 0, correct = 0;
        for (const [key, acc] of accs) {
            served += acc.served; correct += acc.correct;
            const accuracy = pct(acc.correct, acc.served);
            const batchAccuracy = batchAccuracyOf(key);
            const testsAppeared = acc.perTest.size;
            const testCount = Array.from(acc.perTest.keys()).filter(k => !k.startsWith('hw:')).length;
            const hwCount = testsAppeared - testCount;
            const enough = acc.served >= config.minQuestions && (testsAppeared >= config.minTestsAppeared || acc.served >= config.orMinQuestions);

            if (enough && accuracy >= 80 && acc.served >= 6 && (batchAccuracy === null || accuracy >= batchAccuracy)) {
                strengths.push({ topic: acc.topic, category: acc.category, questions: acc.served, accuracy, batchAccuracy });
            }
            // Checked homework is detailed evidence: clear trouble there is never diluted away by tests
            const hwTrouble = acc.hServed >= 4 && pct(acc.hCorrect, acc.hServed) < config.levels.weak.accuracyBelow;
            if (!enough && !hwTrouble) continue;

            let testsWeak = 0;
            acc.perTest.forEach(t => { if (t.served > 0 && pct(t.correct, t.served) < config.perTestWeakBelow) testsWeak++; });
            const gap = batchAccuracy !== null ? Math.max(0, batchAccuracy - accuracy) : 0;
            let score = 0.5 * (100 - accuracy) + 0.3 * 100 * (testsWeak / testsAppeared) + 0.2 * Math.min(gap, 50) * 2;

            const asg = assignmentAvgFor(acc.topic);
            let penalty = 0;
            if (asg && asg.avg < config.assignmentPenaltyStartsBelow) {
                penalty = Math.min(config.assignmentPenaltyMax, ((config.assignmentPenaltyStartsBelow - asg.avg) / 40) * config.assignmentPenaltyMax);
            }
            // Agreement between the two kinds of evidence makes a weakness more certain
            const tAcc = acc.tServed >= 3 ? pct(acc.tCorrect, acc.tServed) : null;
            const hAcc = acc.hServed >= 3 ? pct(acc.hCorrect, acc.hServed) : null;
            const bothWeak = tAcc !== null && hAcc !== null && tAcc < 60 && hAcc < 60;
            if (bothWeak) score += 8;
            score = Math.min(100, score + penalty);

            let level = enough ? levelFor(score, accuracy, acc.served, config) : null;
            const hwOnlyFlag = !level && hwTrouble;
            if (hwOnlyFlag) level = 'Watch';
            if (!level) continue;

            const where = [testCount ? `${testCount} test${testCount === 1 ? '' : 's'}` : '', hwCount ? `${hwCount} checked homework${hwCount === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
            const reasons = [`Answered ${fmt(acc.correct)} of ${acc.served} questions correctly (${accuracy}%) across ${where}`];
            if (acc.tServed > 0 && acc.hServed > 0) reasons.push(`Online tests: ${fmt(acc.tCorrect)}/${acc.tServed} correct; homework: ${fmt(acc.hCorrect)}/${acc.hServed} correct`);
            if (hwOnlyFlag) reasons.push(`In checked homework only ${fmt(acc.hCorrect)} of ${acc.hServed} questions were right - worth watching`);
            if (bothWeak) reasons.push('Weak both in online tests and in checked homework - a consistent gap');
            else if (tAcc !== null && hAcc !== null && tAcc >= 70 && hAcc < 60) reasons.push('Fine in tests but makes mistakes in written homework (working / presentation)');
            else if (tAcc !== null && hAcc !== null && hAcc >= 70 && tAcc < 60) reasons.push('Manages in homework but not under test conditions (speed / recall)');
            if (batchAccuracy !== null) reasons.push(`Batch average on this area is ${batchAccuracy}%`);
            if (testsWeak > 0) reasons.push(`Scored below ${config.perTestWeakBelow}% here in ${testsWeak} of ${testsAppeared} papers`);
            const errorEntries = Array.from(acc.errors.entries()).filter(([e]) => e !== 'NOT_ATTEMPTED').sort((a, b) => b[1] - a[1]);
            const errTotal = errorEntries.reduce((s, [, n]) => s + n, 0);
            if (errorEntries.length > 0 && errTotal >= 2) {
                const [top, n] = errorEntries[0];
                reasons.push(`Most common mistake here: ${(ERROR_TYPE_LABEL[top as ErrorType] || top).toLowerCase()} (${n} of ${errTotal})`);
            }
            if (acc.skipped > 0 && acc.skipped / acc.served >= 0.25) reasons.push(`Left ${acc.skipped} of ${acc.served} questions unanswered`);
            if (asg && penalty > 0) reasons.push(`Assignments on this topic average ${asg.avg}/100 by teacher rating`);

            weaknesses.push({
                topic: acc.topic, category: acc.category,
                source: acc.tServed > 0 && acc.hServed > 0 ? 'mixed' : acc.hServed > 0 ? 'homework' : 'online',
                questions: acc.served, correct: acc.correct, skipped: acc.skipped, accuracy, batchAccuracy,
                testsAppeared, testsWeak,
                assignmentAvg: asg ? asg.avg : null, assignmentCount: asg ? asg.n : 0,
                score: Math.round(score), level,
                rawSubtopics: Array.from(acc.raw.values()).sort((a, b) => b.served - a.served),
                reasons,
                fromTests: { questions: acc.tServed, correct: acc.tCorrect },
                fromHomework: { questions: acc.hServed, correct: acc.hCorrect, assignments: hwCount },
                errorTypes: Object.fromEntries(acc.errors),
                mistakes: acc.notes
                    .slice()
                    .sort((a, b) => (a.outcome === 'SKIPPED' ? 1 : 0) - (b.outcome === 'SKIPPED' ? 1 : 0))
                    .slice(0, 6),
            });
        }

        // ── weakness shown only by teacher ratings on assignments ──
        ratingsByTopic.forEach((e, topic) => {
            if (weaknesses.some(w => w.topic === topic)) return;
            const n = e.points.length;
            const avg = Math.round(e.points.reduce((a, b) => a + b, 0) / n);
            const level: WeaknessLevel | null = avg < 30 && n >= 3 ? 'Critical' : avg < 45 && n >= 2 ? 'Weak' : avg < 60 ? 'Watch' : null;
            if (!level) return;
            weaknesses.push({
                topic, category: 'Assignments', source: 'assignments',
                questions: 0, correct: 0, skipped: 0, accuracy: avg, batchAccuracy: null,
                testsAppeared: 0, testsWeak: 0, assignmentAvg: avg, assignmentCount: n,
                score: 100 - avg, level, rawSubtopics: [],
                reasons: [`${n} assignment${n === 1 ? '' : 's'} on this topic${e.poor > 0 ? ` (${e.poor} rated Poor)` : ''} average ${avg}/100 by teacher rating`],
            });
        });

        weaknesses.sort((a, b) => b.score - a.score || b.questions - a.questions);
        strengths.sort((a, b) => b.accuracy - a.accuracy || b.questions - a.questions);

        const pcts = attempts.map(a => a.percentage).filter((p): p is number => typeof p === 'number');
        const homeworkChecks = (homeworkByStudent.get(student.id) || []).sort((a, b) => b.deadline.localeCompare(a.deadline));
        const errorProfile: Record<string, number> = {};
        let hwQuestions = 0, hwCorrect = 0;
        for (const h of homeworkChecks) {
            // Totals from the student's own counts (always complete), not from the per-question notes
            hwQuestions += h.totalQuestions;
            hwCorrect += h.correct;
            for (const q of h.questions) {
                if (q.outcome !== 'CORRECT' && q.outcome !== 'NOT_NOTED' && q.errorType) errorProfile[q.errorType] = (errorProfile[q.errorType] || 0) + 1;
            }
        }
        const rawBreakdown: StudentWeakness['rawBreakdown'] = [];
        accs.forEach(acc => acc.raw.forEach(r => rawBreakdown.push({ topic: acc.topic, subtopic: r.subtopic, category: acc.category, served: r.served, correct: r.correct, skipped: r.skipped })));
        rawBreakdown.sort((a, b) => a.topic.localeCompare(b.topic) || a.subtopic.localeCompare(b.subtopic));

        return {
            studentId: student.id, name: student.name, phoneNumber: student.phoneNumber, schoolName: student.schoolName, board: student.board,
            overall: {
                testsTaken: attempts.length,
                avgTestPct: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
                batchAvgTestPct,
                questionsServed: served,
                accuracy: served > 0 ? pct(correct, served) : null,
                assignments: assignmentStats,
                homework: { checked: homeworkChecks.length, questions: hwQuestions, correct: hwCorrect, accuracy: hwQuestions ? pct(hwCorrect, hwQuestions) : null, errorProfile },
            },
            weaknesses,
            strengths: strengths.slice(0, 6),
            assignments: assignmentRows.sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime()),
            tests: attempts
                .map(a => ({ title: testById.get(a.testId)?.title || '', date: iso(testById.get(a.testId)?.date), percentage: typeof a.percentage === 'number' ? a.percentage : null }))
                .sort((a, b) => (a.date || '').localeCompare(b.date || '')),
            rawBreakdown,
            homeworkChecks,
        };
    });

    students.sort((a, b) => a.name.localeCompare(b.name));
    return {
        batch: input.batch,
        generatedAt: now.toISOString(),
        config,
        students,
        notes: [
            'Evidence comes from completed online-test attempts and from AI-checked homework (question by question, mapped to topic and sub-topic). Teacher-graded (descriptive) online-test questions are excluded.',
            'In checked homework a partly correct answer counts as half; skipped or unfinished questions count as not correct.',
            'Homework that was graded without the AI check is used only through its overall grade (topic taken from the assignment title).',
            'Questions left unanswered count as not correct.',
            'Sub-topic names stored in older tests are mapped onto the current question-bank headings; look-alike headings within a topic are merged, and names that cannot be mapped are shown as they were stored.',
        ],
    };
}
