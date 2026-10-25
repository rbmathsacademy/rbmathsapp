import Assignment from '@/models/Assignment';
import AssignmentSubmission from '@/models/AssignmentSubmission';
import BatchStudent from '@/models/BatchStudent';
import ClaudeGradingJob from '@/models/ClaudeGradingJob';
import { submissionCode, type PaperKeyQuestion } from '@/lib/aiGrading';
import { saveReviews, logGradingProblem, type SaveItem } from '@/lib/aiGradeSave';
import {
    CLAUDE_MODEL, DEFAULT_EFFORT, buildGradingParams, buildSystemText, claude, costUSD, downloadSharedPdf,
    downloadStudentPdf, parseClaudeMessage, usageFrom, type Effort,
} from '@/lib/claudeGrader';

/**
 * The Claude work queue. One job = one student submission.
 *
 *   queueJobs()      admin picks copies  -> jobs 'queued'
 *   sendOneChunk()   up to 6 queued jobs of one paper -> PDFs fetched, ONE Message Batch created
 *   collectBatches() ended batches -> results saved through the shared save step
 *   gradeNow()       one copy graded immediately (full price); falls back to a batch if it is slow
 *
 * Every step is short (seconds), so nothing waits on Claude inside a Vercel function: the long
 * wait happens on Anthropic's side, and a later call collects the finished results. Atomic status
 * changes (queued -> preparing, batched -> collecting) stop two callers handling the same job.
 */
const CHUNK = 6;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVE = ['queued', 'preparing', 'batched', 'collecting'];
const MAX_ATTEMPTS = 2;

type Job = any;
const final = () => ({ expiresAt: new Date(Date.now() + KEEP_MS) });

// ---------------------------------------------------------------- helpers

function keyFor(assignment: any, board: string) {
    const k = (assignment.paperKeys || []).find((x: any) => (x.board || '') === board);
    return k && (k.questions || []).length > 0 ? k : null;
}

function boardOf(assignment: any, student: any): string {
    return assignment.boardWise ? String(student?.board || '') : '';
}

function paperUrlFor(assignment: any, board: string): string | null {
    if (assignment.boardWise) {
        const bc = assignment.boardContent;
        return (bc?.get?.(board) || bc?.[board] || null) as string | null;
    }
    return typeof assignment.content === 'string' && assignment.content.startsWith('http') ? assignment.content : null;
}

/** Everything shared by one paper: its key, the paper / solutions PDFs and the cached system text. */
async function loadPaperContext(assignment: any, board: string) {
    const key = keyFor(assignment, board);
    if (!key) throw new Error(`no answer key saved for ${board ? board + ' ' : ''}this paper (prepare the paper first)`);
    const url = paperUrlFor(assignment, board);
    if (!url) throw new Error(`no question paper link${board ? ' for ' + board : ''}`);
    const paper = await downloadSharedPdf(url).catch(e => { throw new Error(`question paper: ${e.message}`); });
    let solutions: Buffer | null = null;
    if (key.solutionsUrl) solutions = await downloadSharedPdf(key.solutionsUrl).catch(() => null); // optional
    const system = buildSystemText({ title: assignment.title, board: board || null, key: key.questions as PaperKeyQuestion[], hasSolutions: !!solutions });
    return { key, paper, solutions, system, keyCount: key.questions.length };
}

async function endJob(job: Job, status: 'done' | 'failed' | 'skipped', patch: Record<string, any> = {}) {
    await ClaudeGradingJob.updateOne({ _id: job._id }, { $set: { status, ...final(), ...patch } });
}

async function logProblem(job: Job, status: 'failed' | 'skipped', reason: string, studentName = '') {
    await logGradingProblem({
        assignmentId: job.assignment.toString(), submissionId: job.submission.toString(), studentId: job.student, studentName,
        source: job.mode === 'now' ? 'claude-now' : 'claude-batch', model: CLAUDE_MODEL, status, reason, by: job.by,
    });
}

// ---------------------------------------------------------------- queueing

export interface QueueOutcome { queued: number; skipped: Array<{ name: string; reason: string }> }

export async function queueJobs(opts: { assignmentId: string; submissionIds: string[]; regrade: boolean; by: string; effort?: Effort }): Promise<QueueOutcome> {
    const assignment = await Assignment.findById(opts.assignmentId).select('title boardWise paperKeys').lean() as any;
    if (!assignment) throw new Error('Assignment not found');
    const subs = await AssignmentSubmission.find({ _id: { $in: opts.submissionIds }, assignment: opts.assignmentId }).select('student link status').lean() as any[];
    const students = await BatchStudent.find({ _id: { $in: subs.map(s => s.student) } }).select('name board').lean() as any[];
    const studentById = new Map(students.map(s => [s._id.toString(), s]));
    const active = await ClaudeGradingJob.find({ submission: { $in: subs.map(s => s._id) }, status: { $in: ACTIVE } }).select('submission').lean() as any[];
    const activeSet = new Set(active.map(j => j.submission.toString()));

    const out: QueueOutcome = { queued: 0, skipped: [] };
    const docs: any[] = [];
    for (const sub of subs) {
        const student = studentById.get(sub.student.toString());
        const name = student?.name || 'Unknown';
        const board = boardOf(assignment, student);
        if (!sub.link) { out.skipped.push({ name, reason: 'no PDF uploaded' }); continue; }
        if (activeSet.has(sub._id.toString())) { out.skipped.push({ name, reason: 'already queued or being graded' }); continue; }
        if (sub.status === 'CORRECTED' && !opts.regrade) { out.skipped.push({ name, reason: 'already graded' }); continue; }
        if (!keyFor(assignment, board)) { out.skipped.push({ name, reason: `no answer key saved for ${board || 'this paper'}` }); continue; }
        docs.push({
            assignment: opts.assignmentId, submission: sub._id, student: sub.student, code: submissionCode(sub._id.toString()),
            board, submissionLink: sub.link, status: 'queued', mode: 'batch', effort: opts.effort || DEFAULT_EFFORT, by: opts.by,
        });
    }
    if (docs.length > 0) await ClaudeGradingJob.insertMany(docs);
    out.queued = docs.length;
    return out;
}

// ---------------------------------------------------------------- sending a chunk as one batch

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
    }));
    return out;
}

/** Sends up to CHUNK queued jobs (same paper) as one Message Batch. Returns how many jobs were taken. */
export async function sendOneChunk(assignmentId?: string): Promise<number> {
    const filter: any = { status: 'queued', ...(assignmentId ? { assignment: assignmentId } : {}) };
    const first = await ClaudeGradingJob.findOne(filter).sort({ createdAt: 1 }).lean() as Job | null;
    if (!first) return 0;
    const siblings = await ClaudeGradingJob.find({ ...filter, assignment: first.assignment, board: first.board }).sort({ createdAt: 1 }).limit(CHUNK).lean() as Job[];

    const claimed: Job[] = [];
    for (const j of siblings) {
        const c = await ClaudeGradingJob.findOneAndUpdate({ _id: j._id, status: 'queued' }, { $set: { status: 'preparing' }, $inc: { attempts: 1 } }, { new: true }).lean();
        if (c) claimed.push(c);
    }
    if (claimed.length === 0) return 0;

    const assignment = await Assignment.findById(first.assignment).select('title boardWise boardContent content paperKeys').lean() as any;
    let ctx: Awaited<ReturnType<typeof loadPaperContext>>;
    try {
        if (!assignment) throw new Error('assignment no longer exists');
        ctx = await loadPaperContext(assignment, first.board || '');
    } catch (e: any) {
        for (const j of claimed) { await endJob(j, 'failed', { error: e.message }); await logProblem(j, 'failed', e.message); }
        return claimed.length;
    }

    const prepared = await mapLimit(claimed, 3, async (job): Promise<{ job: Job; request?: any } > => {
        const sub = await AssignmentSubmission.findById(job.submission).select('link').lean() as any;
        const student = await BatchStudent.findById(job.student).select('name').lean() as any;
        if (!sub || sub.link !== job.submissionLink) {
            await endJob(job, 'skipped', { error: 'the submission was deleted or replaced' });
            await logProblem(job, 'skipped', 'the submission was deleted or replaced', student?.name);
            return { job };
        }
        try {
            const sheet = await downloadStudentPdf(sub.link);
            const params = buildGradingParams({ system: ctx.system, paper: ctx.paper, solutions: ctx.solutions, student: sheet.bytes, code: job.code, effort: (job.effort || DEFAULT_EFFORT) as Effort });
            return { job, request: { custom_id: job._id.toString(), params } };
        } catch (e: any) {
            await endJob(job, 'failed', { error: e.message });
            await logProblem(job, 'failed', e.message, student?.name);
            return { job };
        }
    });

    const requests = prepared.filter(p => p.request).map(p => p.request);
    if (requests.length === 0) return claimed.length;
    try {
        const batch = await claude().messages.batches.create({ requests });
        await ClaudeGradingJob.updateMany({ _id: { $in: prepared.filter(p => p.request).map(p => p.job._id) } }, { $set: { status: 'batched', batchId: batch.id, error: '' } });
    } catch (e: any) {
        for (const p of prepared.filter(x => x.request)) {
            if (p.job.attempts >= 3) { await endJob(p.job, 'failed', { error: `could not send to Claude: ${e.message}` }); await logProblem(p.job, 'failed', `could not send to Claude: ${e.message}`); }
            else await ClaudeGradingJob.updateOne({ _id: p.job._id }, { $set: { status: 'queued', error: `send failed, will retry: ${e.message}` } });
        }
    }
    return claimed.length;
}

// ---------------------------------------------------------------- collecting finished batches

async function requeueOrFail(job: Job, reason: string) {
    if ((job.attempts || 0) < MAX_ATTEMPTS) {
        await ClaudeGradingJob.updateOne({ _id: job._id }, { $set: { status: 'queued', batchId: null, error: `retrying: ${reason}` } });
    } else {
        await endJob(job, 'failed', { error: reason });
        const student = await BatchStudent.findById(job.student).select('name').lean() as any;
        await logProblem(job, 'failed', reason, student?.name);
    }
}

export async function collectBatches(assignmentId?: string, budgetMs = 30000): Promise<number> {
    const started = Date.now();
    const filter: any = { status: 'batched', ...(assignmentId ? { assignment: assignmentId } : {}) };
    const batchIds: string[] = (await ClaudeGradingJob.distinct('batchId', filter)).filter(Boolean);
    let collected = 0;

    for (const batchId of batchIds) {
        if (Date.now() - started > budgetMs) break;
        let batch: any;
        try { batch = await claude().messages.batches.retrieve(batchId); } catch { continue; }
        if (batch.processing_status !== 'ended') continue;

        const items: Array<{ item: SaveItem; job: Job; assignmentId: string; usage: any; cost: number }> = [];
        for await (const r of await claude().messages.batches.results(batchId)) {
            const job = await ClaudeGradingJob.findOneAndUpdate({ _id: r.custom_id, status: 'batched' }, { $set: { status: 'collecting' } }, { new: true }).lean() as Job | null;
            if (!job) continue;
            if (r.result.type !== 'succeeded') {
                const why = r.result.type === 'errored' ? ((r.result as any).error?.error?.message || (r.result as any).error?.message || 'Claude reported an error') : `the request ${r.result.type}`;
                await requeueOrFail(job, why);
                continue;
            }
            const msg: any = r.result.message;
            const usage = usageFrom(msg.usage);
            const cost = costUSD(usage, true);
            const sub = await AssignmentSubmission.findById(job.submission).select('link status aiReview').lean() as any;
            const student = await BatchStudent.findById(job.student).select('name').lean() as any;
            if (!sub || sub.link !== job.submissionLink) {
                await endJob(job, 'skipped', { error: 'the submission was deleted or replaced', usage, costUSD: cost });
                await logProblem(job, 'skipped', 'the submission was deleted or replaced while Claude was working', student?.name);
                continue;
            }
            if (sub.aiReview?.importedAt && new Date(sub.aiReview.importedAt) > new Date((job as any).createdAt) && sub.aiReview.source !== 'claude-api') {
                await endJob(job, 'skipped', { error: 'graded manually in the meantime', usage, costUSD: cost });
                await logProblem(job, 'skipped', 'graded manually while Claude was working (your grading was kept)', student?.name);
                continue;
            }
            try {
                const assignment = await Assignment.findById(job.assignment).select('paperKeys').lean() as any;
                const keyCount = keyFor(assignment, job.board || '')?.questions.length || 0;
                const { review, notes } = parseClaudeMessage(msg, keyCount);
                items.push({ item: { submissionId: job.submission.toString(), review, source: 'claude-batch', model: msg.model || CLAUDE_MODEL, usage, costUSD: cost }, job, assignmentId: job.assignment.toString(), usage, cost });
                if (notes.length) console.log('[claude] notes for', job.code, notes.join('; '));
            } catch (e: any) {
                await ClaudeGradingJob.updateOne({ _id: job._id }, { $set: { usage, costUSD: cost } });
                await requeueOrFail(job, e.message);
            }
        }

        // Save per assignment through the shared step (grade rule, warnings, notifications, log)
        const byAssignment = new Map<string, typeof items>();
        for (const it of items) (byAssignment.get(it.assignmentId) || byAssignment.set(it.assignmentId, []).get(it.assignmentId)!).push(it);
        for (const [aid, group] of byAssignment) {
            await saveReviews(aid, group.map(g => g.item), { by: group[0].job.by });
            for (const g of group) await endJob(g.job, 'done', { usage: g.usage, costUSD: g.cost, error: '' });
            collected += group.length;
        }
        // Jobs of this batch that never got a result
        const orphans = await ClaudeGradingJob.find({ batchId, status: 'batched' }).lean() as Job[];
        for (const o of orphans) await requeueOrFail(o, 'no result came back from Claude');
    }
    return collected;
}

// ---------------------------------------------------------------- "Grade now"

export interface NowOutcome {
    ok: boolean;
    fallbackToBatch?: boolean;
    message?: string;
    saved?: any;
    costUSD?: number;
}

export async function gradeNow(opts: { assignmentId: string; submissionId: string; regrade: boolean; by: string; effort?: Effort }): Promise<NowOutcome> {
    const assignment = await Assignment.findById(opts.assignmentId).select('title boardWise boardContent content paperKeys').lean() as any;
    if (!assignment) return { ok: false, message: 'Assignment not found' };
    const sub = await AssignmentSubmission.findOne({ _id: opts.submissionId, assignment: opts.assignmentId }).select('student link status').lean() as any;
    if (!sub) return { ok: false, message: 'Submission not found' };
    const student = await BatchStudent.findById(sub.student).select('name board').lean() as any;
    const board = boardOf(assignment, student);

    if (!sub.link) return { ok: false, message: 'This student has no PDF uploaded' };
    if (sub.status === 'CORRECTED' && !opts.regrade) return { ok: false, message: 'Already graded. Confirm re-grading to replace the existing result.' };
    if (await ClaudeGradingJob.exists({ submission: opts.submissionId, status: { $in: ACTIVE } })) return { ok: false, message: 'This copy is already queued or being graded' };

    const job = await ClaudeGradingJob.create({
        assignment: opts.assignmentId, submission: opts.submissionId, student: sub.student, code: submissionCode(opts.submissionId),
        board, submissionLink: sub.link, status: 'preparing', mode: 'now', effort: opts.effort || DEFAULT_EFFORT, by: opts.by, attempts: 1,
    }) as any;

    const started = Date.now();
    const fail = async (reason: string): Promise<NowOutcome> => {
        await endJob(job, 'failed', { error: reason });
        await logProblem(job, 'failed', reason, student?.name);
        return { ok: false, message: reason };
    };

    let params: any;
    try {
        const ctx = await loadPaperContext(assignment, board);
        const sheet = await downloadStudentPdf(sub.link);
        params = buildGradingParams({ system: ctx.system, paper: ctx.paper, solutions: ctx.solutions, student: sheet.bytes, code: job.code, effort: job.effort as Effort });
    } catch (e: any) {
        return fail(e.message);
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 48_000); // stay inside Vercel's 60 s limit
    let msg: any;
    try {
        msg = await claude().messages.stream(params, { signal: ac.signal }).finalMessage();
    } catch (e: any) {
        clearTimeout(timer);
        if (ac.signal.aborted || /abort|timed out|timeout/i.test(String(e?.message))) {
            // Too slow for a direct call: hand it over to the batch queue instead
            await ClaudeGradingJob.updateOne({ _id: job._id }, { $set: { status: 'queued', mode: 'batch', error: 'direct call was too slow, sent as a batch' } });
            return { ok: true, fallbackToBatch: true, message: 'This copy is long, so it was added to the batch queue instead. Press "Check now" in a few minutes.' };
        }
        return fail(`Claude request failed: ${e?.message || e}`);
    }
    clearTimeout(timer);

    const usage = usageFrom(msg.usage);
    const cost = costUSD(usage, false);
    try {
        const { review } = parseClaudeMessage(msg, keyFor(assignment, board)?.questions.length || 0);
        const saved = await saveReviews(opts.assignmentId, [{
            submissionId: opts.submissionId, review, source: 'claude-now', model: msg.model || CLAUDE_MODEL, usage, costUSD: cost, durationMs: Date.now() - started,
        }], { by: opts.by });
        await endJob(job, 'done', { usage, costUSD: cost, error: '' });
        return { ok: true, saved: saved.saved[0], costUSD: cost };
    } catch (e: any) {
        await ClaudeGradingJob.updateOne({ _id: job._id }, { $set: { usage, costUSD: cost } });
        return fail(e.message);
    }
}

// ---------------------------------------------------------------- one tick, and status

/** Sends queued jobs and collects finished batches, within a time budget. */
export async function tick(assignmentId?: string, budgetMs = 40000) {
    const started = Date.now();
    let sent = 0;
    while (Date.now() - started < budgetMs * 0.6) {
        const n = await sendOneChunk(assignmentId);
        if (n === 0) break;
        sent += n;
    }
    const collected = await collectBatches(assignmentId, Math.max(5000, budgetMs - (Date.now() - started)));
    return { sent, collected };
}

export async function jobStatus(assignmentId: string) {
    const jobs = await ClaudeGradingJob.find({ assignment: assignmentId }).sort({ updatedAt: -1 }).limit(600)
        .select('submission status mode error costUSD updatedAt').lean() as any[];
    const bySubmission: Record<string, { status: string; mode: string; error: string }> = {};
    const counts: Record<string, number> = { queued: 0, preparing: 0, batched: 0, collecting: 0, done: 0, failed: 0, skipped: 0 };
    let cost = 0;
    for (const j of jobs) {
        const k = j.submission.toString();
        if (!bySubmission[k]) { bySubmission[k] = { status: j.status, mode: j.mode, error: j.error || '' }; counts[j.status] = (counts[j.status] || 0) + 1; }
        cost += j.costUSD || 0;
    }
    const active = counts.queued + counts.preparing + counts.batched + counts.collecting;
    return { counts, bySubmission, active, costUSD: +cost.toFixed(4), queuedToSend: counts.queued };
}
