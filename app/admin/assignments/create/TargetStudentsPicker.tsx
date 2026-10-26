'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';

interface Stu { _id: string; name: string; phoneNumber: string; board?: string | null }
interface Asg { _id: string; title: string; deadline: string }

/**
 * "Who gets it": the whole batch (default) or only some students of the batch. When some students
 * are picked, the admin can also take them out of an existing assignment of the batch (so they do not
 * show as Missed there) - e.g. when this is a special version of that homework for them.
 */
export default function TargetStudentsPicker({ batch, scope, onScope, phones, onPhones, removeFrom, onRemoveFrom }: {
    batch: string;
    scope: 'ALL' | 'SELECTED';
    onScope: (s: 'ALL' | 'SELECTED') => void;
    phones: string[];
    onPhones: (p: string[]) => void;
    removeFrom: string;
    onRemoveFrom: (id: string) => void;
}) {
    const [students, setStudents] = useState<Stu[]>([]);
    const [assignments, setAssignments] = useState<Asg[]>([]);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState('');
    const [board, setBoard] = useState('');

    useEffect(() => {
        if (scope !== 'SELECTED' || !batch) { setStudents([]); setAssignments([]); return; }
        let live = true;
        setLoading(true);
        Promise.all([
            fetch(`/api/admin/students?batch=${encodeURIComponent(batch)}&limit=500`).then(r => r.json()).catch(() => ({})),
            fetch(`/api/admin/assignments?batch=${encodeURIComponent(batch)}`).then(r => r.json()).catch(() => ({})),
        ]).then(([s, a]) => {
            if (!live) return;
            setStudents((s.students || []).slice().sort((x: Stu, y: Stu) => (x.name || '').localeCompare(y.name || '')));
            setAssignments((a.assignments || []).map((x: any) => ({ _id: x._id, title: String(x.title).split('||')[0].trim(), deadline: x.deadline })));
        }).finally(() => live && setLoading(false));
        return () => { live = false; };
    }, [scope, batch]);

    const boards = useMemo(() => Array.from(new Set(students.map(s => s.board).filter(Boolean))) as string[], [students]);
    const shown = students.filter(s =>
        (!board || s.board === board) && (!q.trim() || `${s.name} ${s.phoneNumber}`.toLowerCase().includes(q.trim().toLowerCase())));
    const allShownOn = shown.length > 0 && shown.every(s => phones.includes(s.phoneNumber));
    const toggle = (p: string) => onPhones(phones.includes(p) ? phones.filter(x => x !== p) : [...phones, p]);

    return (
        <div className="space-y-2">
            <label className="block text-sm text-gray-400 mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-violet-400" /> Who gets this assignment?</label>
            <div className="grid grid-cols-2 gap-2">
                {([['ALL', 'Whole batch'], ['SELECTED', 'Selected students']] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => onScope(v)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${scope === v ? 'bg-violet-600/30 border-violet-400/60 text-white' : 'bg-black/20 border-white/10 text-gray-400 hover:text-white'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {scope === 'SELECTED' && (
                !batch ? <p className="text-xs text-amber-300">Pick a batch first.</p> : (
                    <div className="rounded-lg border border-white/10 bg-black/20">
                        <div className="flex flex-wrap items-center gap-2 p-2 border-b border-white/10">
                            <div className="relative flex-1 min-w-[8rem]">
                                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2" />
                                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / phone"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white outline-none focus:border-violet-500" />
                            </div>
                            {boards.length > 0 && (
                                <select value={board} onChange={e => setBoard(e.target.value)}
                                    className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none">
                                    <option value="">All boards</option>
                                    {boards.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            )}
                            <button type="button"
                                onClick={() => onPhones(allShownOn ? phones.filter(p => !shown.some(s => s.phoneNumber === p)) : Array.from(new Set([...phones, ...shown.map(s => s.phoneNumber)])))}
                                className="text-xs text-violet-300 font-bold bg-violet-500/10 px-2 py-1.5 rounded-lg">
                                {allShownOn ? 'Deselect shown' : 'Select all shown'}
                            </button>
                        </div>
                        <p className="px-3 py-1.5 text-[11px] text-violet-200/70">{phones.length} selected of {students.length}</p>
                        <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                            {loading && <p className="p-3 text-xs text-gray-500">Loading students...</p>}
                            {shown.map(s => (
                                <label key={s._id} className="flex items-center gap-3 px-3 py-2 text-sm text-white cursor-pointer hover:bg-white/5">
                                    <input type="checkbox" checked={phones.includes(s.phoneNumber)} onChange={() => toggle(s.phoneNumber)} />
                                    <span className="flex-1 truncate">{s.name}</span>
                                    {s.board && <span className="text-[10px] text-violet-300/70">{s.board}</span>}
                                </label>
                            ))}
                            {!loading && shown.length === 0 && <p className="p-3 text-xs text-gray-500">No students found.</p>}
                        </div>
                    </div>
                )
            )}

            {scope === 'SELECTED' && phones.length > 0 && assignments.length > 0 && (
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Also remove these students from (optional)</label>
                    <select value={removeFrom} onChange={e => onRemoveFrom(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50">
                        <option value="">Keep them in all other assignments</option>
                        {assignments.map(a => <option key={a._id} value={a._id}>{a.title}</option>)}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">They will be excluded from the chosen assignment, so it does not show as Missed there.</p>
                </div>
            )}
        </div>
    );
}
