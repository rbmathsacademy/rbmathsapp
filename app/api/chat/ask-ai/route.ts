export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import ChatMessage from '@/models/ChatMessage';
import AiRetryJob from '@/models/AiRetryJob';
import mongoose from 'mongoose';
import * as jose from 'jose';
import dbConnect from '@/lib/db';
import { callGeminiWithFallback, driveUrlToBase64 } from '@/lib/geminiChat';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod');
        const { payload } = await jose.jwtVerify(token, secret);
        let studentId = (payload.phoneNumber || payload.userId) as string;

        const { batchId, text, imageBase64, imageUrl, doubtSessionId, mimeType = 'image/jpeg', targetStudentId } = await req.json();

        // Allow admin to act on behalf of a student
        const adminRoles = ['admin', 'superadmin', 'manager', 'copy_checker'];
        if (adminRoles.includes(payload.role as string) && targetStudentId) {
            studentId = targetStudentId;
        }

        if (!batchId || !text) {
            return NextResponse.json({ error: 'Missing batchId or text' }, { status: 400 });
        }

        const sessionToUse = doubtSessionId || new mongoose.Types.ObjectId().toString();

        // Build conversation history for this doubt session
        const history: any[] = [];
        if (doubtSessionId) {
            const historyMessages = await ChatMessage.find({
                batchId,
                'doubtMetadata.doubtSessionId': doubtSessionId
            }).sort({ createdAt: 1 });

            for (const msg of historyMessages) {
                if (msg.type === 'text' && msg.content) {
                    history.push({
                        role: msg.senderId === studentId ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    });
                }
            }
        }

        // Resolve image to base64 (from inline data or Google Drive URL)
        let finalBase64 = imageBase64;
        if (!finalBase64 && imageUrl) {
            finalBase64 = await driveUrlToBase64(imageUrl) ?? undefined;
        }

        // Queue the retry job and link the student's message BEFORE calling Gemini. If this function
        // is cut off by the platform time limit mid-call, the doubt is still queued and will be
        // answered by the retry worker (previously a timeout left nothing behind: no reply, no retry).
        // nextRetryAt is past this request's own time limit, so the worker can't pick it up while
        // this request is still trying.
        const job = await AiRetryJob.create({
            batchId,
            studentId,
            text,
            imageUrl: imageUrl || null,
            mimeType,
            doubtSessionId: sessionToUse,
            attemptNumber: 1,
            maxAttempts: 3,
            nextRetryAt: new Date(Date.now() + 90 * 1000),
            status: 'pending',
        });
        await linkUnlinkedMessages(batchId, studentId, sessionToUse);

        // --- Try Gemini now ---
        let aiResponseText = '';
        let success = false;
        try {
            aiResponseText = await callGeminiWithFallback({
                text,
                imageBase64: finalBase64,
                mimeType,
                history,
                budgetMs: 40_000, // leaves room inside maxDuration (60s) for the DB work around it
            });
            success = true;
        } catch (err: any) {
            console.error('[ask-ai] All Gemini models failed, retry queued:', err.message);
        }

        if (!success) {
            // Retry schedule: 1 min → 2 min → 3 min
            await AiRetryJob.updateOne({ _id: job._id, status: 'pending' }, { $set: { nextRetryAt: new Date(Date.now() + 60 * 1000) } });

            return NextResponse.json({
                error: 'AI assistant is busy. Your question has been queued and will be answered automatically within a few minutes.',
                isBusy: true,
                queued: true,
            }, { status: 503 });
        }

        // Save AI response
        const aiMessage = await ChatMessage.create({
            batchId,
            senderId: 'ai_assistant',
            senderName: "RB Sir's Math-AI Assistant",
            senderRole: 'admin',
            content: aiResponseText,
            type: 'text',
            isAiResponse: true,
            doubtMetadata: {
                targetStudentId: studentId,
                status: 'pending',
                doubtSessionId: sessionToUse
            }
        });

        // Answered now (reply saved first), so the queued retry is no longer needed
        await AiRetryJob.updateOne({ _id: job._id }, { $set: { status: 'success' } });

        return NextResponse.json({ success: true, message: aiMessage, doubtSessionId: sessionToUse });
    } catch (error: any) {
        console.error('ask-ai error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/** Link the 2 most recent unlinked student messages to the doubt session */
async function linkUnlinkedMessages(batchId: string, studentId: string, sessionToUse: string) {
    const recentUnlinked = await ChatMessage.find({
        batchId,
        senderId: studentId,
        'doubtMetadata.doubtSessionId': { $exists: false }
    }).sort({ createdAt: -1 }).limit(2);

    if (recentUnlinked.length > 0) {
        await ChatMessage.updateMany(
            { _id: { $in: recentUnlinked.map(m => m._id) } },
            {
                $set: {
                    'doubtMetadata.targetStudentId': studentId,
                    'doubtMetadata.status': 'pending',
                    'doubtMetadata.doubtSessionId': sessionToUse
                }
            }
        );
    }
}
