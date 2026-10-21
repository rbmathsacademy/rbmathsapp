// In-browser PDF compressor for student submissions (photos of handwritten pages).
//
// Runs entirely on the student's device: pdf.js draws each page onto a canvas at a lower
// resolution, the canvas is re-encoded as JPEG, and pdf-lib rebuilds a PDF with the original page
// sizes. Nothing is sent anywhere; the server is never involved. pdf.js is loaded on demand from
// cdnjs (only when a student actually needs to compress), so it costs no Vercel bandwidth.
//
// Goal: the smallest change that brings the file under the limit - the best quality that fits,
// never below a legibility floor (handwriting must stay readable for the teacher / AI checking).

import { PDFDocument } from 'pdf-lib';

const PDFJS_VERSION = '3.11.174'; // classic (non-module) build: works in older Android WebViews too
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

/** Upload limit, and the size we aim for (a little headroom below it). */
export const UPLOAD_LIMIT_BYTES = 3 * 1024 * 1024;
const TARGET_BYTES = Math.floor(2.85 * 1024 * 1024);

// Legibility floor: never draw pages narrower than this or with lower JPEG quality.
const MIN_WIDTH_PX = 1000;
const MIN_QUALITY = 0.42;
// Never draw wider than this (more pixels than a phone photo of a page needs).
const MAX_WIDTH_PX = 1800;
const MAX_PASSES = 4;

let pdfjsPromise: Promise<any> | null = null;

/** Load pdf.js (once) from the CDN. */
function loadPdfJs(): Promise<any> {
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = new Promise((resolve, reject) => {
        const w = window as any;
        if (w.pdfjsLib) { resolve(w.pdfjsLib); return; }
        const s = document.createElement('script');
        s.src = `${PDFJS_BASE}/pdf.min.js`;
        s.async = true;
        s.onload = () => {
            const lib = (window as any).pdfjsLib;
            if (!lib) { reject(new Error('PDF reader did not load')); return; }
            lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
            resolve(lib);
        };
        s.onerror = () => reject(new Error('Could not load the PDF reader (check your internet connection)'));
        document.head.appendChild(s);
    }).catch(e => { pdfjsPromise = null; throw e; });
    return pdfjsPromise;
}

export interface CompressProgress { pass: number; page: number; pages: number }
export interface CompressResult {
    file: File;            // the compressed PDF, same file name
    bytes: number;
    originalBytes: number;
    pages: number;
    previewUrl: string;    // JPEG of page 1, so the student can check it is readable (revoke when done)
}

interface Settings { width: number; quality: number }

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) =>
    new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image encoding failed'))), 'image/jpeg', quality));

/** One pass: redraw every page at the given settings and rebuild the PDF. */
async function renderPass(pdf: any, s: Settings, pass: number, onProgress?: (p: CompressProgress) => void) {
    const out = await PDFDocument.create();
    let preview: Blob | null = null;
    for (let i = 1; i <= pdf.numPages; i++) {
        onProgress?.({ pass, page: i, pages: pdf.numPages });
        const page = await pdf.getPage(i);
        const base = page.getViewport({ scale: 1 }); // size in PDF points
        const scale = Math.min(s.width / base.width, 3);
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(vp.width));
        canvas.height = Math.max(1, Math.round(vp.height));
        const ctx = canvas.getContext('2d', { alpha: false })!;
        ctx.fillStyle = '#ffffff'; // transparent areas would turn black in JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const jpg = await canvasToJpeg(canvas, s.quality);
        if (i === 1) preview = jpg;
        const img = await out.embedJpg(await jpg.arrayBuffer());
        const p = out.addPage([base.width, base.height]); // same printed page size as the original
        p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
        // free memory before the next page (important on phones)
        canvas.width = 0; canvas.height = 0;
        page.cleanup();
    }
    const bytes = await out.save({ useObjectStreams: true });
    return { bytes, preview };
}

/**
 * Compress a PDF until it is under the upload limit, changing it as little as possible.
 * Throws a friendly Error when it cannot get under the limit without making pages unreadable.
 */
export async function compressPdfForUpload(file: File, onProgress?: (p: CompressProgress) => void): Promise<CompressResult> {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    try {
        // First guess from how much smaller the file has to get: gentle when it is only a bit too big.
        const ratio = TARGET_BYTES / file.size;
        let s: Settings = ratio >= 0.7 ? { width: MAX_WIDTH_PX, quality: 0.8 }
            : ratio >= 0.45 ? { width: 1600, quality: 0.7 }
            : ratio >= 0.25 ? { width: 1400, quality: 0.62 }
            : { width: 1250, quality: 0.55 };

        let best: { bytes: Uint8Array; preview: Blob | null } | null = null;
        for (let pass = 1; pass <= MAX_PASSES; pass++) {
            const r = await renderPass(pdf, s, pass, onProgress);
            if (r.bytes.length <= TARGET_BYTES) { best = r; break; }

            if (s.width <= MIN_WIDTH_PX && s.quality <= MIN_QUALITY) break; // at the floor already

            // Too big: scale down. File size grows roughly with the number of pixels, so the width
            // shrinks with the square root of the needed reduction (with 8% margin), and the
            // quality steps down a little too.
            const shrink = Math.sqrt((TARGET_BYTES / r.bytes.length) * 0.92);
            s = {
                width: Math.max(MIN_WIDTH_PX, Math.floor(s.width * Math.min(0.95, shrink))),
                quality: Math.max(MIN_QUALITY, +(s.quality - (shrink < 0.8 ? 0.1 : 0.05)).toFixed(2)),
            };
        }
        if (!best) {
            throw new Error(`This PDF has ${pdf.numPages} pages - too many to fit under 3 MB while keeping the handwriting readable. Please split it into two parts, or take the photos at a lower resolution and make the PDF again.`);
        }

        const name = /\.pdf$/i.test(file.name) ? file.name : `${file.name}.pdf`;
        const blob = new Blob([best.bytes as BlobPart], { type: 'application/pdf' });
        return {
            file: new File([blob], name, { type: 'application/pdf', lastModified: Date.now() }),
            bytes: best.bytes.length,
            originalBytes: file.size,
            pages: pdf.numPages,
            previewUrl: best.preview ? URL.createObjectURL(best.preview) : '',
        };
    } finally {
        pdf.destroy?.();
    }
}

export const formatMB = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`;
