import { NextResponse } from 'next/server';

const GAS_APP_URL = 'https://script.google.com/macros/s/AKfycbyBLvemIMxTVbASJhsRO4yu0syjGw1m4kQxJzU8Lp37HYuMAIMCk2eDOjcxZ-i4WBnRbw/exec';

export async function POST(req: Request) {
    try {
        const body = await req.json();

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
