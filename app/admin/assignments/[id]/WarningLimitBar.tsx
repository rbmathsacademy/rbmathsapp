'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ShieldAlert, Loader2 } from 'lucide-react';

/**
 * "Warn when more than N questions are wrong + skipped". Applies to every graded copy whichever way
 * it was graded (pasted Gemini reply, Claude, manual edit): flagged students glow red here, get a
 * one-time notification, and see a red warning on their assignment. Empty = warnings off.
 */
export default function WarningLimitBar({ assignmentId, initial, onChanged }: { assignmentId: string; initial: number | null | undefined; onChanged: () => void }) {
    const [value, setValue] = useState(initial == null ? '' : String(initial));
    const [saved, setSaved] = useState<number | null>(initial ?? null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { setValue(initial == null ? '' : String(initial)); setSaved(initial ?? null); }, [initial]);

    const dirty = (value.trim() === '' ? null : Number(value)) !== saved;

    const save = async () => {
        setBusy(true);
        try {
            let auth: Record<string, string> = {};
            try { const t = localStorage.getItem('adminToken'); if (t) auth = { Authorization: `Bearer ${t}` }; } catch { }
            const res = await fetch(`/api/admin/assignments/${assignmentId}/warning-limit`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth },
                body: JSON.stringify({ limit: value.trim() === '' ? null : Number(value) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not save');
            setSaved(data.limit);
            toast.success(data.limit === null ? 'Warnings switched off' : `Limit ${data.limit} saved: ${data.warned} student${data.warned === 1 ? '' : 's'} flagged${data.notified ? `, ${data.notified} notified` : ''}`);
            onChanged();
        } catch (e: any) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    return (
        <section className="rounded-xl border border-rose-400/20 bg-rose-500/[0.04] p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 text-sm font-black text-white">
                <ShieldAlert className="h-4 w-4 text-rose-300" /> Warning limit
            </div>
            <label className="flex items-center gap-2 text-[11px] sm:text-xs text-violet-200/70">
                Flag a graded student with more than
                <input type="number" min={0} max={500} value={value} onChange={e => setValue(e.target.value)} placeholder="off"
                    className="w-16 bg-[#0b0718] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-rose-400/60" />
                wrong + skipped questions
            </label>
            <button onClick={save} disabled={busy || !dirty}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/90 hover:bg-rose-400 text-white text-xs font-black disabled:opacity-40 active:scale-95 transition-transform sm:ml-auto">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </button>
        </section>
    );
}
