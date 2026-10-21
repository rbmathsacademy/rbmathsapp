// Shared (client + server) logic for checking PDF assignments with an AI chat assistant.
//
// Flow: the admin downloads merged PDFs (question paper + up to 10 submissions, each preceded by a
// separator page carrying a submission CODE), uploads them to the AI chat with the prompt built
// here, then pastes the AI's JSON reply back into the portal, which parses it with
// parseAiGradingReply() and saves it.

export type FeedbackStatus = 'INCORRECT' | 'PARTIAL' | 'INCOMPLETE' | 'SKIPPED';
export type Grade = 'GOOD' | 'SATISFACTORY' | 'POOR';

export interface AiFeedbackItem {
    question: string;
    status: FeedbackStatus;
    comment: string;
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
}): string {
    const { assignmentId, title, board, batchNo, batchCount, students } = opts;
    const list = students.map((s, i) => `${i + 1}. CODE ${s.code} - ${s.name}`).join('\n');
    return `You are an experienced and fair mathematics teacher checking handwritten homework.

THE ATTACHED PDF
- File: "${title}"${board ? ` (${board} board)` : ''}, batch ${batchNo} of ${batchCount}.
- The first page(s) are the QUESTION PAPER. There is no solution guide: solve the questions yourself to check the students' work.
- Then come the students' answer sheets (photos of handwritten pages). Each student's work begins right after a separator page titled "STUDENT SUBMISSION" that shows the student's CODE and name. Everything after that page, up to the next separator page or the final "END OF BATCH" page, belongs to that student only.
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

OUTPUT
Reply with ONLY one JSON code block, no other text, in exactly this shape:
\`\`\`json
{
  "assignmentCode": "${assignmentCode(assignmentId)}",
  "totalQuestions": 10,
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
        { "question": "3", "status": "INCORRECT", "comment": "The derivative of $\\\\tan x$ is $\\\\sec^2 x$, not $\\\\sec x$; recheck step 2." },
        { "question": "6(b)", "status": "PARTIAL", "comment": "..." },
        { "question": "9", "status": "SKIPPED", "comment": "Not attempted ..." }
      ]
    }
  ]
}
\`\`\`
Rules for the JSON:
- One object in "results" for EVERY student listed above (all ${students.length}), even if their pages are missing (then mark unreadable).
- "code" and "name" must be copied exactly from the list above (same spelling, character by character).
- It must be valid JSON: inside strings write every LaTeX backslash doubled (\\\\frac, \\\\sqrt, \\\\int), and use only straight double quotes for JSON keys and strings.`;
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
    results: ParsedAiResult[];
    errors: string[];
}

const toInt = (v: any) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
};

const STATUS_ALIASES: Record<string, FeedbackStatus> = {
    INCORRECT: 'INCORRECT', WRONG: 'INCORRECT', ERROR: 'INCORRECT',
    PARTIAL: 'PARTIAL', PARTIALLY_CORRECT: 'PARTIAL', 'PARTIALLY CORRECT': 'PARTIAL',
    INCOMPLETE: 'INCOMPLETE', UNFINISHED: 'INCOMPLETE',
    SKIPPED: 'SKIPPED', NOT_ATTEMPTED: 'SKIPPED', 'NOT ATTEMPTED': 'SKIPPED', MISSING: 'SKIPPED',
};

/** Parse and validate the JSON the admin pasted from the AI chat. Never throws. */
export function parseAiGradingReply(raw: string): ParsedAiReply {
    const out: ParsedAiReply = { assignmentCode: null, totalQuestions: 0, results: [], errors: [] };
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
        if (!unreadable && incorrect + skipped > 0 && feedback.length === 0) warnings.push('No question-wise feedback was given.');

        out.results.push({ code, name: String(r.name ?? '').trim(), review, computedGrade, warnings });
    });

    if (out.results.length === 0 && out.errors.length === 0) out.errors.push('The "results" list is empty.');
    return out;
}
