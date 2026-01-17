
export interface SheetRow {
    batchName: string;
    studentName: string;
    phoneNumber: string;
}

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRldIr-uJmPh6_iZBGOp8T_6EJ6PzKLfE5J6JxVEazpGnlDAFwDj537X6We1EaZkqD8bpEyriLrqBdo/pub?gid=0&single=true&output=csv';

// Simple CSV parser
const parseCSV = (text: string): SheetRow[] => {
    const lines = text.split('\n');
    const rows: SheetRow[] = [];

    // Skip header assumed at row 0? The user said: "Column A contains batch name, Column B - student names and column C -phone number"
    // Usually published CSVs contain headers if the sheet has them.
    // Let's assume the first row might be header if it contains "Batch" or similar, otherwise data.
    // However, safest to check or just try parse.
    // Let's assume standard CSV with header or just standard columns.

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV quoting? For simplicity assume simple comma separation first, but ideally use a library or regex if fields contain commas.
        // Given description "Student list", likely names/numbers.
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());

        if (cols.length < 3) continue;

        // Naive header check
        if (i === 0 && (cols[2].toLowerCase().includes('phone') || cols[0].toLowerCase().includes('batch'))) {
            continue;
        }

        rows.push({
            batchName: cols[0],
            studentName: cols[1],
            phoneNumber: cols[2]
        });
    }
    return rows;
};

export async function fetchSheetData(): Promise<SheetRow[]> {
    try {
        const response = await fetch(SHEET_CSV_URL, { next: { revalidate: 60 } }); // Cache for 1 min
        if (!response.ok) throw new Error('Failed to fetch sheet');
        const text = await response.text();
        return parseCSV(text);
    } catch (error) {
        console.error("Sheet Fetch Error:", error);
        return [];
    }
}

export async function getStudentCourses(phoneNumber: string): Promise<{ batches: string[], studentName: string } | null> {
    const rows = await fetchSheetData();
    // Normalize phone number (remove spaces, dashes)
    const cleanPhone = (p: string) => p.replace(/\D/g, '');
    const target = cleanPhone(phoneNumber);

    const matches = rows.filter(r => cleanPhone(r.phoneNumber) === target);

    if (matches.length === 0) return null;

    // Student name from first match (assuming consistent)
    const studentName = matches[0].studentName;
    const batches = [...new Set(matches.map(r => r.batchName))];

    return { batches, studentName };
}

export async function getAllCourses(): Promise<string[]> {
    const rows = await fetchSheetData();
    const batches = [...new Set(rows.map(r => r.batchName))];
    return batches.sort();
}
