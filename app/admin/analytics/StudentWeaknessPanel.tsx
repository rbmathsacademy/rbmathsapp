'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Copy, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { WeaknessReport, StudentWeakness } from '@/lib/weakness/types';
import { generateWeaknessPDF, buildAIExport } from './generateWeaknessPDF';

const LEVEL_STYLE: Record<string, string> = {
    Critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    Weak: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    Watch: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

export default function StudentWeaknessPanel({ batch }: { batch: string }) {
    const [report, setReport] = useState<WeaknessReport | null>(null);
    const [pending, setPending] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [open, setOpen] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const runId = useRef(0);

    // Loads the analysis. The server summarises a limited number of attempts per call, so keep
    // asking until nothing is pending.
    const load = async (rebuild = false) => {
        const id = ++runId.current;
        setLoading(true);
        setError('');
        try {
            let first = true;
            while (true) {
                const res = await fetch(`/api/admin/analytics/weakness?batch=${encodeURIComponent(batch)}${rebuild && first ? '&rebuild=1' : ''}`);
                first = false;
                const json = await res.json();
                if (id !== runId.current) return; // batch changed meanwhile
                if (!res.ok) throw new Error(json.error || 'Failed');
                setReport(json.report);
                setPending(json.progress.pending);
                setTotal(json.progress.totalAttempts);
                if (json.progress.pending <= 0) break;
            }
        } catch (e: any) {
            if (id === runId.current) setError(e.message || 'Failed to analyse');
        } finally {
            if (id === runId.current) setLoading(false);
        }
    };

    useEffect(() => {
        setReport(null);
        load();
        return () => { runId.current++; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batch]);

    const students: StudentWeakness[] = (report?.students || [])
        .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    const copyAI = async (onlyId?: string) => {
        if (!report) return;
        try {
            await navigator.clipboard.writeText(buildAIExport(report, onlyId));
            toast.success('Copied. Paste it into your AI along with your request.');
        } catch {
            toast.error('Could not copy to clipboard');
        }
    };

    const pdf = (onlyId?: string) => {
        if (!report) return;
        try { generateWeaknessPDF(report, onlyId); } catch (e) { console.error(e); toast.error('PDF generation failed'); }
    };

    return (
        <div className="space-y-4">
            <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-white">Student Weakness Analysis</h2>
                    <p className="text-xs text-gray-400 mt-1">
                        Built from every online test question (by topic and sub-topic) and the teacher ratings on assignments.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => pdf()} disabled={!report || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                        <Download className="w-4 h-4" /> Download PDF
                    </button>
                    <button onClick={() => copyAI()} disabled={!report || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                        <Copy className="w-4 h-4" /> Copy JSON for AI
                    </button>
                    <button onClick={() => load(true)} disabled={loading} title="Re-read all test attempts from scratch"
                        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            {loading && (
                <div className="text-sm text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                    Analysing test attempts{total > 0 ? ` (${Math.max(0, total - pending)} of ${total} read)` : ''}... the first run for a batch is slow; later runs are quick.
                </div>
            )}
            {error && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </div>
            )}

            {report && (
                <>
                    {report.notes.length > 0 && (
                        <ul className="text-xs text-gray-400 list-disc pl-5 space-y-1">
                            {report.notes.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                    )}
                    <input
                        value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..."
                        className="w-full sm:w-72 bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                    />
                    <div className="space-y-2">
                        {students.map(s => {
                            const isOpen = open === s.studentId;
                            const counts = { Critical: 0, Weak: 0, Watch: 0 } as Record<string, number>;
                            s.weaknesses.forEach(w => counts[w.level]++);
                            return (
                                <div key={s.studentId} className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden">
                                    <button onClick={() => setOpen(isOpen ? null : s.studentId)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                                        <div className="min-w-0">
                                            <p className="font-medium text-white truncate">{s.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {s.overall.testsTaken} tests{s.overall.avgTestPct != null ? ` | avg ${s.overall.avgTestPct}%` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {(['Critical', 'Weak', 'Watch'] as const).map(l => counts[l] > 0 && (
                                                <span key={l} className={`text-[11px] font-bold px-2 py-0.5 rounded border ${LEVEL_STYLE[l]}`}>{counts[l]} {l}</span>
                                            ))}
                                            {s.weaknesses.length === 0 && <span className="text-[11px] text-green-400">No weak areas</span>}
                                            {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                        </div>
                                    </button>
                                    {isOpen && (
                                        <div className="border-t border-white/5 p-4 space-y-4">
                                            <div className="flex flex-wrap gap-2">
                                                <button onClick={() => pdf(s.studentId)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium">
                                                    <Download className="w-3.5 h-3.5" /> PDF for this student
                                                </button>
                                                <button onClick={() => copyAI(s.studentId)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-medium">
                                                    <Copy className="w-3.5 h-3.5" /> Copy JSON
                                                </button>
                                            </div>
                                            {s.weaknesses.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm min-w-[560px]">
                                                        <thead>
                                                            <tr className="text-xs uppercase text-gray-500 text-left">
                                                                <th className="py-1 pr-3">Topic &gt;&gt; Sub-topic</th>
                                                                <th className="py-1 pr-3">Level</th>
                                                                <th className="py-1 pr-3">Accuracy</th>
                                                                <th className="py-1 pr-3">Batch</th>
                                                                <th className="py-1">Evidence</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {s.weaknesses.map((w, i) => (
                                                                <tr key={i}>
                                                                    <td className="py-2 pr-3 text-gray-200"><span className="text-gray-500">{w.topic} &gt;&gt;</span> {w.category}</td>
                                                                    <td className="py-2 pr-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${LEVEL_STYLE[w.level]}`}>{w.level}</span></td>
                                                                    <td className="py-2 pr-3 text-gray-300">{w.source === 'assignments' ? '-' : `${w.accuracy}%`}</td>
                                                                    <td className="py-2 pr-3 text-gray-500">{w.batchAccuracy != null ? `${w.batchAccuracy}%` : '-'}</td>
                                                                    <td className="py-2 text-xs text-gray-400">{w.reasons.join('; ')}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-400">No consistent weak area found yet.</p>
                                            )}
                                            {s.strengths.length > 0 && (
                                                <p className="text-xs text-green-400/90">
                                                    Strong: {s.strengths.slice(0, 6).map(t => `${t.topic} > ${t.category} (${t.accuracy}%)`).join(' | ')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {students.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">No students found.</p>}
                    </div>
                </>
            )}
        </div>
    );
}
