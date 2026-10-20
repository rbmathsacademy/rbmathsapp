import AiRetryJob from '@/models/AiRetryJob';
import ChatMessage from '@/models/ChatMessage';
import { callGeminiWithFallback, driveUrlToBase64 } from '@/lib/geminiChat';

const RETRY_DELAYS_MINUTES = [0, 1, 2, 3]; // attempt 1 -> 1min, attempt 2 -> 2min, attempt 3 -> 3min

// A job left in "processing" for this long was being worked on by a request that got cut off
// (serverless time limit); it is handed out again instead of staying stuck forever.
const STALE_PROCESSING_MS = 2 * 60 * 1000;

/**
 * Checks and processes due AI retry jobs. Call it via Next's after() so the platform keeps the
 * function alive until the work finishes (a plain fire-and-forget promise is frozen on Vercel as soon
 * as the response is sent). Handles at most `maxJobs` jobs within `budgetMs`.
 * Uses atomic findOneAndUpdate so concurrent polls never take the same job.
 */
export async function processDueAiRetries(batchId?: string, { maxJobs = 1, budgetMs = 45_000 } = {}) {
    const startedAt = Date.now();
    try {
        for (let n = 0; n < maxJobs; n++) {
            const remaining = budgetMs - (Date.now() - startedAt);
            if (remaining < 10_000) return;

            const now = new Date();
            const query: any = {
                $or: [
                    { status: 'pending', nextRetryAt: { $lte: now } },
                    { status: 'processing', updatedAt: { $lte: new Date(now.getTime() - STALE_PROCESSING_MS) } },
                ],
            };
            if (batchId) query.batchId = batchId;

            // Atomic lock: mark as processing so no other poll takes it
            const job = await AiRetryJob.findOneAndUpdate(
                query,
                { $set: { status: 'processing' } },
                { new: true, sort: { nextRetryAt: 1 } }
            );
            if (!job) return;

            try {
                // Reconstruct conversation history for this doubt session
                const history: any[] = [];
                if (job.doubtSessionId) {
                    const historyMessages = await ChatMessage.find({
                        batchId: job.batchId,
                        'doubtMetadata.doubtSessionId': job.doubtSessionId,
                    }).sort({ createdAt: 1 });

                    for (const msg of historyMessages) {
                        if (msg.type === 'text' && msg.content) {
                            history.push({
                                role: msg.senderId === job.studentId ? 'user' : 'model',
                                parts: [{ text: msg.content }],
                            });
                        }
                    }
                }

                let imageBase64: string | undefined;
                if (job.imageUrl) {
                    imageBase64 = (await driveUrlToBase64(job.imageUrl)) ?? undefined;
                }

                const aiResponseText = await callGeminiWithFallback({
                    text: job.text,
                    imageBase64,
                    mimeType: job.mimeType || 'image/jpeg',
                    history,
                    budgetMs: Math.max(5_000, budgetMs - (Date.now() - startedAt) - 3_000),
                });

                // Post AI response into chat
                await ChatMessage.create({
                    batchId: job.batchId,
                    senderId: 'ai_assistant',
                    senderName: "RB Sir's Math-AI Assistant",
                    senderRole: 'admin',
                    content: aiResponseText,
                    type: 'text',
                    isAiResponse: true,
                    doubtMetadata: {
                        targetStudentId: job.studentId,
                        status: 'pending',
                        doubtSessionId: job.doubtSessionId,
                    },
                });

                await job.updateOne({ status: 'success' });
            } catch (err: any) {
                console.error(`[retry-ai] Job ${job._id} attempt ${job.attemptNumber} failed:`, err.message);
                const nextAttempt = job.attemptNumber + 1;
                if (nextAttempt > job.maxAttempts) {
                    await job.updateOne({ status: 'failed', lastError: err.message });
                } else {
                    const delayMinutes = RETRY_DELAYS_MINUTES[nextAttempt] ?? 3;
                    await job.updateOne({
                        status: 'pending',
                        attemptNumber: nextAttempt,
                        nextRetryAt: new Date(Date.now() + delayMinutes * 60 * 1000),
                        lastError: err.message,
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error in processDueAiRetries:', err);
    }
}
