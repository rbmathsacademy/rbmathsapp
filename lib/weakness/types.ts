export type WeaknessLevel = 'Critical' | 'Weak' | 'Watch';
export type AssignmentQuality = 'GOOD' | 'SATISFACTORY' | 'POOR';

export interface RawSubtopicStat {
    subtopic: string; // the name exactly as stored in the test (may be a variant spelling)
    served: number;
    correct: number;
    skipped: number;
}

/** One topic >> sub-topic-heading where the student is struggling. */
export interface WeaknessEntry {
    topic: string;
    category: string; // cleaned sub-topic heading; "Assignments" for assignment-only entries
    source: 'online' | 'assignments';
    questions: number;
    correct: number;
    skipped: number;
    accuracy: number; // % of questions answered correctly
    batchAccuracy: number | null; // same measure across the whole batch
    testsAppeared: number;
    testsWeak: number; // tests where accuracy was below the per-test threshold
    assignmentAvg: number | null; // 0-100 from teacher ratings on assignments about this topic
    assignmentCount: number;
    score: number; // 0-100 severity
    level: WeaknessLevel;
    rawSubtopics: RawSubtopicStat[];
    reasons: string[];
}

export interface StrengthEntry {
    topic: string;
    category: string;
    questions: number;
    accuracy: number;
    batchAccuracy: number | null;
}

export type AssignmentState = 'RATED' | 'AWAITING_REVIEW' | 'MISSED' | 'PENDING';

export interface StudentAssignmentRow {
    title: string;
    topicLabel: string; // the topic part of the title ("" if the title names none)
    topic: string | null; // matched online-test topic, if any
    deadline: string;
    state: AssignmentState;
    quality: AssignmentQuality | null;
    isLate: boolean;
    submittedAt: string | null;
}

export interface StudentWeakness {
    studentId: string;
    name: string;
    phoneNumber: string;
    schoolName?: string;
    board?: string;
    overall: {
        testsTaken: number;
        avgTestPct: number | null;
        batchAvgTestPct: number | null;
        questionsServed: number;
        accuracy: number | null;
        assignments: { total: number; rated: number; good: number; satisfactory: number; poor: number; awaitingReview: number; missed: number; late: number };
    };
    weaknesses: WeaknessEntry[]; // most severe first
    strengths: StrengthEntry[];
    assignments: StudentAssignmentRow[];
    tests: Array<{ title: string; date: string | null; percentage: number | null }>;
    /** Every topic/sub-topic (as named in the tests) with raw counts — for the AI export. */
    rawBreakdown: Array<{ topic: string; subtopic: string; category: string; served: number; correct: number; skipped: number }>;
}

export interface ScoringConfig {
    minQuestions: number;
    minTestsAppeared: number;
    orMinQuestions: number;
    criticalMinQuestions: number;
    perTestWeakBelow: number;
    levels: {
        critical: { score: number; accuracyBelow: number };
        weak: { score: number; accuracyBelow: number };
        watch: { score: number; accuracyBelow: number };
    };
    assignmentPoints: { GOOD: number; SATISFACTORY: number; POOR: number };
    assignmentPenaltyMax: number;
    assignmentPenaltyStartsBelow: number;
}

export interface WeaknessReport {
    batch: string;
    generatedAt: string;
    config: ScoringConfig;
    students: StudentWeakness[];
    notes: string[];
}
