import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Assignment from '@/models/Assignment';
import { getAdminPayload } from '@/lib/adminAuth';
import { stripCitations } from '@/lib/aiGrading';

/**
 * PUT /api/admin/assignments/[id]/paper-key
 * Body: { board: string ('' when not board-wise), questions?: [{ question, topic, subtopic, answer }], solutionsUrl?: string }
 * Saves (or replaces) the prepared question list / answer key of one paper. Fields not sent are kept.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await getAdminPayload(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        const body = await req.json();
        const board = String(body.board || '').trim();

        await dbConnect();
        const a = await Assignment.findById(id).select('paperKeys').lean() as any;
        if (!a) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        const keys: any[] = (a.paperKeys || []).filter((k: any) => (k.board || '') !== board);
        const prev = (a.paperKeys || []).find((k: any) => (k.board || '') === board) || {};

        const questions = Array.isArray(body.questions)
            ? body.questions.slice(0, 200).map((q: any) => ({
                question: String(q?.question || '').trim().slice(0, 40),
                topic: stripCitations(String(q?.topic || '')).slice(0, 120),
                subtopic: stripCitations(String(q?.subtopic || '')).slice(0, 160),
                answer: stripCitations(String(q?.answer || '')).slice(0, 1500),
            })).filter((q: any) => q.question)
            : (prev.questions || []);

        let solutionsUrl = prev.solutionsUrl || '';
        if (typeof body.solutionsUrl === 'string') {
            solutionsUrl = body.solutionsUrl.trim();
            if (solutionsUrl && !/^https:\/\/(drive|docs)\.google\.com\//.test(solutionsUrl)) {
                return NextResponse.json({ error: 'The solutions link must be a Google Drive link' }, { status: 400 });
            }
        }

        if (questions.length > 0 || solutionsUrl) keys.push({ board, questions, solutionsUrl, savedAt: new Date() });
        await Assignment.updateOne({ _id: id }, { $set: { paperKeys: keys } });
        return NextResponse.json({ success: true, paperKeys: keys });
    } catch (error: any) {
        console.error('[paper-key] save failed:', error);
        return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 500 });
    }
}
