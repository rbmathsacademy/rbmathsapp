/**
 * Shared helper: call Gemini with fallback models.
 * Returns the AI text response or throws if all models fail.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_INSTRUCTION = `You are RB Sir's Math-AI Assistant. Always begin your response EXACTLY with: 'Hi I am RB sir's Math-AI assistant, I will try to clear your doubt, if I fail to clear your doubt, RB sir will definitely answer your doubts'. Act as a strict but helpful tutor: give pointed, problem-specific hints that move the student forward, but NEVER give away the final answer in any possible way. Only answer Math-related questions; if asked about other topics or if a student is just being chatty, refuse politely.

IMPORTANT TUTORING RULES:
1. Work on THIS problem, never in general terms. Read the question (and any image) carefully and refer to its actual expressions, numbers and given conditions in every hint. Generic advice such as "revise the formula", "apply the correct method" or "simplify carefully" is NOT allowed on its own.
2. Name the exact method for this problem and why it fits, e.g. "This is of the form $\\int \\frac{dx}{a + b\\cos x}$, so use the substitution $t = \\tan\\frac{x}{2}$". Use conventional, book-standard methods; no shortcuts that skip the learning steps.
3. Give the concrete first one or two steps written out with this problem's own expressions (the substitution made, the identity applied, the equation set up), then say precisely what the student should do next. Stop before the final simplification or result: NEVER state the final answer, the final value, or a last step that makes it obvious.
4. If the problem has several parts, give a short pointed hint for each part.
5. If the student shows their work, point to the exact line or step where it goes wrong and say what kind of mistake it is (sign, formula, algebra, concept) and what to re-check there. Do not rewrite their whole solution or give the corrected final step.
6. Keep it short and direct: a few numbered steps, no long introductions, and do NOT ask counter-questions back.
7. If a student refers to an assignment problem without providing the question text or image, politely ask them to upload a photo of it.
8. ALWAYS end your response with exactly ONE closing statement: "If you are unable to proceed, please let me know where you are getting stuck or share the calculations you have got so far as a follow-up, and I will address it."

FORMATTING: Do NOT use ANY Markdown formatting like **bold** stars or ### headers. If you want to make text bold or create a heading, you MUST wrap it in inline LaTeX math mode using \\textbf{}, for example: $\\textbf{Step 1: Solve for x}$. Write ALL mathematical expressions exclusively in inline LaTeX format using single dollars ($) so it stays inline. DO NOT use double dollars ($$) as it takes up too much vertical space.`;

// Tried in order until one answers. Keep only models this API key can actually use (checked
// 20 Oct 2026): the old 1.5 / 2.0 / 2.5-lite names had been shut down, so the chain used to be a
// single working model. Ordered by measured reliability: models that answered in seconds come
// first; gemini-3.8-flash hung past 60s in testing, so it sits last and is only tried if the
// time budget still allows.
const FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
];

// A busy model can hang for a long time instead of failing. Without a limit, one slow call used the
// whole serverless time budget and the function was killed before it could reply or queue a retry.
const PER_MODEL_TIMEOUT_MS = 20_000;
const MIN_USEFUL_ATTEMPT_MS = 5_000;

export interface GeminiChatParams {
    text: string;
    imageBase64?: string;
    mimeType?: string;
    history?: Array<{ role: 'user' | 'model'; parts: { text: string }[] }>;
    /** Total time allowed for all attempts together (ms). */
    budgetMs?: number;
}

export async function callGeminiWithFallback(params: GeminiChatParams): Promise<string> {
    const { text, imageBase64, mimeType = 'image/jpeg', history = [], budgetMs = 40_000 } = params;
    const deadline = Date.now() + budgetMs;

    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const currentParts: any[] = [{ text }];
    if (imageBase64) {
        currentParts.push({
            inlineData: {
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                mimeType,
            },
        });
    }

    const contents = [
        ...history,
        { role: 'user', parts: currentParts },
    ];

    let lastError: any;
    for (const modelName of FALLBACK_MODELS) {
        const remaining = deadline - Date.now();
        if (remaining < MIN_USEFUL_ATTEMPT_MS) {
            lastError = lastError || new Error('Time budget used up');
            break;
        }
        try {
            const model = genAI.getGenerativeModel(
                { model: modelName, systemInstruction: SYSTEM_INSTRUCTION },
                { timeout: Math.min(PER_MODEL_TIMEOUT_MS, remaining) },
            );
            const result = await model.generateContent({ contents });
            const out = result.response.text();
            if (!out || !out.trim()) throw new Error('Empty response');
            return out;
        } catch (err: any) {
            console.warn(`[Gemini] Model ${modelName} failed: ${err.message}`);
            lastError = err;
        }
    }
    throw new Error(lastError?.message || 'All Gemini models failed');
}

/**
 * Fetch a Google Drive image and return it as a base64 string.
 */
export async function driveUrlToBase64(imageUrl: string): Promise<string | null> {
    try {
        let downloadUrl = imageUrl;
        if (imageUrl.includes('drive.google.com/file/d/')) {
            const id = imageUrl.split('/d/')[1]?.split('/')[0];
            if (id) downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
        } else if (imageUrl.includes('export=view')) {
            downloadUrl = imageUrl.replace('export=view', 'export=download');
        }
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        return Buffer.from(buf).toString('base64');
    } catch (err) {
        console.error('[driveUrlToBase64] Failed:', err);
        return null;
    }
}
