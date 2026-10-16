'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

const ADD_NEW = '__add_new__';

interface DirectorySelectProps {
    type: 'school' | 'college';
    value: string;
    options: string[];
    onChange: (value: string) => void;
    // Called after a new entry is saved so the parent can refresh its list.
    onAdded: () => void;
    placeholder: string;
}

// A plain <select> (works reliably in every browser/WebView, unlike <datalist>)
// listing every known name, with an "Add new entry" option at the end. New entries
// are saved to the permanent directory immediately, so they're available forever.
export default function DirectorySelect({ type, value, options, onChange, onAdded, placeholder }: DirectorySelectProps) {
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);

    // A value already on the student that isn't in the directory yet (shouldn't
    // normally happen, but keep it selectable rather than silently dropping it).
    const hasValue = !!value && !options.some(o => o.toLowerCase() === value.toLowerCase());

    const saveNew = async () => {
        const name = draft.trim();
        if (!name) {
            toast.error(`Enter a ${type} name`);
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/school-college-directory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add');
            onChange(data.name || name);
            onAdded();
            setAdding(false);
            setDraft('');
            toast.success(`Added "${data.name || name}"`);
        } catch (e: any) {
            toast.error(e.message || 'Failed to add entry');
        } finally {
            setSaving(false);
        }
    };

    const selectClasses = 'w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500';

    if (adding) {
        return (
            <div className="flex gap-2">
                <input
                    autoFocus
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); saveNew(); }
                        if (e.key === 'Escape') { setAdding(false); setDraft(''); }
                    }}
                    placeholder={`New ${type} name`}
                    className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-white/5 border border-blue-500/50 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                />
                <button
                    type="button"
                    onClick={saveNew}
                    disabled={saving}
                    className="px-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold"
                >
                    {saving ? '...' : 'Add'}
                </button>
                <button
                    type="button"
                    onClick={() => { setAdding(false); setDraft(''); }}
                    className="px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm"
                >
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <select
            value={value}
            onChange={e => {
                if (e.target.value === ADD_NEW) {
                    setAdding(true);
                } else {
                    onChange(e.target.value);
                }
            }}
            className={selectClasses}
        >
            <option value="" className="bg-slate-800 text-white">{placeholder}</option>
            {hasValue && <option value={value} className="bg-slate-800 text-white">{value}</option>}
            {options.map(o => (
                <option key={o} value={o} className="bg-slate-800 text-white">{o}</option>
            ))}
            <option value={ADD_NEW} className="bg-slate-800 text-blue-300">＋ Add new entry…</option>
        </select>
    );
}
