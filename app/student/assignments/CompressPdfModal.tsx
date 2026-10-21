'use client';

import { useEffect, useState } from 'react';
import { FileText, Minimize2, Loader2, Upload, X, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { compressPdfForUpload, formatMB, UPLOAD_LIMIT_BYTES, type CompressResult, type CompressProgress } from '@/lib/pdfCompress';

/**
 * Shown when a student picks a PDF over the 3 MB limit. Compresses it on the device (nothing is
 * uploaded until they press "Upload Now"), then hands the smaller file to the normal upload.
 */
export default function CompressPdfModal({ file, onUpload, onClose }: {
    file: File;
    onUpload: (compressed: File) => void;
    onClose: () => void;
}) {
    const [stage, setStage] = useState<'intro' | 'working' | 'done' | 'failed'>('intro');
    const [progress, setProgress] = useState<CompressProgress | null>(null);
    const [result, setResult] = useState<CompressResult | null>(null);
    const [error, setError] = useState('');

    useEffect(() => () => { if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl); }, [result]);

    const compress = async () => {
        setStage('working');
        setError('');
        try {
            const r = await compressPdfForUpload(file, setProgress);
            setResult(r);
            setStage('done');
        } catch (e: any) {
            setError(e?.message || 'Compression failed on this device.');
            setStage('failed');
        }
    };

    const saved = result ? Math.round((1 - result.bytes / result.originalBytes) * 100) : 0;
    const pct = progress ? Math.round((progress.page / progress.pages) * 100) : 0;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="relative sd-gborder bg-[#140d27] w-full sm:max-w-md max-h-[92svh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl">
                <div className="h-1.5 w-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400" />
                <div className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shrink-0">
                                <Minimize2 className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-lg font-black text-white">PDF too large</h2>
                        </div>
                        {stage !== 'working' && (
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                        )}
                    </div>

                    {/* File + size */}
                    <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                        <FileText className="w-5 h-5 text-rose-300 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white truncate">{file.name}</p>
                            <p className="text-xs text-violet-200/60">
                                Size <b className="text-rose-300">{formatMB(file.size)}</b> - it needs to be under <b className="text-white">{formatMB(UPLOAD_LIMIT_BYTES).replace('.00', '')}</b>
                            </p>
                        </div>
                    </div>

                    {stage === 'intro' && (
                        <>
                            <p className="text-sm text-gray-300 leading-relaxed">
                                We can make it smaller right here on your phone, just enough to fit, keeping your handwriting as clear as possible. Nothing is uploaded until you check it.
                            </p>
                            <button onClick={compress}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white font-black shadow-lg shadow-fuchsia-500/25 active:scale-95 transition-transform">
                                <Minimize2 className="w-4 h-4" /> Compress here
                            </button>
                        </>
                    )}

                    {stage === 'working' && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-fuchsia-200">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {progress
                                    ? <>Compressing page {progress.page} of {progress.pages}{progress.pass > 1 ? ` (making it a bit smaller, try ${progress.pass})` : ''}...</>
                                    : 'Getting ready...'}
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 transition-[width] duration-300" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[11px] text-violet-200/50">Please keep this screen open - it can take up to a minute for long PDFs.</p>
                        </div>
                    )}

                    {stage === 'done' && result && (
                        <div className="space-y-3">
                            <div className="flex items-start gap-2 rounded-xl bg-lime-400/10 border border-lime-300/30 p-3">
                                <CheckCircle2 className="w-5 h-5 text-lime-300 shrink-0" />
                                <p className="text-sm text-lime-100">
                                    Compressed from <b>{formatMB(result.originalBytes)}</b> to <b>{formatMB(result.bytes)}</b> ({saved}% smaller, {result.pages} page{result.pages === 1 ? '' : 's'}). You can upload it now.
                                </p>
                            </div>
                            {result.previewUrl && (
                                <div>
                                    <p className="text-[11px] text-violet-200/60 mb-1">Page 1 - check that your writing is readable:</p>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={result.previewUrl} alt="Page 1 preview" className="w-full max-h-72 object-contain rounded-lg bg-white" />
                                </div>
                            )}
                            <button onClick={() => onUpload(result.file)}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 text-white font-black shadow-lg shadow-lime-500/20 active:scale-95 transition-transform">
                                <Upload className="w-4 h-4" /> Upload Now
                            </button>
                            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold">
                                Choose a different file
                            </button>
                        </div>
                    )}

                    {stage === 'failed' && (
                        <div className="space-y-3">
                            <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-400/30 p-3">
                                <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
                                <p className="text-sm text-rose-100">{error}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl ring-1 ring-white/10 space-y-2 text-sm text-gray-300">
                                <p className="font-bold text-white">Other ways to fix it:</p>
                                <ol className="list-decimal pl-4 space-y-1.5 text-gray-400">
                                    <li>Search Google for <strong className="text-white">&quot;Compress pdf online&quot;</strong> and open a site such as ilovepdf.com or smallpdf.com</li>
                                    <li>Upload your PDF there, compress it, and download the smaller file</li>
                                    <li>Come back and upload that file here</li>
                                </ol>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={compress} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold">
                                    <RefreshCw className="w-4 h-4" /> Try again
                                </button>
                                <button onClick={onClose} className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold">Close</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
