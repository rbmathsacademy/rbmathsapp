import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Question from '@/models/Question';

// POST /api/admin/questions/rename
// Body: { ids: string[], field: 'topic' | 'subtopic' | 'examName', oldValue: string, newValue: string }
export async function POST(req: Request) {
    await dbConnect();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');
    if (!email && adminKey !== 'globaladmin_25') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { ids, field, oldValue, newValue } = await req.json();

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }
        if (!['topic', 'subtopic', 'examName', 'type'].includes(field)) {
            return NextResponse.json({ error: 'field must be topic, subtopic, examName, or type' }, { status: 400 });
        }
        if (!newValue || !newValue.trim()) {
            return NextResponse.json({ error: 'newValue is required' }, { status: 400 });
        }

        const trimmedNew = newValue.trim();
        let result;

        if (field === 'topic') {
            result = await Question.updateMany(
                { id: { $in: ids } },
                { $set: { topic: trimmedNew } }
            );
        } else if (field === 'subtopic') {
            result = await Question.updateMany(
                { id: { $in: ids } },
                { $set: { subtopic: trimmedNew } }
            );
        } else if (field === 'type') {
            result = await Question.updateMany(
                { id: { $in: ids } },
                { $set: { type: trimmedNew } }
            );
        } else if (field === 'examName') {
            // Replace oldValue with newValue inside the examNames array
            // Also handle legacy examName (single string) field
            if (!oldValue) {
                return NextResponse.json({ error: 'oldValue required for examName rename' }, { status: 400 });
            }

            // Update questions that have oldValue in examNames array
            const arrResult = await Question.updateMany(
                { id: { $in: ids }, examNames: oldValue },
                { $set: { "examNames.$[elem]": trimmedNew } },
                { arrayFilters: [{ elem: oldValue }] }
            );
            // Also handle legacy examName field
            const legacyResult = await Question.updateMany(
                { id: { $in: ids }, examName: oldValue },
                { $set: { examName: trimmedNew } }
            );
            return NextResponse.json({
                message: `Renamed "${oldValue}" → "${trimmedNew}"`,
                modifiedCount: (arrResult.modifiedCount || 0) + (legacyResult.modifiedCount || 0)
            });
        }

        return NextResponse.json({
            message: `Renamed ${field} to "${trimmedNew}"`,
            modifiedCount: result?.modifiedCount || 0
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}



