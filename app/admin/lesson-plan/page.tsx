'use client';

import { useState, useEffect } from 'react';
import {
    BookText, Plus, Trash2, Save, Calendar as CalendarIcon,
    ChevronDown, GraduationCap, Laptop, ClipboardList, Loader2
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

interface LessonPlanItem {
    date: string;
    type: 'Class' | 'Online' | 'Offline';
    description: string;
    _id?: string;
    tempId?: number; // For stable keys when adding new rows
}

export default function AdminLessonPlan() {
    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string>('');
    const [plans, setPlans] = useState<LessonPlanItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchBatches();
    }, []);

    useEffect(() => {
        if (selectedBatch) {
            fetchPlans(selectedBatch);
        } else {
            setPlans([]);
        }
    }, [selectedBatch]);

    const fetchBatches = async () => {
        try {
            const res = await fetch('/api/admin/fees/batches');
            const data = await res.json();
            if (data.batches) setBatches(data.batches);
        } catch (e) {
            console.error('Error fetching batches:', e);
            toast.error('Failed to load batches');
        }
    };

    const fetchPlans = async (batch: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/lesson-plan?batch=${encodeURIComponent(batch)}`);
            const data = await res.json();
            if (data.success) {
                // Convert dates to YYYY-MM-DD for input[type="date"]
                const formattedPlans = data.plans.map((p: any) => ({
                    ...p,
                    date: new Date(p.date).toISOString().split('T')[0]
                }));
                setPlans(formattedPlans);
            }
        } catch (e) {
            console.error('Error fetching plans:', e);
            toast.error('Failed to load lesson plans');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        const today = new Date().toISOString().split('T')[0];
        setPlans([...plans, { date: today, type: 'Class', description: '', tempId: Date.now() }]);
    };

    const handleRemoveRow = (index: number) => {
        const newPlans = [...plans];
        newPlans.splice(index, 1);
        setPlans(newPlans);
    };

    const handleChange = (index: number, field: keyof LessonPlanItem, value: string) => {
        const newPlans = [...plans];
        newPlans[index] = { ...newPlans[index], [field]: value };
        setPlans(newPlans);
    };

    const handleSave = async () => {
        if (!selectedBatch) {
            toast.error('Please select a batch first');
            return;
        }

        // Validate
        const hasEmpty = plans.some(p => !p.date || !p.description);
        if (hasEmpty && plans.length > 0) {
            toast.error('Please fill in all dates and descriptions');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/admin/lesson-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: selectedBatch, plans })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Lesson plan saved successfully');
                fetchPlans(selectedBatch);
            } else {
                throw new Error(data.error || 'Failed to save');
            }
        } catch (e: any) {
            toast.error(e.message || 'Error saving lesson plan');
        } finally {
            setSaving(false);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Class': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            case 'Online': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
            case 'Offline': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Class': return <GraduationCap className="h-4 w-4" />;
            case 'Online': return <Laptop className="h-4 w-4" />;
            case 'Offline': return <ClipboardList className="h-4 w-4" />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            <Toaster position="top-right" />

            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 flex items-center gap-3">
                        <BookText className="h-8 w-8 text-blue-500" />
                        Lesson Plan Management
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Design and schedule the curriculum for each batch</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving || !selectedBatch}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Plan
                    </button>
                    <button
                        onClick={handleAddRow}
                        disabled={!selectedBatch}
                        className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all border border-white/10 flex items-center gap-2 disabled:opacity-50"
                    >
                        <Plus className="h-4 w-4 text-emerald-500" />
                        Add Row
                    </button>
                </div>
            </div>

            {/* Batch Selector */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-full md:w-72">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Select Batch</label>
                        <div className="relative">
                            <select
                                value={selectedBatch}
                                onChange={(e) => setSelectedBatch(e.target.value)}
                                className="w-full appearance-none bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer"
                            >
                                <option value="">-- Choose a Batch --</option>
                                {batches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                    {selectedBatch && (
                        <div className="flex-1 flex items-center gap-4 text-sm text-slate-400 bg-blue-500/5 border border-blue-500/10 rounded-xl px-4 py-3">
                            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                            Editing plan for <span className="text-blue-400 font-bold">{selectedBatch}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Grid UI */}
            {!selectedBatch ? (
                <div className="bg-slate-900/30 border border-dashed border-white/10 rounded-2xl py-20 text-center">
                    <BookText className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Please select a batch to start creating a lesson plan</p>
                </div>
            ) : loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    <p className="text-slate-400 text-sm animate-pulse">Loading batch schedule...</p>
                </div>
            ) : (
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-800/80 border-b border-white/10">
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-48">Date (DD/MM/YYYY)</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-48">Type</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">General Plain Text Description</th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {plans.map((plan, index) => (
                                    <tr key={plan._id || plan.tempId || index} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="relative">
                                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                                                <input
                                                    type="date"
                                                    value={plan.date}
                                                    onChange={(e) => handleChange(index, 'date', e.target.value)}
                                                    className="w-full bg-slate-800 border border-white/5 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative">
                                                <select
                                                    value={plan.type}
                                                    onChange={(e) => handleChange(index, 'type', e.target.value as any)}
                                                    className={`w-full appearance-none bg-slate-800 border-white/5 rounded-lg pl-3 pr-8 py-2 text-sm font-bold outline-none transition-all border ${getTypeColor(plan.type)}`}
                                                >
                                                    <option value="Class">Class</option>
                                                    <option value="Online">Online Exam</option>
                                                    <option value="Offline">Offline Exam</option>
                                                </select>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                    {getTypeIcon(plan.type)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <textarea
                                                value={plan.description}
                                                onChange={(e) => handleChange(index, 'description', e.target.value)}
                                                placeholder="Enter topic details, class content, or exam syllabus..."
                                                className="w-full bg-slate-800/50 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-300 focus:text-white focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all resize-none min-h-[40px]"
                                                rows={1}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleRemoveRow(index)}
                                                className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {plans.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                                            No plans created for this batch. Click "Add Row" to start.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Mobile Helper Message */}
            <div className="md:hidden bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                <p className="text-xs text-amber-400 font-medium">Tip: Swipe horizontally on the table to see all columns</p>
            </div>
        </div>
    );
}
