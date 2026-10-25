import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument } from 'pdf-lib';
import { ERROR_TYPES, stripCitations, questionLabel, type AiReview, type PaperKeyQuestion } from '@/lib/aiGrading';

/**
 * Claude grading of one student's PDF answer sheet against the saved answer key.
 *
 * Token savings built in:
 *  - Sonnet 5.5, and Message Batches (50% off) for the routine path.
 *  - The part that is the same for every student of a paper (instructions + question list + key,
 *    question paper PDF, solutions PDF) comes FIRST and ends with one cache breakpoint (1-hour TTL),
 *    so it is read from the cache at a fraction of the price after the first request.
 *  - The student's own PDF comes after the breakpoint (it differs per student, so it is never cached).
 *  - Structured output (strict JSON schema): short, always-valid replies; notes only for questions
 *    that are not fully correct, one or two sentences each; medium effort by default.
 *  - No student names are sent, only a short code.
 */
export const CLAUDE_MODEL = 'claude-sonnet-5-5';
export type Effort = 'low' | 'medium' | 'high';
export const DEFAULT_EFFORT: Effort = 'high';
const MAX_TOKENS = 32000;

export function claudeConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
export function claude(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set on the server');
    if (!client) client = new Anthropic({ maxRetries: 2 });
    return client;
}

// ---------------------------------------------------------------- usage and cost

export interface Usage { input: number; output: number; cacheRead: number; cacheWrite: number }

export const emptyUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

export function usageFrom(u: any): Usage {
    return {
        input: u?.input_tokens || 0,
        output: u?.output_tokens || 0,
        cacheRead: u?.cache_read_input_tokens || 0,
        cacheWrite: u?.cache_creation_input_tokens || 0,
    };
}

/** Sonnet 5.5 list prices per million tokens (1-hour cache writes); Message Batches are half price. */
export function costUSD(u: Usage, batch: boolean): number {
    const full = (u.input * 2 + u.output * 10 + u.cacheRead * 0.1 + u.cacheWrite * 4) / 1e6;
    return +(batch ? full / 2 : full).toFixed(5);
}

// ---------------------------------------------------------------- prompt and schema

export const RESULT_SCHEMA = {
    type: 'object',
    properties: {
        unreadable: { type: 'boolean' },
        unreadableNote: { type: 'string' },
        correct: { type: 'integer' },
        incorrect: { type: 'integer' },
        skippedOrIncomplete: { type: 'integer' },
        summary: { type: 'string' },
        feedback: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    status: { type: 'string', enum: ['INCORRECT', 'PARTIAL', 'INCOMPLETE', 'SKIPPED'] },
                    errorType: { type: 'string', enum: ERROR_TYPES as string[] },
                    comment: { type: 'string' },
                },
                required: ['question', 'status', 'errorType', 'comment'],
                additionalProperties: false,
            },
        },
    },
    required: ['unreadable', 'unreadableNote', 'correct', 'incorrect', 'skippedOrIncomplete', 'summary', 'feedback'],
    additionalProperties: false,
};

const titleHead = (t: string) => String(t || 'Homework').split('||')[0].trim();

/** The instructions + question list + key: identical for every student of one paper (so it can be cached). */
export function buildSystemText(opts: { title: string; board?: string | null; key: PaperKeyQuestion[]; hasSolutions: boolean }): string {
    const { title, board, key, hasSolutions } = opts;
    const list = key.map(q => `${questionLabel(q.question)} | ${q.topic}${q.subtopic ? ' > ' + q.subtopic : ''} | Key: ${q.answer || '(see solutions)'}`).join('\n');
    return `You are an experienced, fair mathematics teacher checking ONE student's handwritten homework "${titleHead(title)}"${board ? ` (${board} board)` : ''}.

WHAT YOU RECEIVE (PDF documents, in this order)
1. The QUESTION PAPER.${hasSolutions ? "\n2. The TEACHER'S SOLUTIONS (the answer key)." : ''}
${hasSolutions ? '3' : '2'}. The STUDENT'S ANSWER SHEET: photos of handwritten pages. Judge only this document.

QUESTION LIST AND KEY (teacher-approved - use exactly these labels)
The paper has exactly ${key.length} questions.
${list}

HOW TO CHECK
0. Work carefully. For EVERY question: find that student's answer on the sheet, read it properly, work the question out yourself, and compare your result with the key. Only then decide. Do not judge from a quick glance.
1. Put every question of the list into exactly one group: correct; incorrect (status INCORRECT, or PARTIAL when partly right); skipped or incomplete (status SKIPPED, or INCOMPLETE when left unfinished). So correct + incorrect + skippedOrIncomplete = ${key.length}.
2. Be open to different methods. Any valid method, order of steps or notation is fine; judge the approach and the final answer, not the style. An equivalent form of the key's answer is correct.
3. "Key" is the expected final answer. Only if you are certain a key is wrong, judge that question by correct mathematics.
4. A correct answer must NEVER be marked incorrect or partly correct. Mark INCORRECT only when you have confirmed that the student's final answer really differs from the correct answer (not just from the key's wording). Mark PARTIAL only when a clear part of a multi-part question is right and another clear part is wrong. Be lenient: equivalent forms (simplified or unsimplified, different but equal expressions, reordered terms, decimals vs fractions) are correct; a missing constant of integration, a minor notation slip, an untidy step, skipped obvious working or a missing unit the question did not ask for does NOT make an otherwise correct answer wrong; a different valid method is fine. Give the student the benefit of the doubt when the work is reasonable and the answer is right or only trivially off. If you are unsure whether you read a character or number correctly, re-read that line before deciding; when the work is legible and reaches the right answer, it is correct.
5. If the handwriting or photos are too unclear to judge, or the pages are not this assignment, set unreadable to true and say why in unreadableNote; still fill in the counts for whatever you could read.

FEEDBACK (the student will read it)
- Give one feedback item for EVERY question that is not fully correct (at least incorrect + skippedOrIncomplete items), with the label exactly as in the list.
- INCORRECT / PARTIAL / INCOMPLETE: one or two short sentences saying where it went wrong and how to fix it. SKIPPED: a short line such as "Not attempted - revise the method and try it."
- errorType is the main kind of mistake: CONCEPT, METHOD, FORMULA, CALCULATION, SIGN, INCOMPLETE_STEPS, NOT_ATTEMPTED or OTHER.
- Write mathematics in LaTeX between single dollar signs, e.g. $\\frac{x^3}{3} + C$. Never use $$, Markdown, citations or source markers.
- summary: one short, kind sentence about the whole sheet.

Reply with the JSON only.`;
}

export interface GradingInputs {
    system: string;
    paper: Buffer;
    solutions?: Buffer | null;
    student: Buffer;
    code: string;
    effort?: Effort;
}

const docBlock = (b: Buffer, cache = false) => ({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: b.toString('base64') },
    ...(cache ? { cache_control: { type: 'ephemeral', ttl: '1h' } } : {}),
});

/** The Messages API request for one student. Shared blocks first, one cache breakpoint, student last. */
export function buildGradingParams(i: GradingInputs): any {
    return {
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: [{ type: 'text', text: i.system }],
        thinking: { type: 'adaptive' },
        output_config: { effort: i.effort || DEFAULT_EFFORT, format: { type: 'json_schema', schema: RESULT_SCHEMA } },
        messages: [{
            role: 'user',
            content: [
                docBlock(i.paper, !i.solutions),
                ...(i.solutions ? [docBlock(i.solutions, true)] : []),
                docBlock(i.student),
                { type: 'text', text: `Student code ${i.code}. Check this student's answer sheet (the last PDF) against the key.` },
            ],
        }],
    };
}

// ---------------------------------------------------------------- reading Claude's reply

const toInt = (v: any) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : 0; };

/** Turns a Messages API response into a review. Throws a short message when the reply is unusable. */
export function parseClaudeMessage(msg: any, keyCount: number): { review: AiReview; notes: string[] } {
    if (msg?.stop_reason === 'refusal') throw new Error('Claude declined to grade this copy');
    if (msg?.stop_reason === 'max_tokens') throw new Error('Claude ran out of output space - try again');
    const text = (msg?.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    let data: any = null;
    try { data = JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        try { data = m ? JSON.parse(m[0]) : null; } catch { data = null; }
    }
    if (!data || typeof data !== 'object') throw new Error('Claude replied with something that is not valid JSON');

    const notes: string[] = [];
    const unreadable = data.unreadable === true;
    const incorrect = toInt(data.incorrect);
    const skipped = toInt(data.skippedOrIncomplete);
    let correct = toInt(data.correct);
    let total = keyCount || correct + incorrect + skipped;
    if (correct + incorrect + skipped !== total && !unreadable) {
        notes.push(`counts added up to ${correct + incorrect + skipped}, adjusted to ${total}`);
        if (incorrect + skipped <= total) correct = total - incorrect - skipped;
        else total = correct + incorrect + skipped;
    }
    const feedback = (Array.isArray(data.feedback) ? data.feedback : [])
        .filter((f: any) => f && (f.comment || f.question))
        .map((f: any) => ({
            question: String(f.question ?? '').trim(),
            status: ['INCORRECT', 'PARTIAL', 'INCOMPLETE', 'SKIPPED'].includes(f.status) ? f.status : 'INCORRECT',
            comment: stripCitations(String(f.comment ?? '')),
            errorType: ERROR_TYPES.includes(f.errorType) ? f.errorType : 'OTHER',
        }));
    if (!unreadable && incorrect + skipped > 0 && new Set(feedback.map((f: any) => f.question)).size < incorrect + skipped) {
        notes.push('fewer feedback notes than wrong/skipped questions');
    }
    return {
        review: {
            totalQuestions: total, correct, incorrect, skippedOrIncomplete: skipped,
            unreadable, unreadableNote: stripCitations(String(data.unreadableNote ?? '')),
            summary: stripCitations(String(data.summary ?? '')), feedback, aiGrade: null,
        },
        notes,
    };
}

// ---------------------------------------------------------------- Google Drive PDFs

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const pdfCache = new Map<string, { at: number; bytes: Buffer }>(); // question papers / solutions, reused within a few minutes

async function fetchDrive(url: string): Promise<Buffer> {
    const id = url.match(/\/d\/([^/?#]+)/)?.[1] || (() => { try { return new URL(url).searchParams.get('id'); } catch { return null; } })();
    if (!id) throw new Error('not a Google Drive file link');
    const res = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`, { redirect: 'follow' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || type.includes('text/html')) throw new Error(`Drive did not return the file (${res.status}); it may not be shared`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) throw new Error('the file is empty');
    if (bytes.length > MAX_PDF_BYTES) throw new Error('the file is too large');
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('the file is not a PDF');
    return bytes;
}

/** A student's PDF: downloaded and checked, so a damaged file fails here instead of costing an API call. */
export async function downloadStudentPdf(url: string): Promise<{ bytes: Buffer; pages: number }> {
    const bytes = await fetchDrive(url);
    let pages = 0;
    try { pages = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount(); }
    catch { throw new Error('the PDF file is damaged and cannot be opened'); }
    if (pages > 100) throw new Error(`the PDF has ${pages} pages, too many to grade`);
    return { bytes, pages };
}

/** A question paper or solutions PDF, cached in memory for 10 minutes. */
export async function downloadSharedPdf(url: string): Promise<Buffer> {
    const hit = pdfCache.get(url);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.bytes;
    const bytes = await fetchDrive(url);
    pdfCache.set(url, { at: Date.now(), bytes });
    if (pdfCache.size > 6) pdfCache.delete(pdfCache.keys().next().value as string);
    return bytes;
}
