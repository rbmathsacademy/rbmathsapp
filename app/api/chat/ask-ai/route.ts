import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ChatMessage from '@/models/ChatMessage';
import mongoose from 'mongoose';
import * as jose from 'jose';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_INSTRUCTION = `You are RB Sir's Math-AI Assistant. Always begin your response EXACTLY with: 'Hi I am RB sir's Math-AI assistant, I will try to clear your doubt, if I fail to clear your doubt, RB sir will definitely answer your doubts'. Act as a strict tutor. Provide formulas and step-by-step guidance, but NEVER give away the final answer. Only answer Math-related questions; if asked about other topics, refuse politely. Be concise and not chatty.

IMPORTANT: If a student refers to an assignment problem without providing the question text or image, politely ask them to write the question down on a piece of paper and upload a photo of it here.

FORMATTING: Do NOT use ANY Markdown formatting like **bold** stars or ### headers. If you want to make text bold or create a heading, you MUST wrap it in inline LaTeX math mode using \textbf{}, for example: $\textbf{Step 1: Solve for x}$. Write all mathematical expressions in standard LaTeX format using $ for inline math and $$ for block math.`;

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod');
        const { payload } = await jose.jwtVerify(token, secret);
        const studentId = (payload.phoneNumber || payload.userId) as string;

        const { batchId, text, imageBase64, doubtSessionId, mimeType = 'image/jpeg' } = await req.json();

        if (!batchId || !text) {
            return NextResponse.json({ error: 'Missing batchId or text' }, { status: 400 });
        }

        // Initialize Gemini model
        const model = genAI.getGenerativeModel({
            model: 'gemini-3.5-flash',
            systemInstruction: SYSTEM_INSTRUCTION
        });

        const contents: any[] = [];
        const sessionToUse = doubtSessionId || new mongoose.Types.ObjectId().toString();

        // If there's an existing doubt session, fetch previous messages (both from student and AI)
        if (doubtSessionId) {
            const historyMessages = await ChatMessage.find({ 
                batchId, 
                'doubtMetadata.doubtSessionId': doubtSessionId 
            }).sort({ createdAt: 1 });

            for (const msg of historyMessages) {
                // Ignore empty text messages or pure image URLs that aren't base64 sent to Gemini
                if (msg.type === 'text' && msg.content) {
                    contents.push({
                        role: msg.senderId === studentId ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    });
                }
            }
        }

        // Current user message payload for Gemini
        const currentMessageParts: any[] = [{ text }];

        if (imageBase64) {
            currentMessageParts.push({
                inlineData: {
                    data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                    mimeType
                }
            });
        }

        contents.push({
            role: 'user',
            parts: currentMessageParts
        });

        // Call Gemini API
        const result = await model.generateContent({ contents });
        const aiResponseText = result.response.text();

        // Save AI response to DB
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

        // Link the student's triggering messages (sent in the last 15 seconds) to this session
        // so that they can be highlighted in red if marked unresolved.
        if (!doubtSessionId) {
            const fifteenSecondsAgo = new Date(Date.now() - 15000);
            await ChatMessage.updateMany(
                { 
                    batchId, 
                    senderId: studentId, 
                    createdAt: { $gte: fifteenSecondsAgo },
                    'doubtMetadata.doubtSessionId': { $exists: false }
                },
                { 
                    $set: { 
                        'doubtMetadata.targetStudentId': studentId,
                        'doubtMetadata.status': 'pending',
                        'doubtMetadata.doubtSessionId': sessionToUse
                    } 
                }
            );
        }

        return NextResponse.json({ success: true, message: aiMessage, doubtSessionId: sessionToUse });
    } catch (error: any) {
        console.error('Gemini Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
