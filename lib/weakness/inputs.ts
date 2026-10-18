import type { AttemptGroup } from './derive';
import type { ScoringConfig } from './types';

export interface QRef {
    id: string;
    type?: string;
    topic?: string;
    subtopic?: string;
    subQuestions?: Array<{ id: string }>;
}
export interface AnswerRef { questionId: string; answer?: any; isCorrect?: boolean }

export interface StudentInput { id: string; name: string; phoneNumber: string; schoolName?: string; board?: string; createdAt?: Date | string }
export interface TestInput { id: string; title: string; date?: Date | string | null }
/** A completed attempt, already reduced to per-(topic, sub-topic) counts. */
export interface AttemptStats { testId: string; studentPhone: string; percentage?: number | null; groups: AttemptGroup[] }
export interface AssignmentInput { id: string; title: string; deadline: Date | string; excluded?: string[] }
export interface SubmissionInput { assignmentId: string; studentId: string; status?: string; quality?: string | null; isLate?: boolean; submittedAt?: Date | string | null }

export interface ComputeInput {
    batch: string;
    students: StudentInput[];
    tests: TestInput[];
    attempts: AttemptStats[];
    assignments: AssignmentInput[];
    submissions: SubmissionInput[];
    /** Current question-bank sub-topic headings per topic, preferred when merging look-alike headings. */
    preferredHeadings?: Record<string, string[]>;
    now?: Date;
    config?: ScoringConfig;
}
