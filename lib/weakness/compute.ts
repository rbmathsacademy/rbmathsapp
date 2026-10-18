import { assignmentLabel, matchTopic, sameHeading, type TopicCandidate } from './assignmentTopic';
import type { AttemptStats, ComputeInput, StudentInput } from './inputs';
import { canonicalSubtopic, cleanTopicName, topicFromTestTitle } from './taxonomy';
import type {
    AssignmentQuality, RawSubtopicStat, ScoringConfig, StrengthEntry, StudentAssignmentRow,
    StudentWeakness, WeaknessEntry, WeaknessLevel, WeaknessReport,
} from './types';

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
    perTest: Map<string, { served: number; correct: number }>;
    raw: Map<string, RawSubtopicStat>;
}

const SEP = '\u0001';
const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);
const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString() : null);

function levelFor(score: number, accuracy: number, questions: number, c: ScoringConfig): WeaknessLevel | null {
    if (score >= c.levels.critical.score && accuracy < c.levels.critical.accuracyBelow) {
        return questions >= c.criticalMinQuestions ? 'Critical' : 'Weak';
    }
    if (score >= c.levels.weak.score && accuracy < c.levels.weak.accuracyBelow) return 'Weak';
    if (score >= c.levels.watch.score && accuracy < c.levels.watch.accuracyBelow) return 'Watch';
    return null;
}

interface Row { phone: string; testId: string; topic: string; rawSub: string; category: string; n: number; c: number; k: number }

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
            rows.push({ phone: a.studentPhone, testId: a.testId, topic, rawSub: g.s, category: canonicalSubtopic(topic, g.s), n: g.n, c: g.c, k: g.k });
        }
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
        const acc = accs.get(key) || accs.set(key, { topic: r.topic, category, served: 0, correct: 0, skipped: 0, perTest: new Map(), raw: new Map() }).get(key)!;
        acc.served += r.n; acc.correct += r.c; acc.skipped += r.k;
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
            const enough = acc.served >= config.minQuestions && (testsAppeared >= config.minTestsAppeared || acc.served >= config.orMinQuestions);

            if (enough && accuracy >= 80 && acc.served >= 6 && (batchAccuracy === null || accuracy >= batchAccuracy)) {
                strengths.push({ topic: acc.topic, category: acc.category, questions: acc.served, accuracy, batchAccuracy });
            }
            if (!enough) continue;

            let testsWeak = 0;
            acc.perTest.forEach(t => { if (t.served > 0 && pct(t.correct, t.served) < config.perTestWeakBelow) testsWeak++; });
            const gap = batchAccuracy !== null ? Math.max(0, batchAccuracy - accuracy) : 0;
            let score = 0.5 * (100 - accuracy) + 0.3 * 100 * (testsWeak / testsAppeared) + 0.2 * Math.min(gap, 50) * 2;

            const asg = assignmentAvgFor(acc.topic);
            let penalty = 0;
            if (asg && asg.avg < config.assignmentPenaltyStartsBelow) {
                penalty = Math.min(config.assignmentPenaltyMax, ((config.assignmentPenaltyStartsBelow - asg.avg) / 40) * config.assignmentPenaltyMax);
            }
            score = Math.min(100, score + penalty);

            const level = levelFor(score, accuracy, acc.served, config);
            if (!level) continue;

            const reasons = [`Answered ${acc.correct} of ${acc.served} questions correctly (${accuracy}%) across ${testsAppeared} test${testsAppeared === 1 ? '' : 's'}`];
            if (batchAccuracy !== null) reasons.push(`Batch average on this area is ${batchAccuracy}%`);
            if (testsWeak > 0) reasons.push(`Scored below ${config.perTestWeakBelow}% here in ${testsWeak} of ${testsAppeared} tests`);
            if (acc.skipped > 0 && acc.skipped / acc.served >= 0.25) reasons.push(`Left ${acc.skipped} of ${acc.served} questions unanswered`);
            if (asg && penalty > 0) reasons.push(`Assignments on this topic average ${asg.avg}/100 by teacher rating`);

            weaknesses.push({
                topic: acc.topic, category: acc.category, source: 'online',
                questions: acc.served, correct: acc.correct, skipped: acc.skipped, accuracy, batchAccuracy,
                testsAppeared, testsWeak,
                assignmentAvg: asg ? asg.avg : null, assignmentCount: asg ? asg.n : 0,
                score: Math.round(score), level,
                rawSubtopics: Array.from(acc.raw.values()).sort((a, b) => b.served - a.served),
                reasons,
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
            },
            weaknesses,
            strengths: strengths.slice(0, 6),
            assignments: assignmentRows.sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime()),
            tests: attempts
                .map(a => ({ title: testById.get(a.testId)?.title || '', date: iso(testById.get(a.testId)?.date), percentage: typeof a.percentage === 'number' ? a.percentage : null }))
                .sort((a, b) => (a.date || '').localeCompare(b.date || '')),
            rawBreakdown,
        };
    });

    students.sort((a, b) => a.name.localeCompare(b.name));
    return {
        batch: input.batch,
        generatedAt: now.toISOString(),
        config,
        students,
        notes: [
            'Only completed online-test attempts are used. Teacher-graded (descriptive) questions are excluded because they have no automatic right/wrong.',
            'Questions left unanswered count as not correct.',
            'Sub-topic names stored in older tests are mapped onto the current question-bank headings; look-alike headings within a topic are merged, and names that cannot be mapped are shown as they were stored.',
        ],
    };
}
