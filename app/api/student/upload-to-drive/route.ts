import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { scriptUrl, fileData, fileName, folderPath } = await req.json();

        if (!scriptUrl || !fileData || !fileName || !folderPath) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Server-side fetch bypasses CORS
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileData, fileName, folderPath }),
        });

        const text = await response.text();

        // Check if we got HTML instead of JSON (permission error)
        if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
            console.error('Received HTML response instead of JSON from Google Script');
            console.error('Script URL:', scriptUrl);
            console.error('This usually means the Google Script is not deployed as "Anyone can execute"');
            return NextResponse.json({
                error: 'Google Script Permission Error',
                message: 'The faculty\'s Google Drive upload script is not properly configured. Please contact the faculty to redeploy their Google Apps Script with "Execute as: Me" and "Who has access: Anyone" settings.',
                details: 'Received HTML page instead of JSON response'
            }, { status: 500 });
        }

        let result;
        try {
            result = JSON.parse(text);
        } catch {
            console.error('Invalid JSON response:', text.substring(0, 200));
            return NextResponse.json({
                error: 'Invalid response from Google Script',
                message: 'The upload script returned an invalid response. Please contact the faculty.',
                details: text.substring(0, 200)
            }, { status: 500 });
        }

        if (result.status !== 'success') {
            return NextResponse.json({
                error: result.message || 'Upload failed',
                details: result
            }, { status: 500 });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Upload proxy error:', error);
        return NextResponse.json({
            error: 'Server error',
            message: error.message
        }, { status: 500 });
    }
}
