'use client';

import { useMemo, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { toast } from 'react-hot-toast';
import { Sparkles, Download, Copy, ChevronDown, ChevronUp, ExternalLink, Upload, CheckCircle2, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { buildGradingPrompt, parseAiGradingReply, submissionCode, assignmentCode, type ParsedAiReply } from '@/lib/aiGrading';

// Students per merged PDF. Real answer sheets run 9-14 pages, so 10 students is ~100+ pages;
// 5 gives the AI a lighter read when accuracy matters more than the number of chats.
const BATCH_SIZES = [5, 10] as const;

interface PanelStudent {
    _id: string | null;
    student: { _id: string; name: string; board?: string | null };
    link: string | null;
    status: 'PENDING' | 'CORRECTED';
    aiReview?: { unreadable?: boolean } | null;
}

interface PanelAssignment {
    _id: string;
    title: string;
    content: any;
    boardWise?: boolean;
    boardContent?: Record<string, string>;
}

interface Batch {
    key: string;
    no: number;
    board: string | null;
    paperUrl: string | null;
    students: { submissionId: string; code: string; name: string; board: string | null; link: string }[];
}

type BatchState = { status: 'idle' | 'building' | 'done' | 'error'; progress?: string; problems?: string[] };

const authHeaders = (): Record<string, string> => {
    try {
        const t = localStorage.getItem('adminToken');
        return t ? { Authorization: `Bearer ${t}` } : {};
    } catch { return {}; }
};

// jsPDF/pdf-lib standard fonts only cover basic Latin
const ascii = (s: string) => (s || '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').trim();

async function fetchDrivePdf(url: string): Promise<ArrayBuffer> {
    const res = await fetch(`/api/admin/assignments/drive-file?url=${encodeURIComponent(url)}`, { headers: authHeaders() });
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { msg = (await res.json()).error || msg; } catch { }
        throw new Error(msg);
    }
    return res.arrayBuffer();
}

function drawCentered(page: any, text: string, y: number, size: number, font: PDFFont, color = rgb(0.07, 0.09, 0.15)) {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
        const t = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(t, size) > maxWidth && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
}

function addSeparatorPage(doc: PDFDocument, fonts: { bold: PDFFont; reg: PDFFont }, s: Batch['students'][number], index: number, of: number, pageCount: number | null) {
    const page = doc.addPage([595.28, 841.89]);
    const W = page.getWidth();
    page.drawRectangle({ x: 0, y: 841.89 - 150, width: W, height: 150, color: rgb(0.12, 0.23, 0.37) });
    drawCentered(page, 'STUDENT SUBMISSION', 841.89 - 70, 30, fonts.bold, rgb(1, 1, 1));
    drawCentered(page, `Student ${index} of ${of} in this file`, 841.89 - 110, 14, fonts.reg, rgb(0.85, 0.9, 1));

    page.drawRectangle({ x: 70, y: 520, width: W - 140, height: 140, borderColor: rgb(0.12, 0.23, 0.37), borderWidth: 3 });
    drawCentered(page, 'CODE', 620, 16, fonts.reg);
    drawCentered(page, s.code, 545, 56, fonts.bold);

    drawCentered(page, `Name: ${ascii(s.name) || 'Unknown'}`, 450, 22, fonts.bold);
    if (s.board) drawCentered(page, `Board: ${s.board}`, 415, 15, fonts.reg);

    const note = pageCount === null
        ? 'THE SUBMISSION FILE COULD NOT BE LOADED. Mark this student as unreadable in your reply.'
        : `This student's answer sheet (${pageCount} page${pageCount === 1 ? '' : 's'}) follows this page. Everything up to the next "STUDENT SUBMISSION" page or the "END OF BATCH" page belongs to this student only.`;
    let y = 330;
    for (const line of wrap(note, fonts.reg, 14, W - 140)) {
        drawCentered(page, line, y, 14, fonts.reg, pageCount === null ? rgb(0.75, 0.1, 0.1) : rgb(0.25, 0.28, 0.35));
        y -= 22;
    }
}

function addEndPage(doc: PDFDocument, fonts: { bold: PDFFont; reg: PDFFont }, students: Batch['students']) {
    const page = doc.addPage([595.28, 841.89]);
    drawCentered(page, 'END OF BATCH', 700, 34, fonts.bold);
    drawCentered(page, `This file contained ${students.length} student submission(s):`, 650, 15, fonts.reg);
    let y = 610;
    students.forEach((s, i) => {
        drawCentered(page, `${i + 1}.  CODE ${s.code}  -  ${ascii(s.name)}`, y, 13, fonts.reg);
        y -= 22;
    });
}

export default function AiGradingPanel({ assignment, students, onImported }: { assignment: PanelAssignment; students: PanelStudent[]; onImported: () => void }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'UNCHECKED' | 'ALL' | 'PICK'>('UNCHECKED');
    const [batchSize, setBatchSize] = useState<number>(10);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [batchState, setBatchState] = useState<Record<string, BatchState>>({});
    const paperCache = useRef<Map<string, ArrayBuffer>>(new Map());
    const [paperOverride, setPaperOverride] = useState<Record<string, { name: string; bytes: ArrayBuffer }>>({});

    const [pasted, setPasted] = useState('');
    const [parsed, setParsed] = useState<ParsedAiReply | null>(null);
    const [saving, setSaving] = useState(false);

    const submitted = useMemo(() => students
        .filter(s => s._id && s.link)
        .map(s => ({ ...s, _id: s._id as string, link: s.link as string }))
        .sort((a, b) => (a.student.name || '').localeCompare(b.student.name || '')), [students]);
    const graded = submitted.filter(s => s.status === 'CORRECTED');
    const unchecked = submitted.filter(s => s.status !== 'CORRECTED');

    const selected = mode === 'ALL' ? submitted : mode === 'UNCHECKED' ? unchecked : submitted.filter(s => picked.has(s._id));

    const paperFor = (board: string | null): string | null => {
        if (assignment.boardWise) return (board && assignment.boardContent?.[board]) || null;
        return typeof assignment.content === 'string' && assignment.content.startsWith('http') ? assignment.content : null;
    };

    const batches: Batch[] = useMemo(() => {
        const groups = new Map<string, typeof selected>();
        for (const s of selected) {
            const key = assignment.boardWise ? (s.student.board || 'No board') : 'ALL';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(s);
        }
        const out: Batch[] = [];
        for (const [key, list] of groups) {
            const board = assignment.boardWise ? (key === 'No board' ? null : key) : null;
            for (let i = 0; i < list.length; i += batchSize) {
                const chunk = list.slice(i, i + batchSize);
                out.push({
                    key: `${key}-${i / batchSize}-${chunk.map(c => c._id).join('.')}`,
                    no: out.length + 1,
                    board,
                    paperUrl: paperFor(board),
                    students: chunk.map(c => ({ submissionId: c._id, code: submissionCode(c._id), name: c.student.name, board: c.student.board || null, link: c.link })),
                });
            }
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected.map(s => s._id).join(','), assignment._id, batchSize]);

    const paperKey = (b: Batch) => b.board || 'ALL';

    const setBS = (key: string, st: BatchState) => setBatchState(prev => ({ ...prev, [key]: st }));

    const buildBatch = async (b: Batch) => {
        setBS(b.key, { status: 'building', progress: 'Question paper...' });
        const problems: string[] = [];
        try {
            // 1. Question paper (first pages of every file)
            const pk = paperKey(b);
            let paperBytes = paperOverride[pk]?.bytes || paperCache.current.get(pk);
            if (!paperBytes) {
                if (!b.paperUrl) throw new Error(`No question paper link${b.board ? ` for ${b.board}` : ''}. Choose the paper PDF from your computer below.`);
                try {
                    paperBytes = await fetchDrivePdf(b.paperUrl);
                    paperCache.current.set(pk, paperBytes);
                } catch (e: any) {
                    throw new Error(`Could not download the question paper (${e.message}). Choose the paper PDF from your computer below.`);
                }
            }
            const out = await PDFDocument.create();
            out.setTitle(`${assignment.title} - batch ${b.no}`);
            const fonts = { bold: await out.embedFont(StandardFonts.HelveticaBold), reg: await out.embedFont(StandardFonts.Helvetica) };
            const paper = await PDFDocument.load(paperBytes, { ignoreEncryption: true });
            (await out.copyPages(paper, paper.getPageIndices())).forEach(p => out.addPage(p));

            // 2. Download the submissions (3 at a time) ...
            const files: (ArrayBuffer | null)[] = new Array(b.students.length).fill(null);
            let done = 0;
            let next = 0;
            const worker = async () => {
                while (next < b.students.length) {
                    const i = next++;
                    try { files[i] = await fetchDrivePdf(b.students[i].link); }
                    catch (e: any) { problems.push(`${b.students[i].name}: ${e.message}`); }
                    done++;
                    setBS(b.key, { status: 'building', progress: `Submissions ${done}/${b.students.length}...` });
                }
            };
            await Promise.all([worker(), worker(), worker()]);

            // 3. ... and append each behind its separator page
            for (let i = 0; i < b.students.length; i++) {
                const s = b.students[i];
                let sub: PDFDocument | null = null;
                if (files[i]) {
                    try { sub = await PDFDocument.load(files[i]!, { ignoreEncryption: true }); }
                    catch { problems.push(`${s.name}: the PDF file is damaged`); }
                }
                addSeparatorPage(out, fonts, s, i + 1, b.students.length, sub ? sub.getPageCount() : null);
                if (sub) (await out.copyPages(sub, sub.getPageIndices())).forEach(p => out.addPage(p));
            }
            addEndPage(out, fonts, b.students);

            setBS(b.key, { status: 'building', progress: 'Saving PDF...' });
            const bytes = await out.save();
            const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${ascii(assignment.title).replace(/[^\w\- ]+/g, '').trim() || 'Assignment'} - Batch ${b.no}${b.board ? ` (${b.board})` : ''} - ${b.students.length} students.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
            setBS(b.key, { status: 'done', problems });
        } catch (e: any) {
            setBS(b.key, { status: 'error', progress: e.message, problems });
        }
    };

    const buildAll = async () => {
        for (const b of batches) await buildBatch(b);
    };

    const copyPrompt = async (b: Batch) => {
        const text = buildGradingPrompt({
            assignmentId: assignment._id,
            title: assignment.title,
            board: b.board,
            batchNo: b.no,
            batchCount: batches.length,
            students: b.students.map(s => ({ code: s.code, name: ascii(s.name) })),
        });
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`Prompt for batch ${b.no} copied`);
        } catch {
            toast.error('Could not copy to clipboard');
        }
    };

    // ------------------------------------------------------------- import
    const codeToStudent = useMemo(() => {
        const m = new Map<string, (typeof submitted)[number]>();
        submitted.forEach(s => m.set(submissionCode(s._id), s));
        return m;
    }, [submitted]);

    const parse = (text: string) => {
        setPasted(text);
        setParsed(text.trim() ? parseAiGradingReply(text) : null);
    };

    const matched = parsed ? parsed.results.filter(r => codeToStudent.has(r.code)) : [];
    const unknownCodes = parsed ? parsed.results.filter(r => !codeToStudent.has(r.code)).map(r => r.code) : [];
    const wrongAssignment = !!(parsed?.assignmentCode && parsed.assignmentCode !== assignmentCode(assignment._id));

    const save = async () => {
        if (!parsed || matched.length === 0) return;
        if (wrongAssignment && !confirm(`This reply is labelled for assignment ${parsed.assignmentCode}, but this is ${assignmentCode(assignment._id)}. Save anyway?`)) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/assignments/${assignment._id}/ai-grades`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ results: matched.map(r => ({ code: r.code, review: r.review })) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            toast.success(`Saved: ${data.graded} graded${data.flagged ? `, ${data.flagged} flagged unreadable` : ''}`);
            setPasted('');
            setParsed(null);
            onImported();
        } catch (e: any) {
            toast.error(e.message || 'Could not save');
        } finally {
            setSaving(false);
        }
    };

    const gradeStyle = (g: string | null) =>
        g === 'GOOD' ? 'bg-lime-400/15 text-lime-300 border-lime-300/40'
            : g === 'SATISFACTORY' ? 'bg-amber-400/15 text-amber-200 border-amber-300/40'
                : g === 'POOR' ? 'bg-rose-500/15 text-rose-300 border-rose-400/40'
                    : 'bg-white/10 text-slate-300 border-white/15';

    return (
        <div className="relative sd-gborder sd-card bg-[#140d27]/90 rounded-2xl overflow-hidden mb-6 sm:mb-8">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-black sd-title">AI Checking (Gemini)</h2>
                        <p className="text-[11px] sm:text-xs text-violet-200/60">
                            {submitted.length} submitted · <span className="text-lime-300">{graded.length} checked</span> · <span className="text-amber-300">{unchecked.length} not checked</span>
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp className="h-5 w-5 text-violet-200/60 shrink-0" /> : <ChevronDown className="h-5 w-5 text-violet-200/60 shrink-0" />}
            </button>

            {open && (
                <div className="border-t border-white/10 p-4 sm:p-5 space-y-6">
                    {/* STEP 1 */}
                    <section className="space-y-3">
                        <h3 className="text-sm font-black text-white">1 · Choose the submissions</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {([
                                ['UNCHECKED', `Not checked (${unchecked.length})`],
                                ['ALL', `All (${submitted.length})`],
                                ['PICK', 'Pick students'],
                            ] as const).map(([m, label]) => (
                                <button key={m} onClick={() => setMode(m)}
                                    className={`px-2 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${mode === m ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-500/25' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        {mode === 'PICK' && (
                            <div className="rounded-xl bg-black/20 border border-white/10">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-xs">
                                    <span className="text-violet-200/60">{picked.size} selected</span>
                                    <div className="flex gap-3">
                                        <button className="text-fuchsia-300 font-bold" onClick={() => setPicked(new Set(submitted.map(s => s._id)))}>All</button>
                                        <button className="text-amber-300 font-bold" onClick={() => setPicked(new Set(unchecked.map(s => s._id)))}>Not checked</button>
                                        <button className="text-slate-400 font-bold" onClick={() => setPicked(new Set())}>None</button>
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                                    {submitted.map(s => (
                                        <label key={s._id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5">
                                            <input type="checkbox" checked={picked.has(s._id)}
                                                onChange={e => setPicked(prev => { const n = new Set(prev); if (e.target.checked) n.add(s._id); else n.delete(s._id); return n; })}
                                                className="rounded border-white/20 bg-[#1d1535] text-fuchsia-500 focus:ring-fuchsia-500/30" />
                                            <span className="flex-1 min-w-0 text-sm text-white truncate">{s.student.name}</span>
                                            {s.student.board && <span className="text-[10px] text-cyan-200/70">{s.student.board}</span>}
                                            {s.status === 'CORRECTED'
                                                ? <span className="text-[10px] font-bold text-lime-300">Checked</span>
                                                : s.aiReview?.unreadable ? <span className="text-[10px] font-bold text-amber-300">Unreadable</span>
                                                    : <span className="text-[10px] font-bold text-slate-400">Not checked</span>}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* STEP 2 */}
                    <section className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-black text-white">2 · Download the batches &amp; copy their prompts</h3>
                            <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-[11px] text-violet-200/60">
                                Students per PDF:
                                {BATCH_SIZES.map(n => (
                                    <button key={n} onClick={() => setBatchSize(n)}
                                        className={`px-2 py-0.5 rounded-md font-bold ${batchSize === n ? 'bg-fuchsia-600 text-white' : 'bg-white/5 text-slate-300'}`}>{n}</button>
                                ))}
                            </div>
                            {batches.length > 1 && (
                                <button onClick={buildAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold">
                                    <Download className="h-3.5 w-3.5" /> Download all {batches.length}
                                </button>
                            )}
                            </div>
                        </div>
                        <p className="text-[11px] sm:text-xs text-violet-200/60 leading-relaxed">
                            Each PDF = the question paper, then up to {batchSize} answer sheets, each behind a page showing the student&apos;s CODE.
                            In <a href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer" className="text-fuchsia-300 underline inline-flex items-center gap-0.5">Gemini <ExternalLink className="h-3 w-3" /></a>
                            {' '}start a new chat for each batch: attach the PDF, paste that batch&apos;s prompt, send, then copy the JSON reply into step 3.
                        </p>
                        {batches.length === 0 ? (
                            <p className="text-sm text-violet-200/50 py-3">No submissions selected.</p>
                        ) : (
                            <div className="space-y-2">
                                {batches.map(b => {
                                    const st = batchState[b.key] || { status: 'idle' };
                                    const pk = paperKey(b);
                                    return (
                                        <div key={b.key} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white">
                                                        Batch {b.no}{b.board ? <span className="text-cyan-300"> · {b.board}</span> : null}
                                                        <span className="text-violet-200/50 font-medium"> · {b.students.length} student{b.students.length === 1 ? '' : 's'}</span>
                                                    </p>
                                                    <p className="text-[11px] text-violet-200/50 truncate">{b.students.map(s => s.name).join(', ')}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 sm:flex">
                                                    <button onClick={() => buildBatch(b)} disabled={st.status === 'building'}
                                                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white text-xs font-bold disabled:opacity-60 active:scale-95 transition-transform">
                                                        {st.status === 'building' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                                        PDF
                                                    </button>
                                                    <button onClick={() => copyPrompt(b)}
                                                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold active:scale-95 transition-transform">
                                                        <Copy className="h-3.5 w-3.5" /> Prompt
                                                    </button>
                                                </div>
                                            </div>
                                            {st.status === 'building' && <p className="mt-2 text-[11px] text-fuchsia-200">{st.progress}</p>}
                                            {st.status === 'done' && <p className="mt-2 text-[11px] text-lime-300 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Downloaded</p>}
                                            {st.status === 'error' && <p className="mt-2 text-[11px] text-rose-300">{st.progress}</p>}
                                            {(st.problems || []).length > 0 && (
                                                <ul className="mt-2 text-[11px] text-amber-200 list-disc pl-4 space-y-0.5">
                                                    {st.problems!.map((p, i) => <li key={i}>{p} (the AI is told to mark it unreadable)</li>)}
                                                </ul>
                                            )}
                                            {(st.status === 'error' || paperOverride[pk] || !b.paperUrl) && (
                                                <label className="mt-2 flex items-center gap-2 text-[11px] text-violet-200/70 cursor-pointer">
                                                    <FileText className="h-3.5 w-3.5" />
                                                    {paperOverride[pk] ? `Question paper: ${paperOverride[pk].name}` : 'Choose the question paper PDF from this device'}
                                                    <input type="file" accept="application/pdf" className="hidden"
                                                        onChange={async e => {
                                                            const f = e.target.files?.[0];
                                                            if (!f) return;
                                                            const bytes = await f.arrayBuffer();
                                                            setPaperOverride(prev => ({ ...prev, [pk]: { name: f.name, bytes } }));
                                                            setBS(b.key, { status: 'idle' });
                                                            e.target.value = '';
                                                        }} />
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* STEP 3 */}
                    <section className="space-y-3">
                        <h3 className="text-sm font-black text-white">3 · Paste the AI&apos;s JSON reply</h3>
                        <textarea
                            value={pasted}
                            onChange={e => parse(e.target.value)}
                            placeholder='Paste the whole reply here (the ```json ... ``` block). You can paste one batch at a time.'
                            rows={5}
                            className="w-full bg-[#0b0718] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-fuchsia-500/50"
                        />
                        {parsed && (
                            <div className="space-y-2">
                                {parsed.errors.map((e, i) => (
                                    <p key={i} className="text-xs text-rose-300 flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{e}</p>
                                ))}
                                {wrongAssignment && (
                                    <p className="text-xs text-amber-200 flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                        This reply says assignment {parsed.assignmentCode}, but this page is {assignmentCode(assignment._id)}. Check you pasted the right reply.
                                    </p>
                                )}
                                {unknownCodes.length > 0 && (
                                    <p className="text-xs text-amber-200 flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                        Not found in this assignment (will be skipped): {unknownCodes.join(', ')}
                                    </p>
                                )}
                                {matched.length > 0 && (
                                    <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
                                        {matched.map(r => {
                                            const s = codeToStudent.get(r.code)!;
                                            return (
                                                <div key={r.code} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 bg-white/[0.02]">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-white truncate">{s.student.name} <span className="text-[10px] font-mono text-violet-200/50">{r.code}</span></p>
                                                        {r.warnings.map((w, i) => <p key={i} className="text-[11px] text-amber-200">{w}</p>)}
                                                        {r.review.unreadable && <p className="text-[11px] text-amber-200">Unreadable{r.review.unreadableNote ? `: ${r.review.unreadableNote}` : ''} - will stay unchecked for you to check manually</p>}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[11px] text-lime-300 font-bold">✓{r.review.correct}</span>
                                                        <span className="text-[11px] text-rose-300 font-bold">✗{r.review.incorrect}</span>
                                                        <span className="text-[11px] text-slate-300 font-bold">⊘{r.review.skippedOrIncomplete}</span>
                                                        <span className="text-[11px] text-violet-200/50">{r.review.feedback.length} notes</span>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${gradeStyle(r.computedGrade)}`}>{r.computedGrade || 'UNREADABLE'}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {matched.length > 0 && (
                                    <button onClick={save} disabled={saving}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 text-white text-sm font-black shadow-lg shadow-lime-500/20 disabled:opacity-60 active:scale-95 transition-transform">
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                        Save {matched.length} result{matched.length === 1 ? '' : 's'}
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
