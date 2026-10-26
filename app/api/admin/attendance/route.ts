import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';
import Attendance from '@/models/Attendance';
import { getAdminPayload } from '@/lib/adminAuth';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

async function guard(req: NextRequest) {
    const admin = await getAdminPayload(req);
    return admin && ['admin', 'superadmin'].includes(String(admin.role)) ? admin : null;
}

/**
 * GET /api/admin/attendance?batch=...&date=YYYY-MM-DD
 * The batch's students with their attendance for that date (present by default when nothing is saved
 * yet, or for students who joined after it was saved), plus the dates already saved for the batch.
 */
export async function GET(req: NextRequest) {
    if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const sp = new URL(req.url).searchParams;
        const batch = (sp.get('batch') || '').trim();
        const date = (sp.get('date') || '').trim();
        if (!batch || !validDate(date)) return NextResponse.json({ error: 'Batch and date are required' }, { status: 400 });
        await dbConnect();

        const [students, saved, dates] = await Promise.all([
            BatchStudent.find({ courses: { $regex: new RegExp(`^${esc(batch)}$`, 'i') } })
                .select('name phoneNumber alternativePhone guardianPhone board').sort({ name: 1 }).lean() as Promise<any[]>,
            Attendance.findOne({ batch, date }).lean() as Promise<any>,
            Attendance.find({ batch }).select('date').sort({ date: -1 }).limit(60).lean() as Promise<any[]>,
        ]);
        const state = new Map<string, boolean>((saved?.records || []).map((r: any) => [String(r.student), r.present !== false]));
        return NextResponse.json({
            students: students.map(s => ({
                _id: String(s._id), name: s.name, phoneNumber: s.phoneNumber,
                alternativePhone: s.alternativePhone || '', guardianPhone: s.guardianPhone || '', board: s.board || null,
                present: state.has(String(s._id)) ? state.get(String(s._id)) : true,
            })),
            saved: !!saved,
            savedAt: saved?.updatedAt || null,
            dates: dates.map(d => d.date),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to load attendance' }, { status: 500 });
    }
}

/** PUT { batch, date, absentIds: string[] } - saves (or replaces) that day's attendance; everyone not listed is present. */
export async function PUT(req: NextRequest) {
    const admin = await guard(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { batch, date, absentIds } = await req.json();
        if (!batch || !validDate(String(date))) return NextResponse.json({ error: 'Batch and date are required' }, { status: 400 });
        await dbConnect();
        const students = await BatchStudent.find({ courses: { $regex: new RegExp(`^${esc(String(batch))}$`, 'i') } }).select('name').lean() as any[];
        const absent = new Set((Array.isArray(absentIds) ? absentIds : []).map(String));
        const records = students.map(s => ({ student: s._id, name: s.name || '', present: !absent.has(String(s._id)) }));
        await Attendance.updateOne({ batch, date }, { $set: { records, savedBy: String(admin.email || '') } }, { upsert: true });
        return NextResponse.json({ success: true, present: records.filter(r => r.present).length, absent: records.filter(r => !r.present).length });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to save attendance' }, { status: 500 });
    }
}
