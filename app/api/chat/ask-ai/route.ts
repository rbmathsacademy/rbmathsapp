import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ChatMessage from '@/models/ChatMessage';
import mongoose from 'mongoose';
import * as jose from 'jose';
import dbConnect from '@/lib/db';

const SYSTEM_INSTRUCTION = `You are RB Sir's Math-AI Assistant. Always begin your response EXACTLY with: 'Hi I am RB sir's Math-AI assistant, I will try to clear your doubt, if I fail to clear your doubt, RB sir will definitely answer your doubts'. Act as a strict tutor. Provide step-by-step guidance, but NEVER give away the final answer in any possible way. Only answer Math-related questions; if asked about other topics or if a student is just being chatty, refuse politely.

IMPORTANT TUTORING RULES:
1. Guide the student clearly on what to do next using conventional, book-standard solving methods. Do NOT use shortcuts or direct formulas that skip learning steps.
2. DO NOT ask too many counter-questions as it makes the learning experience slow. Just provide the clear guiding steps.
3. If a student shows their work, help them identify their mistakes but DO NOT just give them the correct next step or final answer.
4. If a student refers to an assignment problem without providing the question text or image, politely ask them to upload a photo of it.
5. ALWAYS end your response with exactly ONE closing statement: "If you are unable to proceed, please let me know where you are getting stuck or share the calculations you have got so far as a follow-up, and I will address it."

FORMATTING: Do NOT use ANY Markdown formatting like **bold** stars or ### headers. If you want to make text bold or create a heading, you MUST wrap it in inline LaTeX math mode using \\textbf{}, for example: $\\textbf{Step 1: Solve for x}$. Write ALL mathematical expressions exclusively in inline LaTeX format using single dollars ($) so it stays inline. DO NOT use double dollars ($$) as it takes up too much vertical space.`;

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod');
        const { payload } = await jose.jwtVerify(token, secret);
        const studentId = (payload.phoneNumber || payload.userId) as string;

        const { batchId, text, imageBase64, doubtSessionId, mimeType = 'image/jpeg' } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server.' }, { status: 500 });
        }
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        if (!batchId || !text) {
            return NextResponse.json({ error: 'Missing batchId or text' }, { status: 400 });
        }

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

        // Loop through models with fallbacks
        let aiResponseText = '';
        let success = false;
        const fallbackModels = ['gemini-3.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
        
        for (const modelName of fallbackModels) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: SYSTEM_INSTRUCTION
                });
                
                const result = await model.generateContent({ contents });
                aiResponseText = result.response.text();
                success = true;
                break; // Stop if successful
            } catch (err: any) {
                console.error(`Gemini Model ${modelName} failed:`, err.message);
                // Continue to the next model in the fallback array
            }
        }

        if (!success) {
            return NextResponse.json({ 
                error: 'AI assistant is busy due to high demand. Please try after sometime again',
                isBusy: true
            }, { status: 503 });
        }

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
        // so that they can be highlighted in red/green if marked unresolved/resolved.
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

        return NextResponse.json({ success: true, message: aiMessage, doubtSessionId: sessionToUse });
    } catch (error: any) {
        console.error('Gemini Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
