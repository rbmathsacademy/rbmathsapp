import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetData } from '@/lib/googleSheet';

// POST - Get students from Google Sheets based on selected batches
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { batches } = body;

        if (!batches || !Array.isArray(batches)) {
            console.error('❌ Invalid batches payload:', batches);
            return NextResponse.json({ error: 'Batches must be an array' }, { status: 400 });
        }

        console.log('🔍 Fetching students for batches:', batches.length, 'batches');

        // Fetch all data from Google Sheets
        const sheetData = await fetchSheetData();

        if (!Array.isArray(sheetData)) {
            console.error('❌ fetchSheetData returned non-array:', sheetData);
            return NextResponse.json({ error: 'Failed to load student data from source' }, { status: 500 });
        }

        console.log('📄 Sheet data rows:', sheetData.length);

        // Filter students by selected batches
        const students = sheetData
            .filter(row => row && row.batchName && batches.includes(row.batchName))
            .map(row => ({
                phoneNumber: row.phoneNumber,
                studentName: row.studentName,
                batchName: row.batchName
            }));

        console.log('✅ Found', students.length, 'matching students');

        // Remove duplicates based on phone number
        const uniqueStudents = students.filter((student, index, self) =>
            index === self.findIndex(s => s.phoneNumber === student.phoneNumber)
        );

        return NextResponse.json(uniqueStudents);
    } catch (error: any) {
        console.error('Error in students API:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch students' }, { status: 500 });
    }
}
