import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Color palette ──
const COLORS = {
    navy: [30, 58, 95] as [number, number, number],
    blue: [37, 99, 235] as [number, number, number],
    darkText: [17, 24, 39] as [number, number, number],
    gray: [107, 114, 128] as [number, number, number],
    lightGray: [229, 231, 235] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    green: [5, 150, 105] as [number, number, number],
    red: [220, 38, 38] as [number, number, number],
    redLight: [254, 226, 226] as [number, number, number],
    purple: [139, 92, 246] as [number, number, number],
    gold: [245, 158, 11] as [number, number, number],
    goldBg: [255, 247, 237] as [number, number, number],
    // Section box backgrounds
    testBoxBg: [219, 234, 254] as [number, number, number],       // light blue
    testBoxBorder: [59, 130, 246] as [number, number, number],    // blue
    testMissedBg: [254, 202, 202] as [number, number, number],    // light red
    assignBoxBg: [220, 252, 231] as [number, number, number],     // light green
    assignBoxBorder: [34, 197, 94] as [number, number, number],   // green
    assignMissedBg: [254, 202, 202] as [number, number, number],
    offlineBoxBg: [245, 208, 254] as [number, number, number],    // light purple
    offlineBoxBorder: [168, 85, 247] as [number, number, number], // purple
    rankBg: [254, 243, 199] as [number, number, number],          // amber light
    rankBorder: [245, 158, 11] as [number, number, number],       // amber
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_Y = PAGE_H - 16;

interface StudentAnalytics {
    student: { _id: string; name: string; phoneNumber: string; joinedAt: string; schoolName?: string; board?: string };
    stats: { avgTestPercentage: number; assignmentCompletionRate: number; testsAttempted: number; testsMissed: number; assignmentsSubmitted: number; assignmentsLate: number; assignmentsMissed: number; goodQuality: number; satisfactoryQuality: number; poorQuality: number };
    tests: Array<{ testId: string; score: number | null; percentage: number | null; status: string; submittedAt: string | null; title: string; totalMarks: number; highestScore: number; averageScore: number }>;
    assignments: Array<{ assignmentId: string; status: string; submittedAt: string | null; title: string; deadline: string; quality?: string | null }>;
    offlineExams: Array<{ examId: string; chapterName: string; testDate: string; fullMarks: number; marksObtained: number; percentage: number; highestPercentage: number; averagePercentage: number; rank: number; totalStudents: number }>;
}

interface BatchData {
    batch: string;
    tests: Array<{ _id: string; title: string; totalMarks: number; highestScore: number; averageScore: number; deployment?: { startTime?: string } }>;
    assignments: Array<{ _id: string; title: string; deadline: string }>;
    analytics: StudentAnalytics[];
}

function addFooter(doc: jsPDF, pageNum: number) {
    const y = FOOTER_Y;
    doc.setDrawColor(...COLORS.gray);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.setFont('helvetica', 'normal');
    doc.text('\u00A9 RB Maths Academy - 9804696360 (Dr. Ritwick Banerjee)', MARGIN, y + 5);
    doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, y + 5, { align: 'right' });
}

function drawRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fillColor: [number, number, number], borderColor?: [number, number, number]) {
    doc.setFillColor(...fillColor);
    if (borderColor) {
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.5);
    }
    doc.roundedRect(x, y, w, h, r, r, borderColor ? 'FD' : 'F');
}

export async function generateBatchPDF(data: BatchData) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Sort students alphabetically
    const sortedStudents = [...data.analytics]
        .filter(s => s.student.name)
        .sort((a, b) => a.student.name.localeCompare(b.student.name));

    // Calculate batch ranks based on online test avg percentage
    const rankedStudents = [...sortedStudents].sort((a, b) => {
        if (b.stats.avgTestPercentage !== a.stats.avgTestPercentage)
            return b.stats.avgTestPercentage - a.stats.avgTestPercentage;
        return a.student.name.localeCompare(b.student.name);
    });
    const rankMap: Record<string, number> = {};
    rankedStudents.forEach((s, i) => { rankMap[s.student._id] = i + 1; });
    const totalStudents = sortedStudents.length;

    // Build test date lookup
    const testDateMap: Record<string, string> = {};
    data.tests.forEach(t => {
        if (t.deployment?.startTime) {
            testDateMap[t._id] = new Date(t.deployment.startTime).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' });
        }
    });

    // Build assignment title/deadline lookup
    const assignmentMap: Record<string, { title: string; deadline: string }> = {};
    data.assignments.forEach(a => {
        assignmentMap[a._id] = { title: a.title, deadline: new Date(a.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' }) };
    });

    let currentPage = 1;

    // ═══════════════════════════════════════════
    // PAGE 1: TABLE OF CONTENTS
    // ═══════════════════════════════════════════
    // Header bar
    doc.setFillColor(...COLORS.navy);
    doc.rect(0, 0, PAGE_W, 28, 'F');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text(`${data.batch}`, PAGE_W / 2, 13, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Student Progress Report', PAGE_W / 2, 21, { align: 'center' });

    // Date
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    doc.text(`Generated on ${today}`, PAGE_W / 2, 35, { align: 'center' });

    // ── Measure TOC page count using a temporary document ──
    const tempDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const tempBody = sortedStudents.map((s, i) => [`${i + 1}`, s.student.name, '...']);
    autoTable(tempDoc, {
        startY: 52,
        head: [['Sl.', 'Student Name', 'Page']],
        body: tempBody,
        theme: 'grid',
        margin: { left: MARGIN, right: MARGIN, bottom: 20 },
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 1: { cellWidth: 'auto' }, 2: { halign: 'center', cellWidth: 18 } },
    });
    const tocPageCount = tempDoc.getNumberOfPages();

    // ── Draw real TOC on main doc ──
    // TOC label
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.navy);
    doc.text('Table of Contents', MARGIN, 46);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.gray);
    doc.text('(Click on name to open the page)', MARGIN + 52, 46);
    doc.setDrawColor(...COLORS.navy);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, 48, MARGIN + 50, 48);

    const tocBody = sortedStudents.map((s, i) => [
        `${i + 1}`,
        s.student.name,
        `${tocPageCount + i + 1}`
    ]);

    autoTable(doc, {
        startY: 52,
        head: [['Sl.', 'Student Name', 'Page']],
        body: tocBody,
        theme: 'grid',
        margin: { left: MARGIN, right: MARGIN, bottom: 20 },
        styles: { fontSize: 9, cellPadding: 2.5, textColor: COLORS.darkText, lineColor: COLORS.lightGray, lineWidth: 0.2 },
        headStyles: { fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 1: { cellWidth: 'auto' }, 2: { halign: 'center', cellWidth: 18 } },
        didDrawCell: (hookData: any) => {
            if (hookData.section === 'body' && hookData.column.index === 1) {
                const idx = hookData.row.index;
                const pageNum = tocPageCount + idx + 1;
                doc.link(hookData.cell.x, hookData.cell.y, hookData.cell.width, hookData.cell.height, { pageNumber: pageNum });
            }
        }
    });

    currentPage = doc.getNumberOfPages();

    // ═══════════════════════════════════════════
    // STUDENT PAGES
    // ═══════════════════════════════════════════
    for (let si = 0; si < sortedStudents.length; si++) {
        const s = sortedStudents[si];
        doc.addPage();
        let y = 6;

        const checkPageBreak = (neededHeight: number) => {
            if (y + neededHeight > PAGE_H - 20) {
                doc.addPage();
                y = MARGIN;
            }
        };

        // ── Header bar with name + rank ──
        doc.setFillColor(...COLORS.navy);
        doc.rect(0, 0, PAGE_W, 22, 'F');

        // Name + school/board
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.white);
        doc.text(s.student.name, MARGIN, 10);

        const schoolBoard = [s.student.schoolName, s.student.board].filter(Boolean).join(' • ');
        if (schoolBoard) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(schoolBoard, MARGIN, 17);
        }

        // Rank badge (right side)
        const rank = rankMap[s.student._id] || '-';
        const rankText = `${rank}/${totalStudents}`;
        drawRoundedRect(doc, PAGE_W - MARGIN - 38, 3, 38, 16, 3, COLORS.rankBg, COLORS.rankBorder);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.darkText);
        doc.text(rankText, PAGE_W - MARGIN - 19, 11, { align: 'center' });
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.gray);
        doc.text('Rank (Online Test Avg)', PAGE_W - MARGIN - 19, 16, { align: 'center' });

        y = 27;

        // ── Summary stat cards ──
        const cardW = (CONTENT_W - 9) / 4;
        const cards = [
            { label: 'Tests Given', value: `${s.stats.testsAttempted}`, color: COLORS.blue },
            { label: 'Tests Missed', value: `${s.stats.testsMissed}`, color: COLORS.red },
            { label: 'Assignments Done', value: `${s.stats.assignmentsSubmitted}`, color: COLORS.green },
            { label: 'Assignments Missed', value: `${s.stats.assignmentsMissed}`, color: COLORS.red },
        ];
        cards.forEach((c, i) => {
            const cx = MARGIN + i * (cardW + 3);
            doc.setFillColor(c.color[0], c.color[1], c.color[2]);
            doc.roundedRect(cx, y, cardW, 14, 2, 2, 'F');
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.white);
            doc.text(c.value, cx + cardW / 2, y + 7, { align: 'center' });
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.text(c.label, cx + cardW / 2, y + 12, { align: 'center' });
        });
        y += 18;

        // ── ONLINE TESTS BOX ──
        const completedTests = s.tests.filter(t => t.status !== 'not_enrolled');
        const testTableRows: any[][] = [];
        completedTests.forEach(t => {
            const testMeta = data.tests.find(tm => tm._id === t.testId);
            const dateStr = testMeta?.deployment?.startTime
                ? new Date(testMeta.deployment.startTime).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' })
                : '';
            if (t.status === 'missed') {
                testTableRows.push([t.title, `MISSED (${dateStr})`, '-', { missed: true }]);
            } else {
                const pct = t.percentage !== null ? `${t.percentage}%` : '-';
                const highPct = t.totalMarks > 0 ? `${((t.highestScore / t.totalMarks) * 100).toFixed(1)}%` : '-';
                testTableRows.push([t.title, pct, highPct, { missed: false }]);
            }
        });

        // Section label
        checkPageBreak(40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.testBoxBorder);
        doc.text('ONLINE TESTS', MARGIN, y + 3);
        y += 5;

        const testBoxStartY = y;
        if (testTableRows.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [['Test Name', 'Score (%)', 'Highest (%)']],
                body: testTableRows.map(r => [r[0], r[1], r[2]]),
                theme: 'grid',
                margin: { left: MARGIN, right: MARGIN, bottom: 20 },
                tableWidth: CONTENT_W,
                styles: { fontSize: 7, cellPadding: 1.8, textColor: COLORS.darkText, overflow: 'ellipsize', fillColor: COLORS.testBoxBg, lineColor: COLORS.testBoxBorder, lineWidth: 0.2 },
                headStyles: { fillColor: COLORS.testBoxBorder, textColor: COLORS.white, fontStyle: 'bold', fontSize: 7 },
                columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'center', cellWidth: 28 }, 2: { halign: 'center', cellWidth: 28 } },
                didParseCell: (hookData: any) => {
                    if (hookData.section === 'body') {
                        const meta = testTableRows[hookData.row.index]?.[3];
                        if (meta?.missed) {
                            hookData.cell.styles.textColor = COLORS.red;
                            hookData.cell.styles.fontStyle = 'bold';
                            hookData.cell.styles.fillColor = COLORS.testMissedBg;
                        }
                    }
                }
            });
            y = (doc as any).lastAutoTable.finalY + 6;
        } else {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...COLORS.gray);
            doc.text('No tests available.', MARGIN + 4, y + 6);
            y += 13;
        }

        // ── ASSIGNMENTS BOX ──
        const validAssignments = s.assignments.filter(a => a.status !== 'NOT_ENROLLED');
        const assignRows: any[][] = [];
        validAssignments.forEach(a => {
            const info = assignmentMap[a.assignmentId];
            const title = a.title || info?.title || 'Assignment';
            const deadline = info?.deadline || '';
            if (a.status === 'MISSED') {
                assignRows.push([title, `MISSED (${deadline})`, { missed: true }]);
            } else {
                const qualityStr = a.quality || a.status || 'Submitted';
                assignRows.push([title, qualityStr, { missed: false }]);
            }
        });

        checkPageBreak(40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.assignBoxBorder);
        doc.text('ASSIGNMENTS', MARGIN, y + 3);
        y += 5;

        if (assignRows.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [['Assignment', 'Quality / Status']],
                body: assignRows.map(r => [r[0], r[1]]),
                theme: 'grid',
                margin: { left: MARGIN, right: MARGIN, bottom: 20 },
                tableWidth: CONTENT_W,
                styles: { fontSize: 7, cellPadding: 1.8, textColor: COLORS.darkText, overflow: 'ellipsize', fillColor: COLORS.assignBoxBg, lineColor: COLORS.assignBoxBorder, lineWidth: 0.2 },
                headStyles: { fillColor: COLORS.assignBoxBorder, textColor: COLORS.white, fontStyle: 'bold', fontSize: 7 },
                columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'center', cellWidth: 40 } },
                didParseCell: (hookData: any) => {
                    if (hookData.section === 'body') {
                        const meta = assignRows[hookData.row.index]?.[2];
                        if (meta?.missed) {
                            hookData.cell.styles.textColor = COLORS.red;
                            hookData.cell.styles.fontStyle = 'bold';
                            hookData.cell.styles.fillColor = COLORS.assignMissedBg;
                        }
                    }
                }
            });
            y = (doc as any).lastAutoTable.finalY + 6;
        } else {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...COLORS.gray);
            doc.text('No assignments available.', MARGIN + 4, y + 6);
            y += 13;
        }

        // ── LINE GRAPH: Student vs Highest ──
        // Reverse so oldest test is on the left, newest on the right
        const graphTests = completedTests.filter(t => t.status !== 'missed' && t.percentage !== null).slice().reverse();
        if (graphTests.length >= 2) {
            checkPageBreak(60);
            const graphX = MARGIN + 8;
            const graphW = CONTENT_W - 16;
            const graphH = 36;
            const graphY = y + 4;
            const graphBottom = graphY + graphH;

            // Graph title
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.darkText);
            doc.text('TEST PERFORMANCE TREND', MARGIN, y + 2);

            // Axes
            doc.setDrawColor(...COLORS.lightGray);
            doc.setLineWidth(0.3);
            doc.line(graphX, graphY, graphX, graphBottom); // Y-axis
            doc.line(graphX, graphBottom, graphX + graphW, graphBottom); // X-axis

            // Y-axis labels
            doc.setFontSize(5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLORS.gray);
            for (let p = 0; p <= 100; p += 25) {
                const ly = graphBottom - (p / 100) * graphH;
                doc.text(`${p}%`, graphX - 2, ly + 1, { align: 'right' });
                doc.setDrawColor(230, 230, 230);
                doc.setLineWidth(0.1);
                doc.line(graphX, ly, graphX + graphW, ly);
            }

            const stepX = graphW / (graphTests.length - 1);

            // X-axis test name labels (rotated)
            doc.setFontSize(4);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLORS.gray);
            graphTests.forEach((t, i) => {
                const px = graphX + i * stepX;
                const label = t.title.length > 14 ? t.title.substring(0, 13) + '..' : t.title;
                doc.text(label, px, graphBottom + 4, { angle: 35 });
            });

            // Build points
            const studentPoints: { x: number; y: number }[] = [];
            const highestPoints: { x: number; y: number }[] = [];
            graphTests.forEach((t, i) => {
                const px = graphX + i * stepX;
                const studentPct = t.percentage || 0;
                const highestPct = t.totalMarks > 0 ? (t.highestScore / t.totalMarks) * 100 : 0;
                studentPoints.push({ x: px, y: graphBottom - (studentPct / 100) * graphH });
                highestPoints.push({ x: px, y: graphBottom - (highestPct / 100) * graphH });
            });

            // Draw highest line (dashed purple)
            doc.setDrawColor(...COLORS.purple);
            doc.setLineWidth(0.5);
            doc.setLineDashPattern([1.5, 1.5], 0);
            for (let i = 1; i < highestPoints.length; i++) {
                doc.line(highestPoints[i - 1].x, highestPoints[i - 1].y, highestPoints[i].x, highestPoints[i].y);
            }
            highestPoints.forEach(p => {
                doc.setFillColor(...COLORS.purple);
                doc.circle(p.x, p.y, 0.8, 'F');
            });

            // Draw student line (solid blue)
            doc.setDrawColor(...COLORS.blue);
            doc.setLineWidth(0.7);
            doc.setLineDashPattern([], 0);
            for (let i = 1; i < studentPoints.length; i++) {
                doc.line(studentPoints[i - 1].x, studentPoints[i - 1].y, studentPoints[i].x, studentPoints[i].y);
            }
            studentPoints.forEach(p => {
                doc.setFillColor(...COLORS.blue);
                doc.circle(p.x, p.y, 1, 'F');
            });

            // Legend
            const legendY = graphBottom + 4;
            doc.setDrawColor(...COLORS.blue);
            doc.setLineWidth(0.7);
            doc.setLineDashPattern([], 0);
            doc.line(MARGIN + 20, legendY, MARGIN + 30, legendY);
            doc.setFillColor(...COLORS.blue);
            doc.circle(MARGIN + 25, legendY, 0.8, 'F');
            doc.setFontSize(6);
            doc.setTextColor(...COLORS.blue);
            doc.text('Your Score', MARGIN + 32, legendY + 1);

            doc.setDrawColor(...COLORS.purple);
            doc.setLineDashPattern([1.5, 1.5], 0);
            doc.line(MARGIN + 60, legendY, MARGIN + 70, legendY);
            doc.setFillColor(...COLORS.purple);
            doc.circle(MARGIN + 65, legendY, 0.8, 'F');
            doc.setLineDashPattern([], 0);
            doc.setFontSize(6);
            doc.setTextColor(...COLORS.purple);
            doc.text('Class Highest', MARGIN + 72, legendY + 1);

            y = legendY + 10;
        } else {
            y += 2;
        }

        // ── OFFLINE EXAMS BOX ──
        if (s.offlineExams && s.offlineExams.length > 0) {
            checkPageBreak(40);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.offlineBoxBorder);
            doc.text('OFFLINE EXAMS', MARGIN, y + 3);
            y += 5;

            const offRows = s.offlineExams.map(e => {
                const pct = typeof e.percentage === 'number' ? `${e.percentage}%` : `${e.percentage}`;
                const hPct = typeof e.highestPercentage === 'number' ? `${e.highestPercentage}%` : '-';
                return [e.chapterName, `${e.marksObtained}/${e.fullMarks}`, pct, hPct];
            });

            autoTable(doc, {
                startY: y,
                head: [['Exam', 'Marks', 'Score (%)', 'Highest (%)']],
                body: offRows,
                theme: 'grid',
                margin: { left: MARGIN, right: MARGIN, bottom: 20 },
                tableWidth: CONTENT_W,
                styles: { fontSize: 7, cellPadding: 1.8, textColor: COLORS.darkText, fillColor: COLORS.offlineBoxBg, lineColor: COLORS.offlineBoxBorder, lineWidth: 0.2 },
                headStyles: { fillColor: COLORS.offlineBoxBorder, textColor: COLORS.white, fontStyle: 'bold', fontSize: 7 },
                columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'center', cellWidth: 22 }, 2: { halign: 'center', cellWidth: 22 }, 3: { halign: 'center', cellWidth: 22 } },
            });
            y = (doc as any).lastAutoTable.finalY + 3;
        }
    }

    // Add footers to all pages at the very end
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        addFooter(doc, p);
    }

    // Save
    doc.save(`${data.batch}_Progress_Report.pdf`);
}
