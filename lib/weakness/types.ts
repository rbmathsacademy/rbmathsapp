export type WeaknessLevel = 'Critical' | 'Weak' | 'Watch';
export type AssignmentQuality = 'GOOD' | 'SATISFACTORY' | 'POOR';

export interface RawSubtopicStat {
    subtopic: string; // the name exactly as stored in the test (may be a variant spelling)
    served: number;
    correct: number;
    skipped: number;
}

/** A specific mistake the AI checker noted on a homework question in this area. */
export interface MistakeNote {
    assignment: string;
    question: string;
    outcome: 'INCORRECT' | 'PARTIAL' | 'INCOMPLETE' | 'SKIPPED';
    errorType?: string | null;
    comment: string; // may contain inline LaTeX ($...$)
}

/** One topic >> sub-topic-heading where the student is struggling. */
export interface WeaknessEntry {
    topic: string;
    category: string; // cleaned sub-topic heading; "Assignments" for assignment-only entries
    /** online = tests only, homework = AI-checked homework only, mixed = both, assignments = title/grade fallback */
    source: 'online' | 'homework' | 'mixed' | 'assignments';
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
    /** Split of the evidence: online-test questions vs AI-checked homework questions. */
    fromTests?: { questions: number; correct: number };
    fromHomework?: { questions: number; correct: number; assignments: number };
    /** Kinds of mistakes made here (CALCULATION, CONCEPT ...) with counts. */
    errorTypes?: Record<string, number>;
    mistakes?: MistakeNote[];
}

/** One AI-checked homework of a student, question by question. */
export interface HomeworkCheck {
    title: string;
    deadline: string;
    grade: AssignmentQuality | null;
    totalQuestions: number;
    correct: number;
    incorrect: number;
    skippedOrIncomplete: number;
    questions: Array<{ question: string; topic: string; subtopic: string; outcome: string; errorType?: string | null; comment?: string }>;
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
    aiChecked?: boolean; // question-wise AI check available (used in the topic analysis instead of the grade)
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
        /** AI-checked homework, question level. */
        homework?: { checked: number; questions: number; correct: number; accuracy: number | null; errorProfile: Record<string, number> };
    };
    weaknesses: WeaknessEntry[]; // most severe first
    strengths: StrengthEntry[];
    assignments: StudentAssignmentRow[];
    tests: Array<{ title: string; date: string | null; percentage: number | null }>;
    homeworkChecks?: HomeworkCheck[];
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
