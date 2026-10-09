import { NextRequest, NextResponse } from 'next/server';
import ChatMessage from '@/models/ChatMessage';
import dbConnect from '@/lib/db';
import * as jose from 'jose';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod');
        const { payload } = await jose.jwtVerify(token, secret);
        const studentId = (payload.phoneNumber || payload.userId) as string;

        const { messageId, status, batchId } = await req.json();

        if (!messageId || !status || !['resolved', 'unresolved'].includes(status)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const aiMessage = await ChatMessage.findById(messageId);
        
        if (!aiMessage || !aiMessage.isAiResponse || aiMessage.doubtMetadata?.targetStudentId !== studentId) {
            return NextResponse.json({ error: 'Invalid operation' }, { status: 403 });
        }

        const sessionId = aiMessage.doubtMetadata.doubtSessionId;

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
        }

        // Update status for all AI messages in this session so buttons disappear
        await ChatMessage.updateMany(
            { 'doubtMetadata.doubtSessionId': sessionId },
            { $set: { 'doubtMetadata.status': status } }
        );

        // Send follow-up system message
        const responseText = status === 'resolved' 
            ? "Great work!" 
            : "As you marked that you didn't understand pls wait a few hours for RB sir to come online & answer your doubt in more details";

        const followUpMessage = await ChatMessage.create({
            batchId,
            senderId: 'ai_assistant',
            senderName: "RB Sir's Math-AI Assistant",
            senderRole: 'admin',
            content: responseText,
            type: 'text',
            isAiResponse: true,
            doubtMetadata: {
                targetStudentId: studentId,
                status,
                doubtSessionId: aiMessage.doubtMetadata.doubtSessionId
            }
        });

        return NextResponse.json({ success: true, followUpMessage });
    } catch (error: any) {
        console.error('Resolve Doubt Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
