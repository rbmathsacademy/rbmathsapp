// Shared (client + server) logic for checking PDF assignments with an AI chat assistant.
//
// Flow: the admin downloads merged PDFs (question paper + up to 10 submissions, each preceded by a
// separator page carrying a submission CODE), uploads them to the AI chat with the prompt built
// here, then pastes the AI's JSON reply back into the portal, which parses it with
// parseAiGradingReply() and saves it.

export type FeedbackStatus = 'INCORRECT' | 'PARTIAL' | 'INCOMPLETE' | 'SKIPPED';
export type Grade = 'GOOD' | 'SATISFACTORY' | 'POOR';

/** What kind of mistake it was - used to find each student's error pattern. */
export type ErrorType = 'CONCEPT' | 'METHOD' | 'FORMULA' | 'CALCULATION' | 'SIGN' | 'INCOMPLETE_STEPS' | 'NOT_ATTEMPTED' | 'OTHER';
export const ERROR_TYPES: ErrorType[] = ['CONCEPT', 'METHOD', 'FORMULA', 'CALCULATION', 'SIGN', 'INCOMPLETE_STEPS', 'NOT_ATTEMPTED', 'OTHER'];
export const ERROR_TYPE_LABEL: Record<ErrorType, string> = {
    CONCEPT: 'Concept gap', METHOD: 'Wrong method', FORMULA: 'Formula/identity error', CALCULATION: 'Calculation slip',
    SIGN: 'Sign error', INCOMPLETE_STEPS: 'Incomplete working', NOT_ATTEMPTED: 'Not attempted', OTHER: 'Other',
};

export interface AiFeedbackItem {
    question: string;
    status: FeedbackStatus;
    comment: string;
    errorType?: ErrorType;
}

/** Which topic / sub-topic each question of the paper belongs to (same for every student). */
export interface QuestionTopic { question: string; topic: string; subtopic: string }
export interface TaxonomyTopic { topic: string; subtopics: string[] }

/** "Q 6(b)" / "6b" / "6" -> "6": questions are matched on their main number. */
export function questionKey(q: string): string {
    const s = String(q || '').trim().replace(/^q(uestion)?\.?\s*/i, '');
    const m = s.match(/^(\d+)/);
    return m ? m[1] : s.toLowerCase().replace(/\s+/g, '');
}

export type QuestionOutcome = 'CORRECT' | FeedbackStatus;

/**
 * Per-question result for one student: questions with no feedback item are correct; several
 * items for one main question (6(a), 6(b)) collapse to the worst of them.
 */
export function questionOutcomes(map: QuestionTopic[], feedback: AiFeedbackItem[]) {
    const rank: Record<string, number> = { INCORRECT: 4, PARTIAL: 3, INCOMPLETE: 2, SKIPPED: 1 };
    const byKey = new Map<string, AiFeedbackItem[]>();
    for (const f of feedback || []) {
        const k = questionKey(f.question);
        (byKey.get(k) || byKey.set(k, []).get(k)!).push(f);
    }
    return map.map(q => {
        const items = byKey.get(questionKey(q.question)) || [];
        const worst = items.slice().sort((a, b) => (rank[b.status] || 0) - (rank[a.status] || 0))[0];
        return {
            question: q.question, topic: q.topic, subtopic: q.subtopic,
            outcome: (worst ? worst.status : 'CORRECT') as QuestionOutcome,
            errorType: worst?.errorType,
            comment: items.map(i => i.comment).filter(Boolean).join(' '),
        };
    });
}

export interface AiReview {
    totalQuestions: number;
    correct: number;
    incorrect: number;
    skippedOrIncomplete: number;
    unreadable: boolean;
    unreadableNote: string;
    summary: string;
    feedback: AiFeedbackItem[];
    aiGrade: string | null;
    importedAt?: string;
}

/** Short code identifying a submission on separator pages and in the AI's reply. */
export function submissionCode(submissionId: string): string {
    return submissionId.slice(-6).toUpperCase();
}

/** Short code identifying the assignment, so a reply can't be pasted into the wrong assignment. */
export function assignmentCode(assignmentId: string): string {
    return assignmentId.slice(-6).toUpperCase();
}

/**
 * The grading rule (applied by the portal, not trusted to the AI's arithmetic):
 *  GOOD  - attempted at least 90% of the questions AND at least 90% of the attempted ones correct
 *  POOR  - more than 70% of the questions skipped/incomplete, or more than 70% wrong or skipped/incomplete
 *  SATISFACTORY - everything else
 */
export function computeGrade(r: { totalQuestions: number; correct: number; incorrect: number; skippedOrIncomplete: number }): Grade {
    const total = r.totalQuestions > 0 ? r.totalQuestions : r.correct + r.incorrect + r.skippedOrIncomplete;
    if (total <= 0) return 'POOR';
    const attempted = r.correct + r.incorrect;
    if (r.skippedOrIncomplete > 0.7 * total || r.incorrect + r.skippedOrIncomplete > 0.7 * total) return 'POOR';
    if (attempted >= 0.9 * total && attempted > 0 && r.correct >= 0.9 * attempted) return 'GOOD';
    return 'SATISFACTORY';
}

export interface PromptStudent { code: string; name: string }

export function buildGradingPrompt(opts: {
    assignmentId: string;
    title: string;
    board?: string | null;
    batchNo: number;
    batchCount: number;
    students: PromptStudent[];
    /** Topic / sub-topic names used in this batch's question bank, so the AI reuses them. */
    taxonomy?: TaxonomyTopic[];
    /** The paper's fixed question list (from "Prepare paper"), and whether the teacher's solutions are in the PDF. */
    paperKey?: { questions: PaperKeyQuestion[]; hasSolutionsPdf?: boolean } | null;
}): string {
    const { assignmentId, title, board, batchNo, batchCount, students, taxonomy = [], paperKey } = opts;
    const list = students.map((s, i) => `${i + 1}. CODE ${s.code} - ${s.name}`).join('\n');
    const names = taxonomy.length
        ? taxonomy.map(t => `- ${t.topic}: ${t.subtopics.length ? t.subtopics.join('; ') : '(no sub-topics yet)'}`).join('\n')
        : '(none available - use standard textbook chapter and sub-topic names)';
    const keyQs = paperKey?.questions?.length ? paperKey.questions : null;
    const solutionsLine = paperKey?.hasSolutionsPdf
        ? `- Right after the question paper come the TEACHER'S SOLUTIONS (after a page titled "TEACHER'S SOLUTIONS"). They are the answer key: compare every student's work with them. They are NOT a student submission.\n`
        : '';
    const paperLine = keyQs
        ? `- The first page(s) are the QUESTION PAPER. The teacher's answer key for every question is given below under "FIXED QUESTION LIST": check the students' work against it.`
        : solutionsLine
            ? `- The first page(s) are the QUESTION PAPER.`
            : `- The first page(s) are the QUESTION PAPER. There is no solution guide: solve the questions yourself to check the students' work.`;
    const keySection = keyQs ? `
FIXED QUESTION LIST (prepared by the teacher - use it exactly)
- The paper has exactly ${keyQs.length} questions, so "totalQuestions" is ${keyQs.length} for every student. Use exactly these question numbers.
- Copy this list into "questions" unchanged (question, topic, subtopic).
- "Key" is the expected final answer. Accept any equivalent form and any valid method. Only if you are certain a key is wrong, judge that question by correct mathematics.
${keyQs.map(q => `Q${q.question} | ${q.topic} > ${q.subtopic || '-'} | Key: ${q.answer || '(see solutions)'}`).join('\n')}
` : `
TOPIC MAP OF THE QUESTION PAPER (same for every student)
- In "questions", list EVERY question of the paper once, with the "topic" (chapter) and "subtopic" (the specific kind of problem) it tests.
- Prefer these topic and sub-topic names from the teacher's question bank, copied exactly; only invent a short, standard name when none fits:
${names}
`;
    return `You are an experienced and fair mathematics teacher checking handwritten homework.

THE ATTACHED PDF
- File: "${title}"${board ? ` (${board} board)` : ''}, batch ${batchNo} of ${batchCount}.
${paperLine}
${solutionsLine}- Then come the students' answer sheets (photos of handwritten pages). Each student's work begins right after a separator page titled "STUDENT SUBMISSION" that shows the student's CODE and name. Everything after that page, up to the next separator page or the final "END OF BATCH" page, belongs to that student only.
- This batch contains exactly ${students.length} student(s), in this order:
${list}
- Every student above HAS a separator page and answer pages in the file. Read EVERY page of the file before you answer; do not report a student's work as missing - find their separator page and check the pages after it. Only use "unreadable" when the pages really cannot be read.

HOW TO CHECK EACH QUESTION
1. Count each numbered question of the question paper as ONE question (sub-parts like (a), (b) belong to their question). Use the same total for every student.
2. Classify every question for every student into exactly one of:
   - correct: the approach is valid and the final answer is right;
   - incorrect: attempted and finished, but the method or the final answer is wrong, including partly correct work (use status INCORRECT or PARTIAL);
   - skipped or incomplete: not attempted, or left unfinished (use status SKIPPED or INCOMPLETE).
   So for every student: correct + incorrect + skippedOrIncomplete = totalQuestions.
3. Be open to different methods. A student may use any valid method, order of steps or notation (e.g. a different substitution, integrating by parts instead of a formula, a graphical argument). Do not mark something wrong just because it differs from your own solution. Judge the approach and the answer, not the style. Ignore small presentation issues and an equivalent answer in a different but correct form.
4. If a student's handwriting or photos are too unclear to judge (blurred, cut off, too dark), or the pages belong to a different assignment, or the file says it could not be loaded, set "unreadable": true and explain briefly in "unreadableNote". Still fill in the counts for whatever you could read.

GRADE (use exactly these words)
- "GOOD": the student attempted at least 90% of the questions and at least 90% of the attempted questions are correct.
- "POOR": the student skipped/left incomplete more than 70% of the questions, or got more than 70% of the questions wrong or skipped/incomplete.
- "SATISFACTORY": anything else.

FEEDBACK FOR THE STUDENT (it will be shown to the student)
- Add one feedback item for every question that is INCORRECT, PARTIAL, INCOMPLETE or SKIPPED, using the question number exactly as printed in the question paper (e.g. "4" or "7(b)").
- For INCORRECT / PARTIAL / INCOMPLETE: say specifically where it went wrong or what is missing and how to fix it (the mistaken step, the misused formula, the sign error ...). Be kind, specific and brief (1-3 sentences). Do not just write the whole solution.
- For SKIPPED: a short line such as "Not attempted - revise ... and try it."
- "summary": 1-2 encouraging sentences on the overall work.
- Write ALL mathematics in LaTeX between single dollar signs, e.g. $\\\\int x^2\\\\,dx = \\\\frac{x^3}{3} + C$. Never use $$ ... $$, Markdown or line breaks inside the text.
- Do NOT add citations or source markers such as [cite: 7], [cite_start] or page references anywhere in the text; the student only sees your sentences.
- Give every feedback item an "errorType", the main kind of mistake: "CONCEPT" (does not understand the idea), "METHOD" (wrong or unsuitable approach), "FORMULA" (wrong formula or identity), "CALCULATION" (arithmetic or algebra slip), "SIGN" (sign error), "INCOMPLETE_STEPS" (right idea but working left unfinished or unjustified), "NOT_ATTEMPTED" (skipped), or "OTHER".
${keySection}
OUTPUT
Reply with ONLY one JSON code block, no other text, in exactly this shape:
\`\`\`json
{
  "assignmentCode": "${assignmentCode(assignmentId)}",
  "totalQuestions": 10,
  "questions": [
    { "question": "1", "topic": "Trigonometric Functions", "subtopic": "Multiple and sub-multiple angles" },
    { "question": "2", "topic": "Trigonometric Functions", "subtopic": "Conditional identities" }
  ],
  "results": [
    {
      "code": "ABC123",
      "name": "Student name as printed on the separator page",
      "unreadable": false,
      "unreadableNote": "",
      "correct": 7,
      "incorrect": 2,
      "skippedOrIncomplete": 1,
      "grade": "SATISFACTORY",
      "summary": "Good effort overall ...",
      "feedback": [
        { "question": "3", "status": "INCORRECT", "errorType": "FORMULA", "comment": "The derivative of $\\\\tan x$ is $\\\\sec^2 x$, not $\\\\sec x$; recheck step 2." },
        { "question": "6(b)", "status": "PARTIAL", "errorType": "CALCULATION", "comment": "..." },
        { "question": "9", "status": "SKIPPED", "errorType": "NOT_ATTEMPTED", "comment": "Not attempted ..." }
      ]
    }
  ]
}
\`\`\`
Rules for the JSON:
- One object in "results" for EVERY student listed above (all ${students.length}), even if their pages are missing (then mark unreadable).
- "code" and "name" must be copied exactly from the list above (same spelling, character by character).
- It must be valid JSON: inside strings write every LaTeX backslash doubled (\\\\frac, \\\\sqrt, \\\\int), and use only straight double quotes for JSON keys and strings.

SELF-CHECK BEFORE YOU ANSWER (fix the JSON until all of these are true)
- "questions" has exactly "totalQuestions" entries - one for every question of the paper, none left out.
- For every student: correct + incorrect + skippedOrIncomplete = totalQuestions.
- For every student: "feedback" has one item for EACH question that is not fully correct, so the number of feedback items is at least incorrect + skippedOrIncomplete. Never summarise several questions in one item and never leave a wrong or skipped question without its item.`;
}

// ---------------------------------------------------------------- parsing the AI's reply

/**
 * Removes the source markers the Gemini app adds when answering about an uploaded file, e.g.
 * "[cite: 7]", "[cite: 9, 10]", "[cite_start]", "[source: 3]", "【5†source】". They point at chunks
 * of the uploaded PDF and mean nothing to a student.
 */
export function stripCitations(text: string): string {
    return (text || '')
        .replace(/\s*\[(?:cite|source|citation)s?(?:_start|_end)?(?:\s*:\s*[\d\s,\-–]*)?\]/gi, '')
        .replace(/\s*【[^】]*】/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

// LaTeX commands that begin with a letter that is ALSO a JSON escape (\n \t \b \f \r). When an AI
// forgets to double the backslash, "\frac" would silently become a form feed + "rac", so these
// are recognised by name and repaired.
const LATEX_WORDS_WITH_JSON_ESCAPE_START = new Set([
    'neq', 'ne', 'nabla', 'neg', 'not', 'nu', 'ni', 'nmid', 'nleq', 'ngeq', 'newline', 'notin', 'nexists',
    'times', 'theta', 'tan', 'tanh', 'text', 'textbf', 'textit', 'textrm', 'to', 'tau', 'therefore', 'tfrac', 'top', 'tilde', 'triangle', 'tdots',
    'beta', 'binom', 'bar', 'because', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'bot', 'boxed', 'bmatrix', 'bullet', 'begin', 'bf', 'bmod', 'breve',
    'frac', 'forall', 'flat', 'frown',
    'right', 'rho', 'rightarrow', 'Rightarrow', 'rm', 'rangle', 'rfloor', 'rceil', 'rbrace', 'rvert', 'rVert',
]);

/**
 * Doubles single LaTeX backslashes inside JSON strings so the JSON parses and the LaTeX survives.
 * "\\frac" (already correct) is left alone; "\frac" becomes "\\frac"; a genuine JSON escape such
 * as "\n" followed by ordinary text ("\nThe") is kept, since it isn't a LaTeX command name.
 */
function repairLatexBackslashes(json: string): string {
    return json.replace(/"(?:[^"\\]|\\.)*"/g, (str) =>
        str.replace(/(^|[^\\])((?:\\\\)*)\\([A-Za-z]+)/g, (m, pre, evenSlashes, word) => {
            const first = word[0];
            if ('nrtbf'.includes(first) && !LATEX_WORDS_WITH_JSON_ESCAPE_START.has(word)) return m;
            if (first === 'u' && /^u[0-9a-fA-F]{4}/.test(word)) return m; // é style escape
            return `${pre}${evenSlashes}\\\\${word}`;
        }),
    );
}

function extractJsonText(raw: string): string {
    let t = raw.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
    // Curly quotes sometimes sneak in from chat UIs
    return t.replace(/[“”]/g, '"').replace(/ /g, ' ');
}

export interface ParsedAiResult {
    code: string;
    name: string;
    review: AiReview;
    computedGrade: Grade | null; // null when unreadable (left for manual checking)
    warnings: string[];
}

export interface ParsedAiReply {
    assignmentCode: string | null;
    totalQuestions: number;
    questions: QuestionTopic[];
    results: ParsedAiResult[];
    errors: string[];
    /** Problems with the reply as a whole (e.g. topic map shorter than the paper). */
    warnings: string[];
}

const toInt = (v: any) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
};

function normErrorType(v: any, status: any): ErrorType {
    const t = String(v ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if ((ERROR_TYPES as string[]).includes(t)) return t as ErrorType;
    if (/CALC|ARITH|ALGEBRA/.test(t)) return 'CALCULATION';
    if (/CONCEPT/.test(t)) return 'CONCEPT';
    if (/FORMULA|IDENTITY/.test(t)) return 'FORMULA';
    if (/INCOMPLETE|UNFINISHED|STEP/.test(t)) return 'INCOMPLETE_STEPS';
    const st = String(status ?? '').toUpperCase();
    if (/SKIP|NOT.?ATTEMPT/.test(t) || st === 'SKIPPED' || st === 'NOT_ATTEMPTED') return 'NOT_ATTEMPTED';
    return 'OTHER';
}

const STATUS_ALIASES: Record<string, FeedbackStatus> = {
    INCORRECT: 'INCORRECT', WRONG: 'INCORRECT', ERROR: 'INCORRECT',
    PARTIAL: 'PARTIAL', PARTIALLY_CORRECT: 'PARTIAL', 'PARTIALLY CORRECT': 'PARTIAL',
    INCOMPLETE: 'INCOMPLETE', UNFINISHED: 'INCOMPLETE',
    SKIPPED: 'SKIPPED', NOT_ATTEMPTED: 'SKIPPED', 'NOT ATTEMPTED': 'SKIPPED', MISSING: 'SKIPPED',
};

/** Parse and validate the JSON the admin pasted from the AI chat. Never throws. */
export function parseAiGradingReply(raw: string): ParsedAiReply {
    const out: ParsedAiReply = { assignmentCode: null, totalQuestions: 0, questions: [], results: [], errors: [], warnings: [] };
    if (!raw || !raw.trim()) { out.errors.push('Nothing was pasted.'); return out; }

    const text = extractJsonText(raw);
    let data: any;
    try {
        data = JSON.parse(repairLatexBackslashes(text));
    } catch (e1: any) {
        try { data = JSON.parse(text); } catch {
            out.errors.push(`The reply is not valid JSON (${e1.message}). Ask the AI to "return only the JSON code block" and paste again.`);
            return out;
        }
    }
    // Accept a bare array of results too
    if (Array.isArray(data)) data = { results: data };
    if (!data || !Array.isArray(data.results)) {
        out.errors.push('The JSON has no "results" list.');
        return out;
    }

    out.assignmentCode = data.assignmentCode ? String(data.assignmentCode).trim().toUpperCase() : null;
    out.totalQuestions = toInt(data.totalQuestions);
    if (Array.isArray(data.questions)) {
        const seen = new Set<string>();
        for (const q of data.questions) {
            const question = String(q?.question ?? q?.q ?? '').trim();
            const topic = stripCitations(String(q?.topic ?? '')).trim();
            if (!question || !topic || seen.has(questionKey(question))) continue;
            seen.add(questionKey(question));
            out.questions.push({ question, topic, subtopic: stripCitations(String(q?.subtopic ?? q?.subTopic ?? '')).trim() });
        }
    }

    data.results.forEach((r: any, i: number) => {
        const warnings: string[] = [];
        const code = String(r?.code ?? '').trim().toUpperCase().replace(/^CODE[\s:-]*/, '');
        if (!code) { out.errors.push(`Result #${i + 1} has no "code".`); return; }

        const correct = toInt(r.correct);
        const incorrect = toInt(r.incorrect);
        const skipped = toInt(r.skippedOrIncomplete ?? r.skipped ?? r.incomplete);
        const sum = correct + incorrect + skipped;
        const unreadable = r.unreadable === true || String(r.unreadable).toLowerCase() === 'true';
        let total = toInt(r.totalQuestions) || out.totalQuestions || sum;
        if (sum !== total) {
            if (!unreadable) warnings.push(`Counts add up to ${sum}, but the paper has ${total} questions.`);
            if (sum > total) total = sum;
        }
        const aiGradeRaw = r.grade ? String(r.grade).trim().toUpperCase() : null;
        const aiGrade = aiGradeRaw === 'BAD' ? 'POOR' : aiGradeRaw;

        const feedback: AiFeedbackItem[] = Array.isArray(r.feedback) ? r.feedback
            .filter((f: any) => f && (f.comment || f.question))
            .map((f: any) => ({
                question: String(f.question ?? '').trim(),
                status: STATUS_ALIASES[String(f.status ?? '').trim().toUpperCase()] || 'INCORRECT',
                comment: stripCitations(String(f.comment ?? '')),
                errorType: normErrorType(f.errorType, f.status),
            })) : [];

        const review: AiReview = {
            totalQuestions: total,
            correct, incorrect, skippedOrIncomplete: skipped,
            unreadable,
            unreadableNote: stripCitations(String(r.unreadableNote ?? '')),
            summary: stripCitations(String(r.summary ?? '')),
            feedback,
            aiGrade,
        };
        const computedGrade = unreadable ? null : computeGrade(review);
        if (!unreadable && aiGrade && aiGrade !== computedGrade) {
            warnings.push(`AI said ${aiGrade}; by the rule the counts give ${computedGrade} (the portal uses ${computedGrade}).`);
        }
        if (!unreadable && incorrect + skipped > 0) {
            const noted = new Set(feedback.map(f => questionKey(f.question))).size;
            if (noted === 0) warnings.push('No question-wise feedback was given.');
            else if (noted < incorrect + skipped) warnings.push(`Only ${noted} of the ${incorrect + skipped} wrong/skipped questions have a note, so the topic-wise analysis for this student is approximate. Ask the AI to "add a feedback item for every question that is not fully correct".`);
        }

        out.results.push({ code, name: String(r.name ?? '').trim(), review, computedGrade, warnings });
    });

    if (out.results.length === 0 && out.errors.length === 0) out.errors.push('The "results" list is empty.');
    const paperTotal = out.totalQuestions || Math.max(0, ...out.results.map(r => r.review.totalQuestions));
    if (out.questions.length > 0 && paperTotal > 0 && out.questions.length !== paperTotal) {
        const gap = paperTotal - out.questions.length;
        out.warnings.push(`The topic map lists ${out.questions.length} questions but the paper has ${paperTotal}${gap > 0 ? `, so ${gap} question(s) have no topic` : ''}. Ask the AI to "list every question of the paper in the questions array" and paste the corrected reply.`);
    }
    return out;
}

// ---------------------------------------------------------------- "Prepare paper" (fixed question list + key)

/** One question of the paper with its topic and the expected answer (inline LaTeX allowed). */
export interface PaperKeyQuestion { question: string; topic: string; subtopic: string; answer: string }

/**
 * Prompt for the one-time "Prepare paper" chat: only the question paper is attached. The AI numbers
 * every question, tags its topic / sub-topic and writes the expected final answer. The teacher
 * checks it once; every batch prompt then uses this fixed list.
 */
export function buildPreparePaperPrompt(opts: { title: string; board?: string | null; taxonomy?: TaxonomyTopic[] }): string {
    const { title, board, taxonomy = [] } = opts;
    const names = taxonomy.length
        ? taxonomy.map(t => `- ${t.topic}: ${t.subtopics.length ? t.subtopics.join('; ') : '(no sub-topics yet)'}`).join('\n')
        : '(none available - use standard textbook chapter and sub-topic names)';
    return `You are an expert mathematics teacher preparing the answer key for a homework paper.

The attached PDF is the QUESTION PAPER of "${title}"${board ? ` (${board} board)` : ''}. Read every page.

TASK
1. List EVERY question of the paper exactly once, in order, using the question numbers as printed. Count each numbered question as ONE question; sub-parts (a), (b) ... belong to their question.
2. For each question give the "topic" (chapter) and "subtopic" (the specific kind of problem it tests). Prefer these names from the teacher's question bank, copied exactly; only invent a short, standard name when none fits:
${names}
3. Solve each question carefully and give the expected FINAL answer in "answer" (for sub-parts: "(a) ...; (b) ..."; for proofs: one line on the key step or identity to use). Double-check every answer.
4. Write all mathematics in LaTeX between single dollar signs, e.g. $\\\\frac{\\\\sqrt{3}}{2}$. No citations or [cite: ...] markers.

OUTPUT
Reply with ONLY one JSON code block, no other text:
\`\`\`json
{
  "totalQuestions": 3,
  "questions": [
    { "question": "1", "topic": "Straight Lines", "subtopic": "Slope of a line", "answer": "$m = -\\\\frac{3}{4}$" },
    { "question": "2", "topic": "Straight Lines", "subtopic": "Distance of a point from a line", "answer": "$\\\\frac{7}{5}$ units" },
    { "question": "3", "topic": "Straight Lines", "subtopic": "Angle between two lines", "answer": "$45^\\\\circ$" }
  ]
}
\`\`\`
SELF-CHECK: "questions" must have exactly "totalQuestions" entries with no question left out; the JSON must be valid (every LaTeX backslash doubled inside strings, straight double quotes only).`;
}

export interface ParsedPaperKey { questions: PaperKeyQuestion[]; errors: string[]; warnings: string[] }

/** Parse the "Prepare paper" reply. Never throws. */
export function parsePaperKeyReply(raw: string): ParsedPaperKey {
    const out: ParsedPaperKey = { questions: [], errors: [], warnings: [] };
    if (!raw || !raw.trim()) { out.errors.push('Nothing was pasted.'); return out; }
    const text = extractJsonText(raw);
    let data: any;
    try { data = JSON.parse(repairLatexBackslashes(text)); }
    catch (e1: any) {
        try { data = JSON.parse(text); } catch {
            out.errors.push(`The reply is not valid JSON (${e1.message}). Ask the AI to "return only the JSON code block" and paste again.`);
            return out;
        }
    }
    const list = Array.isArray(data) ? data : data?.questions;
    if (!Array.isArray(list) || list.length === 0) { out.errors.push('The JSON has no "questions" list.'); return out; }
    const seen = new Set<string>();
    for (const q of list) {
        const question = String(q?.question ?? '').trim().replace(/^q(uestion)?\.?\s*/i, '');
        const topic = stripCitations(String(q?.topic ?? ''));
        if (!question) continue;
        const k = questionKey(question);
        if (seen.has(k)) { out.warnings.push(`Question ${question} is listed twice; only the first is kept.`); continue; }
        seen.add(k);
        if (!topic) out.warnings.push(`Question ${question} has no topic.`);
        out.questions.push({ question, topic, subtopic: stripCitations(String(q?.subtopic ?? q?.subTopic ?? '')), answer: stripCitations(String(q?.answer ?? q?.key ?? '')) });
    }
    const total = toInt(data?.totalQuestions);
    if (total && total !== out.questions.length) out.warnings.push(`The reply says the paper has ${total} questions but lists ${out.questions.length}.`);
    // Numbered papers: point out gaps such as 1-24 then 26
    const nums = out.questions.map(q => Number(questionKey(q.question))).filter(n => Number.isFinite(n));
    if (nums.length === out.questions.length && nums.length > 0) {
        const max = Math.max(...nums);
        const missing: number[] = [];
        for (let i = 1; i <= max; i++) if (!nums.includes(i)) missing.push(i);
        if (missing.length) out.warnings.push(`Question number(s) ${compactRanges(missing)} are missing from the list.`);
    }
    const noAnswer = out.questions.filter(q => !q.answer).map(q => q.question);
    if (noAnswer.length) out.warnings.push(`No answer given for Q${noAnswer.join(', Q')}.`);
    return out;
}

/** [1,2,3,7,9,10] -> "1-3, 7, 9-10" */
export function compactRanges(nums: number[]): string {
    const s = Array.from(new Set(nums)).sort((a, b) => a - b);
    const parts: string[] = [];
    for (let i = 0; i < s.length; i++) {
        let j = i;
        while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
        parts.push(i === j ? `${s[i]}` : `${s[i]}-${s[j]}`);
        i = j;
    }
    return parts.join(', ');
}

// ---------------------------------------------------------------- fix-up request

/**
 * A precise follow-up message for the SAME chat, listing exactly what is wrong or missing in the
 * grading reply. Empty string when there is nothing to fix.
 */
export function buildFixupRequest(opts: {
    parsed: ParsedAiReply;
    /** Students that were in the batch (to spot ones the reply left out). */
    expected?: PromptStudent[];
    /** Number of questions in the paper when a fixed question list exists. */
    keyTotal?: number;
}): string {
    const { parsed, expected = [], keyTotal } = opts;
    const items: string[] = [];

    if (parsed.errors.length && parsed.results.length === 0) {
        items.push('Your reply could not be read as JSON. Return the complete JSON again, exactly in the required shape, with every LaTeX backslash doubled inside strings and only straight double quotes.');
    }

    const codes = new Set(parsed.results.map(r => r.code));
    const missing = expected.filter(s => !codes.has(s.code));
    if (missing.length) items.push(`These students are missing from "results" - every one of them has pages in the PDF, find their separator page and check their work: ${missing.map(s => `CODE ${s.code} - ${s.name}`).join('; ')}.`);

    if (expected.length) {
        const known = new Set(expected.map(s => s.code));
        const strangers = parsed.results.filter(r => !known.has(r.code));
        if (strangers.length) items.push(`These codes are not in this batch: ${strangers.map(r => r.code).join(', ')}. Use exactly these codes and names: ${expected.map(s => `${s.code} - ${s.name}`).join('; ')}.`);
    }

    const total = keyTotal || parsed.totalQuestions || 0;
    if (!keyTotal && total > 0 && parsed.questions.length !== total) {
        const listed = new Set(parsed.questions.map(q => questionKey(q.question)));
        const missingNums: number[] = [];
        for (let i = 1; i <= total; i++) if (!listed.has(String(i))) missingNums.push(i);
        items.push(missingNums.length && missingNums.length <= total
            ? `The "questions" array lists ${parsed.questions.length} questions but the paper has ${total}. Add Q${compactRanges(missingNums)} with their topic and subtopic.`
            : `The "questions" array must list every question of the paper exactly once (${total} in total).`);
    }
    if (keyTotal && parsed.totalQuestions && parsed.totalQuestions !== keyTotal) {
        items.push(`The paper has exactly ${keyTotal} questions (see the FIXED QUESTION LIST); set "totalQuestions" to ${keyTotal} and count against that list.`);
    }

    for (const r of parsed.results) {
        if (r.review.unreadable) continue;
        const who = `CODE ${r.code}${r.name ? ` (${r.name})` : ''}`;
        const { correct, incorrect, skippedOrIncomplete: skipped } = r.review;
        const sum = correct + incorrect + skipped;
        const t = keyTotal || r.review.totalQuestions || total;
        if (t && sum !== t) items.push(`${who}: correct ${correct} + incorrect ${incorrect} + skipped/incomplete ${skipped} = ${sum}, but the paper has ${t} questions. Recount this student.`);
        const notedKeys = Array.from(new Set(r.review.feedback.map(f => questionKey(f.question))));
        if (incorrect + skipped > notedKeys.length) {
            items.push(`${who}: you counted ${incorrect} incorrect and ${skipped} skipped/incomplete (${incorrect + skipped} in total) but gave feedback only for ${notedKeys.length ? `Q${notedKeys.join(', Q')}` : 'no questions'}. Add one feedback item (with status, errorType and comment) for EVERY other question that is not fully correct.`);
        }
    }

    if (items.length === 0) return '';
    return `Please correct your last JSON reply. Problems found:\n${items.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nKeep everything that was already right. Return the COMPLETE corrected JSON for ALL students, in exactly the same shape, as one JSON code block with no other text.`;
}

// ---------------------------------------------------------------- AI Studio "Structured output" schemas

const S = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) });
const I = { type: 'integer' };

/** Paste into AI Studio > Run settings > Structured output > Edit, for the batch checking chats. */
export const GRADING_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        assignmentCode: S('Copy exactly from the prompt'),
        totalQuestions: I,
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: { question: S(), topic: S(), subtopic: S() },
                required: ['question', 'topic', 'subtopic'],
            },
        },
        results: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    code: S('Copy exactly from the student list'),
                    name: S(),
                    unreadable: { type: 'boolean' },
                    unreadableNote: S(),
                    correct: I,
                    incorrect: I,
                    skippedOrIncomplete: I,
                    grade: { type: 'string', enum: ['GOOD', 'SATISFACTORY', 'POOR'] },
                    summary: S(),
                    feedback: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                question: S(),
                                status: { type: 'string', enum: ['INCORRECT', 'PARTIAL', 'INCOMPLETE', 'SKIPPED'] },
                                errorType: { type: 'string', enum: ERROR_TYPES as string[] },
                                comment: S('Inline LaTeX between single $ signs'),
                            },
                            required: ['question', 'status', 'errorType', 'comment'],
                        },
                    },
                },
                required: ['code', 'name', 'unreadable', 'correct', 'incorrect', 'skippedOrIncomplete', 'grade', 'summary', 'feedback'],
            },
        },
    },
    required: ['assignmentCode', 'totalQuestions', 'questions', 'results'],
};

/** Paste into AI Studio's Structured output for the "Prepare paper" chat. */
export const PAPER_KEY_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        totalQuestions: I,
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: { question: S(), topic: S(), subtopic: S(), answer: S('Final answer, inline LaTeX between single $ signs') },
                required: ['question', 'topic', 'subtopic', 'answer'],
            },
        },
    },
    required: ['totalQuestions', 'questions'],
};
