import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import { UploadCache } from '../../../../../models/UploadCache';

const GAS_APP_URL = 'https://script.google.com/macros/s/AKfycbyBLvemIMxTVbASJhsRO4yu0syjGw1m4kQxJzU8Lp37HYuMAIMCk2eDOjcxZ-i4WBnRbw/exec';

export async function POST(req: Request) {
    try {
        let body = await req.json();

        // Check if this is a chunked upload
        const { uploadId, chunkIndex, totalChunks, fileData, ...metadata } = body;
        
        if (typeof chunkIndex === 'number' && typeof totalChunks === 'number' && uploadId) {
            await dbConnect();
            
            // Upsert chunk cache
            let cache = await UploadCache.findOne({ uploadId });
            if (!cache) {
                cache = new UploadCache({
                    uploadId,
                    chunks: [],
                    totalChunks,
                    batchName: metadata.batchName || '',
                    assignmentTitle: metadata.assignmentTitle || '',
                    studentName: metadata.studentName || '',
                    phoneNumber: metadata.phoneNumber || '',
                    mimeType: metadata.mimeType || '',
                    fileName: metadata.fileName || ''
                });
            }

            // Only add if not already there
            if (!cache.chunks.some((c: any) => c.index === chunkIndex)) {
                cache.chunks.push({ index: chunkIndex, data: fileData });
                await cache.save();
            }

            if (cache.chunks.length < totalChunks) {
                return NextResponse.json({ status: 'chunk_success', received: chunkIndex });
            }

            // All chunks received. Reassemble.
            cache.chunks.sort((a: any, b: any) => a.index - b.index);
            const fullBase64 = cache.chunks.map((c: any) => c.data).join('');
            
            // Clean up cache as we are done
            await UploadCache.deleteOne({ uploadId });

            // Prepare the full body for GAS
            body = {
                batchName: cache.batchName,
                assignmentTitle: cache.assignmentTitle,
                studentName: cache.studentName,
                phoneNumber: cache.phoneNumber,
                mimeType: cache.mimeType,
                fileName: cache.fileName,
                fileData: fullBase64
            };
        }

        // Server-side fetch bypasses CORS
        const response = await fetch(GAS_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const text = await response.text();

        // Check if we got HTML instead of JSON (error page)
        if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
            console.error('Received HTML response instead of JSON from Google Script');

            // Try to extract the error message from the HTML
            // Google Script error pages usually have a div with class "errorMessage" or styled div
            const errorMatch = text.match(/<div[^>]*style="[^"]*font-family:monospace[^"]*"[^>]*>([\s\S]*?)<\/div>/) || text.match(/class="errorMessage"[^>]*>([\s\S]*?)<\/div>/);
            const specificError = errorMatch ? errorMatch[1].trim() : 'Unknown Google Script Error';

            console.error('GAS Error:', specificError);

            return NextResponse.json({
                status: 'error',
                error: 'Google Apps Script Error',
                message: `Google Script Error: ${specificError}`,
                details: 'Please check your Google Apps Script code logs.'
            }, { status: 500 });
        }

        let result;
        try {
            result = JSON.parse(text);
        } catch {
            console.error('Invalid JSON response:', text.substring(0, 200));
            return NextResponse.json({
                status: 'error',
                error: 'Invalid response from Google Script',
                message: 'The upload script returned an invalid response.',
            }, { status: 500 });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Upload proxy error:', error);
        return NextResponse.json({
            status: 'error',
            error: 'Server error',
            message: error.message
        }, { status: 500 });
    }
}
