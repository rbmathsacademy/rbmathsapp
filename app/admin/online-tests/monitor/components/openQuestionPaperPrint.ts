import katex from 'katex';

// ── LaTeX rendering ──────────────────────────────────────────

/**
 * Renders all LaTeX expressions in a text string to HTML using KaTeX.
 * Handles: $$...$$  $...$  \(...\)  \[...\]
 */
function renderLatex(text: string): string {
    if (!text) return '';

    // Escape HTML first (to prevent XSS from question text), then render math
    // Process in order: block math first (to avoid $ matching inside $$)
    let result = text;

    // Block math: $$...$$  → display mode
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_m, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, trust: true });
        } catch {
            return `<span class="math-error">[Math: ${math}]</span>`;
        }
    });

    // Block math: \[ ... \]  → display mode
    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_m, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, trust: true });
        } catch {
            return `<span class="math-error">[Math: ${math}]</span>`;
        }
    });

    // Inline math: $...$
    result = result.replace(/\$([^\$\n]+?)\$/g, (_m, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, trust: true });
        } catch {
            return `<span class="math-error">[Math]</span>`;
        }
    });

    // Inline math: \( ... \)
    result = result.replace(/\\\(([^)]*?)\\\)/g, (_m, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, trust: true });
        } catch {
            return `<span class="math-error">[Math]</span>`;
        }
    });

    // Convert newlines to <br>
    result = result.replace(/\n/g, '<br>');

    return result;
}

// ── Interfaces ───────────────────────────────────────────────

export interface QuestionPaperTestInfo {
    title: string;
    batches: string[];
    startTime?: string;
    totalMarks: number;
    duration: number; // minutes
}

export interface QuestionPaperFullTest {
    isBoardSpecific?: boolean;
    boardQuestionSets?: Array<{
        boards: string[];
        questions: any[];
    }>;
    questions?: Array<{
        id: string;
        text: string;
        type: 'mcq' | 'msq' | 'fillblank' | 'broad' | 'comprehension';
        topic?: string;
        marks: number;
        negativeMarks?: number;
        options?: string[];
        image?: string;
        comprehensionText?: string;
        comprehensionImage?: string;
        subQuestions?: Array<{
            id: string;
            text: string;
            type: 'mcq' | 'msq' | 'fillblank';
            marks: number;
            negativeMarks?: number;
            options?: string[];
        }>;
    }>;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ── Main function ─────────────────────────────────────────────

/**
 * Opens a new browser window with the question paper rendered with KaTeX math,
 * then automatically triggers the print dialog.
 */
export function openQuestionPaperPrint(
    fullTest: QuestionPaperFullTest,
    testInfo: QuestionPaperTestInfo
) {
    // ── Derive header fields ──────────────────────────────────
    const batchStr = testInfo.batches?.join(', ') || '—';

    let dateStr = '—';
    if (testInfo.startTime) {
        const d = new Date(testInfo.startTime);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        dateStr = `${dd}.${mm}.${yyyy}`;
    }

    const topicSet = new Set<string>();
    const allQuestionsForTopics = (fullTest.isBoardSpecific && fullTest.boardQuestionSets && fullTest.boardQuestionSets.length > 0)
        ? fullTest.boardQuestionSets.flatMap(s => s.questions || [])
        : (fullTest.questions || []);

    allQuestionsForTopics.forEach((q: any) => {
        if (q.topic && q.topic.trim()) topicSet.add(q.topic.trim());
    });
    const topicsStr = topicSet.size > 0 ? Array.from(topicSet).join(', ') : '—';

    const durationMins = testInfo.duration || 0;
    const dHours = Math.floor(durationMins / 60);
    const dMins = durationMins % 60;
    let timeStr = '';
    if (dHours > 0) timeStr += `${dHours}hour `;
    if (dMins > 0) timeStr += `${dMins}mins`;
    if (!timeStr) timeStr = `${durationMins}mins`;
    timeStr = timeStr.trim();

    // ── Build question HTML ──────────────────────────────────
    const renderQuestionList = (qList: any[]) => {
        let outHtml = '';
        let qNum = 0;
        for (const question of qList) {
            if (question.type === 'comprehension') {
                outHtml += `<div class="comprehension-block">`;
                outHtml += `<div class="comprehension-label">[Read the following passage and answer the questions below]</div>`;
                if (question.comprehensionText) {
                    outHtml += `<div class="comprehension-text">${renderLatex(question.comprehensionText)}</div>`;
                }
                if (question.comprehensionImage) {
                    outHtml += `<img src="${question.comprehensionImage}" class="question-image" alt="Passage image"/>`;
                }

                const subQs = question.subQuestions || [];
                for (const sq of subQs) {
                    qNum++;
                    outHtml += buildQuestionHtml(qNum, sq.text, sq.type, sq.marks, sq.negativeMarks, sq.options);
                }
                outHtml += `</div>`;
            } else {
                qNum++;
                outHtml += buildQuestionHtml(
                    qNum, question.text, question.type, question.marks, question.negativeMarks,
                    question.options, question.image
                );
            }
        }
        return outHtml;
    };

    let questionsHtml = '';
    if (fullTest.isBoardSpecific && fullTest.boardQuestionSets && fullTest.boardQuestionSets.length > 0) {
        for (const set of fullTest.boardQuestionSets) {
            questionsHtml += `<div style="margin: 20px 0 10px 0; padding: 6px 12px; background: #eee; font-weight: bold; font-size: 12pt; border-left: 4px solid #333;">
                Section: Board (${set.boards.join(', ')})
            </div>`;
            questionsHtml += renderQuestionList(set.questions || []);
        }
    } else {
        questionsHtml = renderQuestionList(fullTest.questions || []);
    }

    // ── Get KaTeX CSS from the current page's loaded stylesheets ──
    // We'll link to the CDN for the print window since we can't easily extract it
    // KaTeX version matching the installed package (0.16.x)
    const katexCssUrl = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';

    // ── Build full HTML document ──────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${escapeHtml(testInfo.title)} — Question Paper</title>
    <link rel="stylesheet" href="${katexCssUrl}" crossorigin="anonymous"/>
    <style>
        /* ── Reset & base ── */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            color: #000;
            background: #fff;
            padding: 16mm 18mm 14mm 18mm;
        }

        /* ── Academy header ── */
        .academy-name {
            text-align: center;
            font-size: 20pt;
            font-weight: bold;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .header-rule {
            border: none;
            border-top: 1.5px solid #000;
            margin: 5px 0 8px 0;
        }
        .header-rule-thin {
            border: none;
            border-top: 0.5px solid #555;
            margin: 6px 0 10px 0;
        }

        /* ── Info block ── */
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0;
            font-size: 10.5pt;
            line-height: 1.7;
        }
        .info-table td { vertical-align: top; }
        .info-table td.left { width: 60%; }
        .info-table td.right { width: 40%; text-align: right; }
        .info-label { font-weight: bold; }

        /* ── Questions ── */
        .questions-section { margin-top: 2px; }

        .question-block {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 8px;
            padding-bottom: 4px;
        }

        .question-text {
            display: flex;
            align-items: flex-start;
            gap: 4px;
            margin-bottom: 4px;
            line-height: 1.5;
        }
        .question-num {
            font-weight: bold;
            min-width: 28px;
            flex-shrink: 0;
        }
        .question-body {
            flex: 1;
        }
        .marks-label {
            font-size: 8.5pt;
            color: #555;
            white-space: nowrap;
            flex-shrink: 0;
            align-self: flex-start;
            padding-top: 2px;
        }

        /* Question image */
        .question-image {
            max-width: 60%;
            max-height: 140px;
            display: block;
            margin: 4px 0 4px 28px;
            object-fit: contain;
        }

        /* ── MCQ options in 2 columns ── */
        .options-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1px 12px;
            margin-top: 3px;
            margin-left: 28px;
            font-size: 10.5pt;
            line-height: 1.45;
        }
        .option-item {
            display: flex;
            align-items: flex-start;
            gap: 4px;
        }
        .option-label {
            font-weight: bold;
            min-width: 18px;
            flex-shrink: 0;
        }

        /* Fill in blank */
        .fillblank-line {
            display: inline-block;
            border-bottom: 1px solid #000;
            min-width: 120px;
            margin-left: 28px;
            margin-top: 4px;
            height: 16px;
        }

        /* Broad / writing space */
        .writing-space {
            margin-left: 28px;
            margin-top: 4px;
            height: 8px;
        }

        /* ── Comprehension ── */
        .comprehension-block {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 0.5px solid #999;
            padding: 8px 10px 6px 10px;
            margin-bottom: 8px;
            border-radius: 2px;
        }
        .comprehension-label {
            font-style: italic;
            font-size: 9.5pt;
            color: #444;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .comprehension-text {
            font-style: italic;
            font-size: 10.5pt;
            line-height: 1.5;
            margin-bottom: 6px;
            padding-left: 4px;
            border-left: 2px solid #aaa;
        }

        /* ── KaTeX overrides for print ── */
        .katex { font-size: 1em !important; }
        .katex-display { margin: 4px 0 !important; overflow-x: auto; }
        .math-error { color: red; font-size: 8pt; }

        /* ── Print specific ── */
        @page {
            size: A4 portrait;
            margin: 16mm 18mm 14mm 18mm;
        }
        @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            a { text-decoration: none; color: inherit; }
        }

        /* ── Print button (not printed) ── */
        .print-btn-bar {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999;
        }
        .print-btn {
            background: #16a34a;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-family: sans-serif;
        }
        .print-btn:hover { background: #15803d; }
    </style>
</head>
<body>

    <!-- Print button (hidden when printing) -->
    <div class="print-btn-bar no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>

    <!-- Academy header -->
    <div class="academy-name">RB Maths Academy</div>
    <hr class="header-rule"/>

    <!-- Info block -->
    <table class="info-table">
        <tr>
            <td class="left">
                <span class="info-label">Batch :</span> ${escapeHtml(batchStr)}
            </td>
            <td class="right">
                <span class="info-label">Date :</span> ${escapeHtml(dateStr)}
            </td>
        </tr>
        <tr>
            <td class="left" colspan="2">
                <span class="info-label">Topics :</span> ${escapeHtml(topicsStr)}
            </td>
        </tr>
        <tr>
            <td class="left">
                <span class="info-label">Full Marks :</span> ${testInfo.totalMarks}
            </td>
            <td class="right">
                <span class="info-label">Time :</span> ${escapeHtml(timeStr)}
            </td>
        </tr>
    </table>
    <hr class="header-rule-thin"/>

    <!-- Questions -->
    <div class="questions-section">
        ${questionsHtml}
    </div>

</body>
</html>`;

    // ── Open print window ─────────────────────────────────────
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
        alert('Please allow pop-ups for this site to open the question paper.');
        return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
}

// ── Helpers ───────────────────────────────────────────────────

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildQuestionHtml(
    num: number,
    text: string,
    type: string,
    marks: number,
    negativeMarks?: number,
    options?: string[],
    image?: string
): string {
    const marksLabel = negativeMarks && negativeMarks > 0
        ? `[${marks} | −${negativeMarks}]`
        : `[${marks}]`;

    let html = `<div class="question-block">`;

    // Question text row
    html += `<div class="question-text">
        <span class="question-num">${num}.</span>
        <span class="question-body">${renderLatex(text)}</span>
        <span class="marks-label">${marksLabel}</span>
    </div>`;

    // Image (if any)
    if (image) {
        html += `<img src="${image}" class="question-image" alt="Question ${num} image"/>`;
    }

    // Options / answer area
    if ((type === 'mcq' || type === 'msq') && options && options.length > 0) {
        html += `<div class="options-grid">`;
        options.forEach((opt, i) => {
            html += `<div class="option-item">
                <span class="option-label">${OPTION_LABELS[i] || String(i + 1)})</span>
                <span>${renderLatex(opt)}</span>
            </div>`;
        });
        html += `</div>`;
    } else if (type === 'fillblank') {
        html += `<div class="fillblank-line"></div>`;
    } else if (type === 'broad') {
        html += `<div class="writing-space"></div>`;
    }

    html += `</div>`;
    return html;
}
