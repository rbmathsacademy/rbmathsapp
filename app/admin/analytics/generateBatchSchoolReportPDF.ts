import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = {
    navy: [30, 58, 95] as [number, number, number],
    gray: [107, 114, 128] as [number, number, number],
    green: [16, 185, 129] as [number, number, number],
    red: [239, 68, 68] as [number, number, number],
    blue: [59, 130, 246] as [number, number, number],
};

export const generateBatchSchoolReportPDF = (
    batchName: string,
    students: any[],
    getCorrelationData: (s: any, e: any) => any,
    examNameFilter?: string
) => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFontSize(22);
    doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.text(`School Performance Summary${examNameFilter ? ` — ${examNameFilter}` : ''}`, 14, 20);
    
    doc.setFontSize(14);
    doc.text(`Batch: ${batchName}`, 14, 28);
    
    doc.setFontSize(10);
    doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 34);
    doc.text(`This report compares students' regular practice (prediction) against their actual school results.`, 14, 40);

    const tableData: any[] = [];

    const pushExamRow = (student: any, exam: any) => {
        const correlation = getCorrelationData(student, exam);
        let prediction = 'N/A';
        let status = 'N/A';
        let insight = 'Insufficient Data';

        if (correlation) {
            prediction = `${correlation.priorSystemAvg}%`;
            if (correlation.syncStatus === 'IMPROVED') {
                status = 'Exceeded';
                insight = 'Scored higher than practice predicted';
            } else if (correlation.syncStatus === 'DETERIORATED') {
                status = 'Underperformed';
                insight = 'Scored lower than practice predicted';
            } else {
                status = 'In Sync';
                insight = 'Performance matches regular practice';
            }
        }

        tableData.push([
            student.name,
            exam.schoolName || student.schoolName || '-',
            exam.examName,
            prediction,
            `${exam.percentage.toFixed(1)}%`,
            status,
            insight
        ]);
    };

    students.forEach(student => {
        if (examNameFilter) {
            // Scoped to one exam — call out students with no recorded score for it
            // instead of silently skipping them, so "missing" selections show up.
            const examRecord = (student.exams || []).find((e: any) => e.examName === examNameFilter);
            if (examRecord) {
                pushExamRow(student, examRecord);
            } else {
                tableData.push([
                    student.name,
                    student.schoolName || '-',
                    examNameFilter,
                    'N/A',
                    'Missing',
                    'Missing',
                    'No score recorded for this exam'
                ]);
            }
            return;
        }

        if (student.exams && student.exams.length > 0) {
            student.exams.forEach((exam: any) => pushExamRow(student, exam));
        }
    });

    if (tableData.length === 0) {
        doc.setFontSize(12);
        doc.text("No school exam records found for the current filters.", 14, 55);
        doc.save(`School_Performance_${batchName}.pdf`);
        return;
    }

    autoTable(doc, {
        startY: 48,
        head: [['Student Name', 'School', 'Exam', 'System Marks Prediction', 'School Exam Marks', 'Status', 'Insight']],
        body: tableData,
        headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 10, cellPadding: 4 },
        didParseCell: function(data: any) {
            if (data.section === 'body' && data.column.index === 5) {
                const status = data.cell.raw;
                if (status === 'Exceeded') data.cell.styles.textColor = COLORS.green;
                else if (status === 'Underperformed') data.cell.styles.textColor = COLORS.red;
                else if (status === 'In Sync') data.cell.styles.textColor = COLORS.blue;
                else if (status === 'Missing') data.cell.styles.textColor = COLORS.gray;
            }
        }
    });

    const safeBatchName = batchName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeExamSuffix = examNameFilter ? `_${examNameFilter.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    doc.save(`School_Performance_Batch_${safeBatchName}${safeExamSuffix}.pdf`);
};