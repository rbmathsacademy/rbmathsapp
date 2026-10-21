import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WeaknessReport, StudentWeakness, WeaknessEntry } from '@/lib/weakness/types';

type RGB = [number, number, number];
const C = {
    navy: [30, 58, 95] as RGB,
    dark: [17, 24, 39] as RGB,
    gray: [107, 114, 128] as RGB,
    light: [229, 231, 235] as RGB,
    white: [255, 255, 255] as RGB,
    green: [5, 150, 105] as RGB,
    greenBg: [220, 252, 231] as RGB,
    red: [220, 38, 38] as RGB,
    redBg: [254, 226, 226] as RGB,
    orange: [234, 88, 12] as RGB,
    orangeBg: [255, 237, 213] as RGB,
    amber: [202, 138, 4] as RGB,
    amberBg: [254, 249, 195] as RGB,
    blue: [37, 99, 235] as RGB,
};
const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const LEVEL: Record<string, { fg: RGB; bg: RGB; label: string }> = {
    Critical: { fg: C.red, bg: C.redBg, label: 'CRITICAL' },
    Weak: { fg: C.orange, bg: C.orangeBg, label: 'WEAK' },
    Watch: { fg: C.amber, bg: C.amberBg, label: 'WATCH' },
};

// jsPDF's built-in fonts only cover basic Latin, so anything else is flattened to ASCII.
const clean = (t: string | null | undefined) =>
    (t || '')
        .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
        .replace(/[–—]/g, '-').replace(/•/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=')
        .replace(/[^\x20-\x7E]/g, '').trim();

const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' }) : '-';

function footer(doc: jsPDF, page: number, pageH: number) {
    const y = pageH - 16;
    doc.setDrawColor(...C.gray);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.setFont('helvetica', 'normal');
    doc.text('© RB Maths Academy - 9804696360 (Dr. Ritwick Banerjee)', MARGIN, y + 5);
    doc.text(`Page ${page}`, PAGE_W - MARGIN, y + 5, { align: 'right' });
}

/** Inline LaTeX from the AI checker's notes, flattened to readable plain text for the PDF fonts. */
function latexToPlain(t: string): string {
    let s = (t || '').replace(/\$/g, '');
    for (let i = 0; i < 3; i++) {
        s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
            .replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, '$1-root($2)')
            .replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')
            .replace(/\\(?:text|textbf|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, '$1');
    }
    const words: Record<string, string> = {
        times: 'x', cdot: '.', div: '/', pm: '+/-', le: '<=', leq: '<=', ge: '>=', geq: '>=', ne: '!=', neq: '!=', infty: 'infinity',
        to: '->', rightarrow: '->', Rightarrow: '=>', implies: '=>', circ: ' deg', degree: ' deg', pi: 'pi', theta: 'theta', alpha: 'alpha',
        beta: 'beta', gamma: 'gamma', lambda: 'lambda', int: 'integral ', sum: 'sum ', lim: 'lim', left: '', right: '', quad: ' ', ',': ' ',
    };
    s = s.replace(/\\([A-Za-z]+|,)/g, (_, w) => (w in words ? words[w] : w))
        .replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/_\{([^{}]*)\}/g, '_$1')
        .replace(/[{}]/g, '').replace(/\s+/g, ' ');
    return clean(s);
}

const ERROR_ADVICE: Record<string, string> = {
    CONCEPT: 'The idea itself is not yet clear - go back to the theory and worked examples before practising.',
    METHOD: 'Picks an unsuitable method - practise choosing the right approach for each type of question.',
    FORMULA: 'Formulas/identities are being misremembered - make a formula sheet and revise it daily.',
    CALCULATION: 'The method is right but calculation slips cost marks - slow down and re-check each step.',
    SIGN: 'Sign errors cost marks - check the signs at every step.',
    INCOMPLETE_STEPS: 'Leaves working unfinished - complete every step and write the final answer clearly.',
};

function advice(w: WeaknessEntry): string {
    if (w.source === 'assignments') return 'Assignments on this topic were rated poorly by the teacher. Revise the basics and redo the assignment carefully.';
    const top = Object.entries(w.errorTypes || {}).filter(([e]) => e in ERROR_ADVICE).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) return ERROR_ADVICE[top[0]];
    if (w.level === 'Critical') return 'Needs focused re-teaching of this area and regular practice until it is secure.';
    if (w.level === 'Weak') return 'Revise the concepts and practise more questions of this type.';
    return 'Keep an eye on it - a little extra practice should fix it.';
}

/** Draws one student's page content starting at y=0 on the given doc; returns the final y. */
function drawStudent(doc: jsPDF, s: StudentWeakness, batch: string): number {
    // Header
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PAGE_W, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...C.white);
    doc.text(clean(s.name), MARGIN, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(clean([batch, s.schoolName, s.board].filter(Boolean).join('  |  ')), MARGIN, 18);
    doc.setFontSize(8);
    doc.text('Learning Gaps Report', PAGE_W - MARGIN, 11, { align: 'right' });

    let y = 31;

    // Summary cards
    const cards = [
        { label: 'Tests taken', value: `${s.overall.testsTaken}`, color: C.blue },
        { label: 'Avg test score', value: s.overall.avgTestPct == null ? '-' : `${s.overall.avgTestPct}%`, color: C.green },
        { label: 'Batch avg', value: s.overall.batchAvgTestPct == null ? '-' : `${s.overall.batchAvgTestPct}%`, color: C.gray },
        { label: 'Question accuracy', value: s.overall.accuracy == null ? '-' : `${s.overall.accuracy}%`, color: C.navy },
    ];
    const cw = (CONTENT_W - 9) / 4;
    cards.forEach((c, i) => {
        const x = MARGIN + i * (cw + 3);
        doc.setFillColor(...c.color);
        doc.roundedRect(x, y, cw, 14, 2, 2, 'F');
        doc.setTextColor(...C.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(c.value, x + cw / 2, y + 7, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text(c.label, x + cw / 2, y + 12, { align: 'center' });
    });
    y += 19;

    // Overview sentence
    const a = s.overall.assignments;
    const crit = s.weaknesses.filter(w => w.level === 'Critical').length;
    const overview = s.weaknesses.length === 0
        ? 'No clear weak areas were found in the tests and assignments so far. Keep up the good work.'
        : `${s.weaknesses.length} area${s.weaknesses.length > 1 ? 's' : ''} need attention` +
        (crit ? ` (${crit} critical)` : '') + '. The list below shows the topic and the exact sub-topic where the student repeatedly loses marks.' +
        (a.rated ? ` Assignments rated so far: ${a.good} good, ${a.satisfactory} satisfactory, ${a.poor} poor.` : '') +
        (() => {
            const hw = s.overall.homework;
            if (!hw || hw.checked === 0) return '';
            const top = Object.entries(hw.errorProfile).filter(([e]) => e !== 'NOT_ATTEMPTED').sort((x, z) => z[1] - x[1]).slice(0, 2)
                .map(([e]) => ({ CONCEPT: 'gaps in concepts', METHOD: 'choice of method', FORMULA: 'formulas', CALCULATION: 'calculation slips', SIGN: 'sign errors', INCOMPLETE_STEPS: 'unfinished working', OTHER: 'other errors' } as Record<string, string>)[e] || e);
            return ` In ${hw.checked} checked homework${hw.checked > 1 ? 's' : ''} (${hw.accuracy ?? '-'}% of questions correct)${top.length ? `, most marks were lost to ${top.join(' and ')}` : ''}.`;
        })();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    const ov = doc.splitTextToSize(overview, CONTENT_W);
    doc.text(ov, MARGIN, y);
    y += ov.length * 4.4 + 4;

    // Weaknesses grouped by topic
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.navy);
    doc.text('Where the student needs help', MARGIN, y);
    doc.setDrawColor(...C.navy);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y + 1.8, MARGIN + 58, y + 1.8);
    y += 6;

    if (s.weaknesses.length > 0) {
        const byTopic = new Map<string, WeaknessEntry[]>();
        s.weaknesses.forEach(w => {
            if (!byTopic.has(w.topic)) byTopic.set(w.topic, []);
            byTopic.get(w.topic)!.push(w);
        });
        const body: any[] = [];
        byTopic.forEach((list, topic) => {
            body.push([{ content: clean(topic), colSpan: 5, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: C.navy } }]);
            list.forEach(w => {
                const n1 = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
                const parts: string[] = [];
                if (w.fromTests && w.fromTests.questions > 0) parts.push(`Tests: ${n1(w.fromTests.correct)}/${w.fromTests.questions} correct`);
                if (w.fromHomework && w.fromHomework.questions > 0) parts.push(`Homework: ${n1(w.fromHomework.correct)}/${w.fromHomework.questions} correct`);
                const evidence = w.source === 'assignments'
                    ? `${w.assignmentCount} assignment(s), avg ${w.assignmentAvg ?? '-'}/100`
                    : (parts.length ? parts.join('; ') : `${n1(w.correct)}/${w.questions} correct in ${w.testsAppeared} test(s)`) + (w.batchAccuracy != null ? `; batch ${w.batchAccuracy}%` : '');
                body.push([
                    clean(w.category),
                    { content: LEVEL[w.level].label, styles: { textColor: LEVEL[w.level].fg, fillColor: LEVEL[w.level].bg, fontStyle: 'bold', halign: 'center' } },
                    w.source === 'assignments' ? '-' : `${w.accuracy}%`,
                    clean(evidence),
                    clean(advice(w)),
                ]);
            });
        });
        autoTable(doc, {
            startY: y,
            head: [['Sub-topic', 'Level', 'Accuracy', 'Evidence', 'Suggestion']],
            body,
            theme: 'grid',
            margin: { left: MARGIN, right: MARGIN },
            styles: { fontSize: 8, cellPadding: 2, textColor: C.dark, lineColor: C.light, lineWidth: 0.2, valign: 'middle' },
            headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 8 },
            columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 17 }, 2: { cellWidth: 17, halign: 'center' }, 3: { cellWidth: 44 }, 4: { cellWidth: 'auto' } },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
    } else {
        y += 2;
    }

    // What went wrong in checked homework (the AI checker's notes, most useful first)
    const notes = s.weaknesses.flatMap(w => (w.mistakes || []).filter(m => m.outcome !== 'SKIPPED').map(m => ({ w, m }))).slice(0, 10);
    if (notes.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...C.navy);
        doc.text('What went wrong in the homework', MARGIN, y);
        y += 3;
        autoTable(doc, {
            startY: y,
            head: [['Area', 'Homework / Q', 'Teacher\'s note']],
            body: notes.map(({ w, m }) => [clean(`${w.topic} > ${w.category}`), clean(`${m.assignment.split('||')[0].trim()} / Q${m.question}`), latexToPlain(m.comment)]),
            theme: 'grid',
            margin: { left: MARGIN, right: MARGIN },
            styles: { fontSize: 7.5, cellPadding: 1.8, textColor: C.dark, lineColor: C.light, lineWidth: 0.2 },
            headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 8 },
            columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 34 } },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Strengths
    if (s.strengths.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...C.green);
        doc.text('Strong areas', MARGIN, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...C.dark);
        const line = s.strengths.slice(0, 8).map(t => `${clean(t.topic)} > ${clean(t.category)} (${t.accuracy}%)`).join('   |   ');
        const sl = doc.splitTextToSize(line, CONTENT_W);
        doc.text(sl, MARGIN, y);
        y += sl.length * 4.2 + 5;
    }

    // Assignments
    if (s.assignments.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...C.navy);
        doc.text('Assignments', MARGIN, y);
        y += 3;
        const qcol = (r: StudentWeakness['assignments'][number]) =>
            r.state === 'RATED' ? (r.quality === 'GOOD' ? 'Good' : r.quality === 'SATISFACTORY' ? 'Satisfactory' : 'Poor')
                : r.state === 'AWAITING_REVIEW' ? 'Awaiting review' : r.state === 'MISSED' ? 'Missed' : 'Pending';
        autoTable(doc, {
            startY: y,
            head: [['Assignment', 'Topic', 'Due', 'Result']],
            body: s.assignments.map(r => [clean(r.title), clean(r.topic || r.topicLabel || '-'), fmtDate(r.deadline), qcol(r) + (r.isLate ? ' (late)' : '')]),
            theme: 'grid',
            margin: { left: MARGIN, right: MARGIN },
            styles: { fontSize: 7.5, cellPadding: 1.8, textColor: C.dark, lineColor: C.light, lineWidth: 0.2 },
            headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 8 },
            columnStyles: { 2: { cellWidth: 22 }, 3: { cellWidth: 32 } },
            didParseCell: (h: any) => {
                if (h.section !== 'body' || h.column.index !== 3) return;
                const t = String(h.cell.raw);
                if (t.startsWith('Good')) h.cell.styles.textColor = C.green;
                else if (t.startsWith('Poor') || t.startsWith('Missed')) h.cell.styles.textColor = C.red;
                else if (t.startsWith('Satisf')) h.cell.styles.textColor = C.amber;
            },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Tests
    if (s.tests.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...C.navy);
        doc.text('Online tests', MARGIN, y);
        y += 3;
        autoTable(doc, {
            startY: y,
            head: [['Test', 'Date', 'Score']],
            body: s.tests.map(t => [clean(t.title), fmtDate(t.date), t.percentage == null ? 'Not attempted' : `${t.percentage}%`]),
            theme: 'grid',
            margin: { left: MARGIN, right: MARGIN },
            styles: { fontSize: 7.5, cellPadding: 1.8, textColor: C.dark, lineColor: C.light, lineWidth: 0.2 },
            headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 8 },
            columnStyles: { 1: { cellWidth: 24 }, 2: { cellWidth: 30 } },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    const note = doc.splitTextToSize('Weak areas are worked out from the questions answered across all online tests and from teacher ratings on assignments. A topic is flagged only when there is enough evidence from several questions.', CONTENT_W);
    doc.text(note, MARGIN, y);
    return y + note.length * 3.2 + 4;
}

/** Builds the guardian-shareable PDF. Pass `onlyStudentId` for a single student's report. */
export function generateWeaknessPDF(report: WeaknessReport, onlyStudentId?: string) {
    const students = report.students
        .filter(s => s.name && (!onlyStudentId || s.studentId === onlyStudentId))
        .sort((a, b) => a.name.localeCompare(b.name));
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const withTOC = !onlyStudentId;
    let tocPages = 0;
    if (withTOC) {
        // Measure how many contents pages are needed with a throw-away document
        const temp = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        autoTable(temp, {
            startY: 52, head: [['Sl.', 'Student', 'Areas', 'Page']],
            body: students.map((s, i) => [`${i + 1}`, s.name, '', '...']),
            margin: { left: MARGIN, right: MARGIN, bottom: 20 }, styles: { fontSize: 9, cellPadding: 2.5 },
        });
        tocPages = temp.getNumberOfPages();

        doc.setFillColor(...C.navy);
        doc.rect(0, 0, PAGE_W, 28, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...C.white);
        doc.text(clean(report.batch), PAGE_W / 2, 13, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Student Learning Gaps Report', PAGE_W / 2, 21, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(...C.gray);
        doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}`, PAGE_W / 2, 35, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...C.navy);
        doc.text('Table of Contents', MARGIN, 46);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...C.gray);
        doc.text('(Click on name to open the page)', MARGIN + 52, 46);
        doc.setDrawColor(...C.navy);
        doc.setLineWidth(0.6);
        doc.line(MARGIN, 48, MARGIN + 50, 48);

        autoTable(doc, {
            startY: 52,
            head: [['Sl.', 'Student Name', 'Areas to improve', 'Page']],
            body: students.map((s, i) => [`${i + 1}`, clean(s.name), s.weaknesses.length ? `${s.weaknesses.length}` : 'None', `${tocPages + i + 1}`]),
            theme: 'grid',
            margin: { left: MARGIN, right: MARGIN, bottom: 20 },
            styles: { fontSize: 9, cellPadding: 2.5, textColor: C.dark, lineColor: C.light, lineWidth: 0.2 },
            headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 2: { halign: 'center', cellWidth: 36 }, 3: { halign: 'center', cellWidth: 18 } },
            didDrawCell: (h: any) => {
                if (h.section === 'body' && h.column.index === 1) {
                    doc.link(h.cell.x, h.cell.y, h.cell.width, h.cell.height, { pageNumber: tocPages + h.row.index + 1 });
                }
            },
        });
    }

    const heights: Record<number, number> = {};
    for (let p = 1; p <= doc.getNumberOfPages(); p++) heights[p] = 297;

    students.forEach((s, i) => {
        // Measure on a tall scratch page, then lay the same content on a page of exactly that height
        const scratch = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAGE_W, 3000] });
        const used = drawStudent(scratch, s, report.batch);
        const pageH = Math.max(297, Math.ceil(used + 22));
        if (i === 0 && !withTOC) {
            // jsPDF starts with one blank A4 page: reuse it by resizing is not possible, so drop it
            doc.deletePage(1);
        }
        doc.addPage([PAGE_W, pageH], 'portrait');
        heights[doc.getNumberOfPages()] = pageH;
        drawStudent(doc, s, report.batch);
    });

    for (let p = 1; p <= doc.getNumberOfPages(); p++) {
        doc.setPage(p);
        footer(doc, p, heights[p] || 297);
    }

    const fileBase = onlyStudentId && students[0] ? `${students[0].name}_Learning_Gaps` : `${report.batch}_Learning_Gaps_Report`;
    doc.save(`${fileBase.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_')}.pdf`);
}

/** JSON + instructions that an admin pastes into an LLM to produce a polished guardian report. */
export function buildAIExport(report: WeaknessReport, onlyStudentId?: string): string {
    const students = report.students
        .filter(s => !onlyStudentId || s.studentId === onlyStudentId)
        .sort((a, b) => a.name.localeCompare(b.name));
    const instructions = [
        'You are helping a maths teacher prepare learning-gap reports for students\' guardians.',
        'DATA: the JSON below has one object per student, combining two kinds of evidence:',
        '  (a) ONLINE TESTS - "rawBreakdown" lists every topic/sub-topic with counts (served, correct, skipped) from tests and checked homework together; "tests" lists each test score.',
        '  (b) AI-CHECKED HOMEWORK - "checkedHomework" lists each handwritten homework that was checked question by question: every question has its topic, sub-topic, outcome (CORRECT / INCORRECT / PARTIAL / INCOMPLETE / SKIPPED), the kind of mistake ("errorType": CONCEPT, METHOD, FORMULA, CALCULATION, SIGN, INCOMPLETE_STEPS, NOT_ATTEMPTED, OTHER) and the checker\'s note (inline LaTeX in $...$). "overall.homework.errorProfile" counts the kinds of mistakes.',
        '  "weaknesses" is the system\'s own pre-computed shortlist (level Critical/Weak/Watch, "source" tests/homework/mixed, the split of evidence, and sample mistake notes). "assignments" lists every assignment with its grade; those with "aiChecked": false were only graded overall, so use the topic named in the title and treat GOOD = strength, SATISFACTORY = acceptable, POOR = weakness.',
        'TASKS: (1) Group look-alike sub-topic names (spelling or wording variants of the same idea) under suitable headings within each topic, across tests and homework. (2) Correlate the two sources for each topic >> sub-topic: weak in both = a real gap; fine in tests but weak in written homework = working/presentation problems; fine in homework but weak in tests = speed or recall under pressure. (3) Use the error types and notes to explain HOW the student goes wrong (e.g. mostly calculation slips vs not understanding the concept) and give specific, practical advice for each. (4) For every student write a kind, guardian-friendly report: strengths, then the topic >> sub-topic areas that need work with the evidence, the typical mistakes, then 2-3 practical suggestions. (5) Keep students in alphabetical order and produce a contents list with student names first. Do not invent data that is not in the JSON; ignore areas with very little evidence. Convert any LaTeX into readable maths.',
        'OUTPUT: a clean document (or HTML) that can be turned into a PDF and shared with guardians. Do not include phone numbers.',
    ].join('\n');
    const payload = {
        batch: report.batch,
        generatedAt: report.generatedAt,
        students: students.map(s => ({
            name: s.name, school: s.schoolName, board: s.board,
            overall: s.overall,
            weaknesses: s.weaknesses.map(w => ({
                topic: w.topic, subtopicHeading: w.category, level: w.level, accuracyPct: w.accuracy, batchAccuracyPct: w.batchAccuracy,
                questions: w.questions, correct: w.correct, testsAppeared: w.testsAppeared, testsWeak: w.testsWeak,
                assignmentAvg: w.assignmentAvg, source: w.source, rawSubtopicNames: w.rawSubtopics.map(r => r.subtopic),
                fromTests: w.fromTests, fromHomework: w.fromHomework, errorTypes: w.errorTypes,
                reasons: w.reasons,
                mistakeNotes: (w.mistakes || []).map(m => ({ homework: m.assignment, question: m.question, outcome: m.outcome, errorType: m.errorType, note: m.comment })),
            })),
            strengths: s.strengths,
            assignments: s.assignments.map(a => ({ title: a.title, state: a.state, quality: a.quality, late: a.isLate, matchedTopic: a.topic, aiChecked: !!a.aiChecked })),
            checkedHomework: (s.homeworkChecks || []).map(h => ({
                title: h.title, deadline: h.deadline, grade: h.grade,
                totalQuestions: h.totalQuestions, correct: h.correct, incorrect: h.incorrect, skippedOrIncomplete: h.skippedOrIncomplete,
                questions: h.questions.map(q => ({ q: q.question, topic: q.topic, subtopic: q.subtopic, outcome: q.outcome, ...(q.errorType ? { errorType: q.errorType } : {}), ...(q.comment ? { note: q.comment } : {}) })),
            })),
            tests: s.tests,
            rawBreakdown: s.rawBreakdown,
        })),
    };
    return `${instructions}\n\n=== JSON DATA ===\n${JSON.stringify(payload, null, 1)}`;
}
