import { NextRequest, NextResponse } from 'next/server';
import { getAdminPayload } from '@/lib/adminAuth';

export const maxDuration = 60;

/**
 * GET /api/admin/assignments/drive-file?url=<Google Drive file link>
 * Streams a Drive PDF (question paper or a student's submission) to the admin's browser, which
 * cannot fetch Drive directly because of CORS. Used to build the merged PDFs for AI checking.
 * Only Google Drive links are accepted.
 */
export async function GET(req: NextRequest) {
    if (!(await getAdminPayload(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url).searchParams.get('url') || '';
    let parsed: URL;
    try { parsed = new URL(url); } catch { return NextResponse.json({ error: 'Invalid url' }, { status: 400 }); }
    if (!/(^|\.)(drive|docs)\.google\.com$/.test(parsed.hostname)) {
        return NextResponse.json({ error: 'Only Google Drive links are allowed' }, { status: 400 });
    }

    const id = url.match(/\/d\/([^/?#]+)/)?.[1] || parsed.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Could not find the Drive file id' }, { status: 400 });

    const res = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`, { redirect: 'follow' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !res.body || type.includes('text/html')) {
        // An HTML page means Drive refused (file not shared publicly, or too big for direct download)
        return NextResponse.json({ error: `Drive did not return the file (${res.status})` }, { status: 502 });
    }
    return new Response(res.body, {
        headers: {
            'Content-Type': 'application/pdf',
            'Cache-Control': 'private, max-age=600',
        },
    });
}
