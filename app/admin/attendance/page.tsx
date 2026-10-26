'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { CalendarCheck, Loader2, Save, Check, X, Search } from 'lucide-react';

interface Stu {
    _id: string; name: string; phoneNumber: string; alternativePhone: string; guardianPhone: string; board: string | null; present: boolean;
}

const authHeaders = (): Record<string, string> => {
    try { const t = localStorage.getItem('adminToken'); return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
};

/** Today in India time as YYYY-MM-DD */
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const pretty = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const defaultMessage = (iso: string) => `Today ${pretty(iso)} your ward was absent in class without any prior intimation.`;

export default function AttendancePage() {
    const [batches, setBatches] = useState<string[]>([]);
    const [batch, setBatch] = useState('');
    const [date, setDate] = useState(todayIST());
    const [students, setStudents] = useState<Stu[]>([]);
    const [savedDates, setSavedDates] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [q, setQ] = useState('');

    // WhatsApp
    const [recipient, setRecipient] = useState<'student' | 'guardian'>('guardian');
    const [message, setMessage] = useState(defaultMessage(todayIST()));
    const messageEdited = useRef(false);
    const [skipped, setSkipped] = useState<Set<string>>(new Set()); // absent students removed from the message list

    useEffect(() => {
        fetch('/api/admin/courses').then(r => r.json()).then(d => { if (Array.isArray(d)) setBatches(d); }).catch(() => toast.error('Failed to load batches'));
    }, []);

    useEffect(() => { if (!messageEdited.current) setMessage(defaultMessage(date)); }, [date]);

    useEffect(() => {
        if (!batch) { setStudents([]); return; }
        let live = true;
        setLoading(true);
        fetch(`/api/admin/attendance?batch=${encodeURIComponent(batch)}&date=${date}`, { headers: authHeaders(), cache: 'no-store' })
            .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed'); return d; })
            .then(d => {
                if (!live) return;
                setStudents(d.students || []); setSaved(!!d.saved); setSavedDates(d.dates || []); setDirty(false); setSkipped(new Set());
            })
            .catch((e: any) => live && toast.error(e.message || 'Could not load attendance'))
            .finally(() => live && setLoading(false));
        return () => { live = false; };
    }, [batch, date]);

    const toggle = (id: string) => { setStudents(prev => prev.map(s => (s._id === id ? { ...s, present: !s.present } : s))); setDirty(true); };
    const setAll = (present: boolean) => { setStudents(prev => prev.map(s => ({ ...s, present }))); setDirty(true); };

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/attendance', {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ batch, date, absentIds: students.filter(s => !s.present).map(s => s._id) }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Failed');
            setSaved(true); setDirty(false);
            setSavedDates(prev => (prev.includes(date) ? prev : [date, ...prev].sort().reverse()));
            toast.success(`Attendance saved for ${pretty(date)}: ${d.present} present, ${d.absent} absent`);
        } catch (e: any) { toast.error(e.message || 'Could not save'); }
        finally { setSaving(false); }
    };

    const presentCount = students.filter(s => s.present).length;
    const absent = students.filter(s => !s.present);
    const shown = useMemo(() => students.filter(s => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase())), [students, q]);
    const sendList = absent.filter(s => !skipped.has(s._id));

    const copyForWhatsApp = () => {
        if (sendList.length === 0) return toast.error('No students selected');
        if (!message.trim()) return toast.error('Message cannot be empty');
        const phones = sendList.map(s => (recipient === 'guardian' ? s.guardianPhone : (s.alternativePhone || s.phoneNumber))).filter(Boolean);
        if (phones.length === 0) return toast.error('No valid phone numbers found for the selected mode');
        const missing = sendList.length - phones.length;
        navigator.clipboard.writeText(`WHATSAPP_BULK|||${message}|||${phones.join(',')}`)
            .then(() => toast.success(`Copied ${phones.length} number(s)${missing ? ` (${missing} had no ${recipient} number)` : ''}! Open WhatsApp Web and press F9`))
            .catch(() => toast.error('Could not copy to clipboard'));
    };

    return (
        <div className="max-w-3xl mx-auto space-y-5 pb-24">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center"><CalendarCheck className="h-5 w-5 text-white" /></div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-white">Attendance</h1>
                    <p className="text-xs text-violet-200/60">Everyone starts as present. Tap a student to mark absent.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={batch} onChange={e => setBatch(e.target.value)}
                    className="w-full bg-[#140d27] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500">
                    <option value="">Select batch</option>
                    {batches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <input type="date" value={date} max={todayIST()} onChange={e => e.target.value && setDate(e.target.value)}
                    className="w-full bg-[#140d27] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500" />
            </div>

            {batch && savedDates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[11px] text-violet-200/50 mr-1">Saved days:</span>
                    {savedDates.slice(0, 14).map(d => (
                        <button key={d} onClick={() => setDate(d)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${d === date ? 'bg-violet-600/40 border-violet-400/60 text-white' : 'bg-white/5 border-white/10 text-violet-200/70 hover:text-white'}`}>{pretty(d)}</button>
                    ))}
                </div>
            )}

            {batch && (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-lime-400/15 text-lime-300 border border-lime-300/30 text-xs font-bold">Present {presentCount}</span>
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-400/30 text-xs font-bold">Absent {absent.length}</span>
                        <span className={`text-[11px] ${saved ? 'text-lime-300' : 'text-amber-300'}`}>{saved ? (dirty ? 'Saved earlier - unsaved changes' : '✓ Saved') : 'Not saved yet'}</span>
                        <div className="ml-auto flex gap-2">
                            <button onClick={() => setAll(true)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white">All present</button>
                            <button onClick={() => setAll(false)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white">All absent</button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search student"
                            className="w-full bg-[#140d27] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-violet-500" />
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#140d27]/80 divide-y divide-white/5 overflow-hidden">
                        {loading && <p className="p-4 text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading students...</p>}
                        {!loading && shown.length === 0 && <p className="p-4 text-sm text-gray-500">No students found.</p>}
                        {shown.map((s, i) => (
                            <button key={s._id} onClick={() => toggle(s._id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${s.present ? 'hover:bg-white/5' : 'bg-rose-500/[0.10] shadow-[inset_4px_0_0_rgba(244,63,94,0.9)]'}`}>
                                <span className="text-[11px] text-gray-500 w-6 shrink-0">{i + 1}</span>
                                <span className="flex-1 min-w-0 truncate text-sm font-medium text-white">{s.name}{s.board ? <span className="ml-2 text-[10px] text-violet-300/60">{s.board}</span> : null}</span>
                                <span className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black border ${s.present ? 'bg-lime-400/15 text-lime-300 border-lime-300/30' : 'bg-rose-500/20 text-rose-300 border-rose-400/40'}`}>
                                    {s.present ? <><Check className="w-3.5 h-3.5" /> Present</> : <><X className="w-3.5 h-3.5" /> Absent</>}
                                </span>
                            </button>
                        ))}
                    </div>

                    <button onClick={save} disabled={saving || loading || students.length === 0}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 text-white font-black text-sm disabled:opacity-50 active:scale-[0.99] transition-transform">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saved ? 'Update attendance' : 'Save attendance'} for {pretty(date)}
                    </button>

                    {absent.length > 0 && (
                        <div className="rounded-xl border border-rose-400/30 bg-[#140d27]/80 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-bold text-rose-200">📱 WhatsApp Auto-Sender - absent students ({sendList.length} of {absent.length})</h3>
                                <select value={recipient} onChange={e => setRecipient(e.target.value as any)}
                                    className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none cursor-pointer">
                                    <option value="guardian">Send to Guardian</option>
                                    <option value="student">Send to Student</option>
                                </select>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/20 max-h-48 overflow-y-auto divide-y divide-white/5">
                                {absent.map(s => {
                                    const phone = recipient === 'guardian' ? s.guardianPhone : (s.alternativePhone || s.phoneNumber);
                                    return (
                                        <label key={s._id} className="flex items-center gap-3 px-3 py-2 text-sm text-white cursor-pointer hover:bg-white/5">
                                            <input type="checkbox" checked={!skipped.has(s._id)}
                                                onChange={() => setSkipped(prev => { const n = new Set(prev); if (n.has(s._id)) n.delete(s._id); else n.add(s._id); return n; })} />
                                            <span className="flex-1 truncate">{s.name}</span>
                                            <span className={`text-[11px] ${phone ? 'text-violet-300/60' : 'text-amber-300'}`}>{phone || `no ${recipient} no.`}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            <textarea rows={3} value={message} onChange={e => { messageEdited.current = true; setMessage(e.target.value); }}
                                className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500" />
                            <button onClick={copyForWhatsApp} disabled={sendList.length === 0}
                                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold text-sm disabled:opacity-50 transition-colors">
                                Copy for WhatsApp Auto-Sender ({sendList.length})
                            </button>
                            {dirty && <p className="text-[11px] text-amber-300">You have unsaved changes - save the attendance first so it matches what you send.</p>}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
