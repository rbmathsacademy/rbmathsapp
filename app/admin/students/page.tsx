'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Trash2, Edit3, X, Upload, ChevronLeft, ChevronRight, Phone, Shield, CheckSquare, Square, RefreshCw } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Student {
    _id: string;
    name: string;
    phoneNumber: string;
    courses: string[];
    guardianPhone?: string;
    guardianName?: string;
    email?: string;
    createdAt: string;
}

export default function AdminStudents() {
    const [students, setStudents] = useState<Student[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [batchFilter, setBatchFilter] = useState('');
    const [batches, setBatches] = useState<string[]>([]);

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showRenameBatchModal, setShowRenameBatchModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    // Selection state
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

    // Rename batch form
    const [renameBatchForm, setRenameBatchForm] = useState({ oldBatch: '', newBatch: '' });

    // Form state
    const [form, setForm] = useState({
        name: '', phoneNumber: '', courses: [] as string[],
        guardianPhone: '', guardianName: '', email: ''
    });
    const [bulkText, setBulkText] = useState('');
    const [newCourseInput, setNewCourseInput] = useState('');

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '25' });
            if (search) params.set('search', search);
            if (batchFilter) params.set('batch', batchFilter);

            const res = await fetch(`/api/admin/students?${params}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setStudents(data.students);
            setTotal(data.total);
            setTotalPages(data.totalPages);
        } catch (error) {
            toast.error('Failed to fetch students');
        } finally {
            setLoading(false);
        }
    }, [page, search, batchFilter]);

    const fetchBatches = async () => {
        try {
            const res = await fetch('/api/admin/fees/batches');
            if (res.ok) {
                const data = await res.json();
                setBatches(data.batches || []);
            }
        } catch { }
    };

    useEffect(() => { fetchBatches(); }, []);
    useEffect(() => { fetchStudents(); }, [fetchStudents]);

    // Debounced search
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (searchTimeout) clearTimeout(searchTimeout);
        setSearchTimeout(setTimeout(() => { setPage(1); }, 300));
    };

    const resetForm = () => {
        setForm({ name: '', phoneNumber: '', courses: [], guardianPhone: '', guardianName: '', email: '' });
        setNewCourseInput('');
    };

    const handleAddStudent = async () => {
        if (!form.name.trim() || !form.phoneNumber.trim()) {
            toast.error('Name and phone number are required');
            return;
        }
        try {
            const res = await fetch('/api/admin/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success('Student added successfully');
            setShowAddModal(false);
            resetForm();
            fetchStudents();
            fetchBatches();
        } catch (error: any) {
            toast.error(error.message || 'Failed to add student');
        }
    };

    const handleEditStudent = async () => {
        if (!editingStudent) return;
        try {
            const res = await fetch(`/api/admin/students/${editingStudent._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success('Student updated successfully');
            setShowEditModal(false);
            setEditingStudent(null);
            resetForm();
            fetchStudents();
            fetchBatches();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update student');
        }
    };

    const handleDeleteStudent = async (student: Student) => {
        if (!confirm(`Are you sure you want to permanently delete ${student.name}? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/admin/students/${student._id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            toast.success('Student deleted');
            fetchStudents();
        } catch {
            toast.error('Failed to delete student');
        }
    };

    const openEditModal = (student: Student) => {
        setEditingStudent(student);
        setForm({
            name: student.name,
            phoneNumber: student.phoneNumber,
            courses: [...student.courses],
            guardianPhone: student.guardianPhone || '',
            guardianName: student.guardianName || '',
            email: student.email || ''
        });
        setShowEditModal(true);
    };

    const handleBulkImport = async () => {
        try {
            let parsed;
            try {
                parsed = JSON.parse(bulkText);
            } catch {
                toast.error('Invalid JSON. Please paste a valid JSON array.');
                return;
            }
            if (!Array.isArray(parsed)) {
                toast.error('Input must be a JSON array of students');
                return;
            }
            const res = await fetch('/api/admin/students/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ students: parsed })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(data.message);
            setShowBulkModal(false);
            setBulkText('');
            fetchStudents();
            fetchBatches();
        } catch (error: any) {
            toast.error(error.message || 'Bulk import failed');
        }
    };

    // --- Selection Handlers ---
    const toggleStudentSelection = (id: string) => {
        setSelectedStudents(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedStudents.size === students.length && students.length > 0) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(students.map(s => s._id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedStudents.size === 0) return;
        if (!confirm(`Are you sure you want to permanently delete ${selectedStudents.size} student(s)? This cannot be undone.`)) return;
        const toastId = toast.loading(`Deleting ${selectedStudents.size} student(s)...`);
        try {
            const res = await fetch('/api/admin/students/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentIds: Array.from(selectedStudents) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(data.message, { id: toastId });
            setSelectedStudents(new Set());
            fetchStudents();
        } catch (error: any) {
            toast.error(error.message || 'Bulk delete failed', { id: toastId });
        }
    };

    const handleRenameBatch = async () => {
        if (!renameBatchForm.oldBatch || !renameBatchForm.newBatch.trim()) {
            toast.error('Please select old batch and enter new batch name');
            return;
        }
        if (renameBatchForm.oldBatch === renameBatchForm.newBatch.trim()) {
            toast.error('Old and new batch names are the same');
            return;
        }
        const toastId = toast.loading('Renaming batch...');
        try {
            const res = await fetch('/api/admin/students/rename-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentIds: Array.from(selectedStudents),
                    oldBatch: renameBatchForm.oldBatch,
                    newBatch: renameBatchForm.newBatch.trim()
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(data.message, { id: toastId });
            setShowRenameBatchModal(false);
            setRenameBatchForm({ oldBatch: '', newBatch: '' });
            setSelectedStudents(new Set());
            fetchStudents();
            fetchBatches();
        } catch (error: any) {
            toast.error(error.message || 'Rename failed', { id: toastId });
        }
    };

    // Get common batches among selected students (for rename batch modal)
    const getCommonBatches = (): string[] => {
        const selected = students.filter(s => selectedStudents.has(s._id));
        if (selected.length === 0) return [];
        const allBatches = new Set<string>();
        selected.forEach(s => s.courses.forEach(c => allBatches.add(c)));
        return Array.from(allBatches);
    };

    const addCourseToForm = () => {
        const course = newCourseInput.trim();
        if (course && !form.courses.includes(course)) {
            setForm({ ...form, courses: [...form.courses, course] });
            setNewCourseInput('');
        }
    };

    const removeCourseFromForm = (course: string) => {
        setForm({ ...form, courses: form.courses.filter(c => c !== course) });
    };

    // Shared form UI
    const renderFormFields = () => (
        <div className="space-y-4">
            {/* Name */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Student Name *</label>
                <input
                    type="text" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    placeholder="Full name"
                />
            </div>
            {/* Phone */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number *</label>
                <input
                    type="tel" value={form.phoneNumber}
                    onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    placeholder="10-digit phone number"
                />
            </div>
            {/* Batches / Courses */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Batches / Courses</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.courses.map(c => (
                        <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/20">
                            {c}
                            <button onClick={() => removeCourseFromForm(c)} className="hover:text-red-400 transition-colors"><X className="h-3 w-3" /></button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <select
                        value={newCourseInput}
                        onChange={e => setNewCourseInput(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                        <option value="" className="bg-slate-800 text-white">Select existing batch...</option>
                        {batches.filter(b => !form.courses.includes(b)).map(b => (
                            <option key={b} value={b} className="bg-slate-800 text-white">{b}</option>
                        ))}
                    </select>
                    <button onClick={addCourseToForm} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors">
                        Add
                    </button>
                </div>
                <div className="mt-2 flex gap-2">
                    <input
                        type="text" value={newCourseInput}
                        onChange={e => setNewCourseInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCourseToForm(); } }}
                        className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                        placeholder="Or type new batch name..."
                    />
                </div>
            </div>
            {/* Guardian Info */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Guardian Name</label>
                    <input
                        type="text" value={form.guardianName}
                        onChange={e => setForm({ ...form, guardianName: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                        placeholder="Parent/Guardian name"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Guardian Phone</label>
                    <input
                        type="tel" value={form.guardianPhone}
                        onChange={e => setForm({ ...form, guardianPhone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                        placeholder="Guardian phone"
                    />
                </div>
            </div>
            {/* Email */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email (Optional)</label>
                <input
                    type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    placeholder="student@email.com"
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <Toaster position="top-center" />

            {/* Page Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.history.back()}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors bg-slate-800/50 md:bg-transparent"
                    >
                        <ChevronLeft className="h-5 w-5 text-slate-400" />
                    </button>
                    <div>
                        <h1 className="text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400">
                            Student Database
                        </h1>
                        <p className="text-slate-400 text-xs md:text-sm mt-0.5">{total} students total</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button onClick={() => setShowBulkModal(true)}
                        className="col-span-1 px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 font-bold text-xs md:text-sm hover:bg-purple-600/30 transition-all flex items-center justify-center gap-2">
                        <Upload className="h-3 w-3 md:h-4 md:w-4" />
                        <span className="hidden sm:inline">Bulk Import</span>
                        <span className="sm:hidden">Import</span>
                    </button>
                    <button onClick={() => { resetForm(); setShowAddModal(true); }}
                        className="col-span-1 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                        <Plus className="h-3 w-3 md:h-4 md:w-4" />
                        <span>Add</span>
                    </button>
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text" value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                        placeholder="Search by name or phone..."
                    />
                </div>
                <select
                    value={batchFilter}
                    onChange={e => { setBatchFilter(e.target.value); setPage(1); }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 w-full sm:w-auto min-w-[180px]"
                >
                    <option value="" className="bg-slate-800 text-white">All Batches</option>
                    {batches.map(b => <option key={b} value={b} className="bg-slate-800 text-white">{b}</option>)}
                </select>
            </div>

            {/* Floating Action Bar */}
            {selectedStudents.size > 0 && (
                <div className="bg-blue-600/20 border border-blue-500/30 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-sm text-blue-300 font-bold">
                        {selectedStudents.size} student(s) selected
                    </p>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => {
                            setRenameBatchForm({ oldBatch: '', newBatch: '' });
                            setShowRenameBatchModal(true);
                        }}
                            className="px-3 py-2 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 font-bold text-xs hover:bg-amber-600/30 transition-all flex items-center gap-2">
                            <RefreshCw className="h-3 w-3" />
                            Rename Batch
                        </button>
                        <button onClick={handleBulkDelete}
                            className="px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-300 font-bold text-xs hover:bg-red-600/30 transition-all flex items-center gap-2">
                            <Trash2 className="h-3 w-3" />
                            Delete Selected
                        </button>
                        <button onClick={() => setSelectedStudents(new Set())}
                            className="px-3 py-2 rounded-xl bg-slate-700/50 border border-white/10 text-slate-400 font-bold text-xs hover:bg-slate-700 transition-all">
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* Student Table */}
            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-2 md:px-3 py-3 w-10">
                                    <button onClick={toggleSelectAll} className="p-1 rounded hover:bg-white/10 transition-colors">
                                        {selectedStudents.size === students.length && students.length > 0
                                            ? <CheckSquare className="h-4 w-4 text-blue-400" />
                                            : <Square className="h-4 w-4 text-slate-500" />}
                                    </button>
                                </th>
                                <th className="text-left px-3 md:px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Student</th>
                                <th className="text-left px-3 md:px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                                <th className="text-left px-3 md:px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Batches</th>
                                <th className="text-left px-3 md:px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Guardian</th>
                                <th className="text-right px-3 md:px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    Loading students...
                                </td></tr>
                            ) : students.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    No students found
                                </td></tr>
                            ) : students.map(student => (
                                <tr key={student._id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${selectedStudents.has(student._id) ? 'bg-blue-500/5' : ''}`}>
                                    <td className="px-2 md:px-3 py-3 w-10">
                                        <button onClick={() => toggleStudentSelection(student._id)} className="p-1 rounded hover:bg-white/10 transition-colors">
                                            {selectedStudents.has(student._id)
                                                ? <CheckSquare className="h-4 w-4 text-blue-400" />
                                                : <Square className="h-4 w-4 text-slate-600" />}
                                        </button>
                                    </td>
                                    <td className="px-3 md:px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                {student.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div className="max-w-[120px] sm:max-w-none truncate">
                                                <p className="font-bold text-white truncate">{student.name}</p>
                                                <p className="text-[10px] text-slate-500 sm:hidden">{student.phoneNumber}</p>
                                                {student.email && <p className="text-[10px] text-slate-500 truncate hidden sm:block">{student.email}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 md:px-4 py-3 hidden sm:table-cell">
                                        <div className="flex items-center gap-1.5 text-slate-300">
                                            <Phone className="h-3 w-3 text-slate-500" />
                                            {student.phoneNumber}
                                        </div>
                                    </td>
                                    <td className="px-3 md:px-4 py-3 hidden md:table-cell">
                                        <div className="flex flex-wrap gap-1">
                                            {student.courses.map(c => (
                                                <span key={c} className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 text-[10px] font-semibold border border-blue-500/10">
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 md:px-4 py-3 hidden lg:table-cell">
                                        {student.guardianName ? (
                                            <div className="text-xs">
                                                <div className="flex items-center gap-1 text-slate-300">
                                                    <Shield className="h-3 w-3 text-green-500/60" />
                                                    {student.guardianName}
                                                </div>
                                                {student.guardianPhone && (
                                                    <span className="text-slate-500 text-[10px]">{student.guardianPhone}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 md:px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openEditModal(student)}
                                                className="p-2 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-all" title="Edit">
                                                <Edit3 className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => handleDeleteStudent(student)}
                                                className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all" title="Delete">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Same as before but ensured styling) */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                        <p className="text-xs text-slate-500">
                            {page} / {totalPages}
                        </p>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 disabled:opacity-30 transition-all bg-white/5">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 disabled:opacity-30 transition-all bg-white/5">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Student Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Plus className="h-5 w-5 text-blue-400" /> Add New Student
                            </h2>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-5">
                            {renderFormFields()}
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 font-bold text-sm hover:bg-white/5">Cancel</button>
                                <button onClick={handleAddStudent}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/20">
                                    Add Student
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Student Modal */}
            {showEditModal && editingStudent && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setShowEditModal(false); setEditingStudent(null); }}>
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Edit3 className="h-5 w-5 text-amber-400" /> Edit Student
                            </h2>
                            <button onClick={() => { setShowEditModal(false); setEditingStudent(null); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-5">
                            {renderFormFields()}
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => { setShowEditModal(false); setEditingStudent(null); }}
                                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 font-bold text-sm hover:bg-white/5">Cancel</button>
                                <button onClick={handleEditStudent}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold text-sm hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/20">
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowBulkModal(false)}>
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Upload className="h-5 w-5 text-purple-400" /> Bulk Import Students
                            </h2>
                            <button onClick={() => setShowBulkModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                                <p className="font-bold mb-1">Paste a JSON array of students:</p>
                                <code className="text-[10px] text-slate-400 block mt-1">
                                    {`[{"name": "John", "phoneNumber": "9876543210", "courses": ["Batch A"]}, ...]`}
                                </code>
                                <p className="mt-2 text-slate-400">Each entry must have <strong>name</strong> and <strong>phoneNumber</strong>. Optional: <strong>courses</strong>, <strong>guardianPhone</strong>, <strong>guardianName</strong>, <strong>email</strong></p>
                            </div>
                            <textarea
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                                className="w-full h-52 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                                placeholder='[{"name": "Student Name", "phoneNumber": "9876543210", "courses": ["Batch"]}]'
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setShowBulkModal(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 font-bold text-sm hover:bg-white/5">Cancel</button>
                                <button onClick={handleBulkImport}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-sm hover:from-purple-500 hover:to-violet-500 shadow-lg shadow-purple-500/20">
                                    Import Students
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Batch Modal */}
            {showRenameBatchModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowRenameBatchModal(false)}>
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <RefreshCw className="h-5 w-5 text-amber-400" /> Rename Batch
                            </h2>
                            <button onClick={() => setShowRenameBatchModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                                <p className="font-bold mb-1">This will rename the batch for {selectedStudents.size} selected student(s).</p>
                                <p className="text-slate-400">All existing fee records under the old batch will also be migrated to the new batch name.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Current Batch *</label>
                                <select
                                    value={renameBatchForm.oldBatch}
                                    onChange={e => setRenameBatchForm({ ...renameBatchForm, oldBatch: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500"
                                >
                                    <option value="" className="bg-slate-800 text-white">Select batch to rename...</option>
                                    {getCommonBatches().map(b => (
                                        <option key={b} value={b} className="bg-slate-800 text-white">{b}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Batch Name *</label>
                                <input
                                    type="text" value={renameBatchForm.newBatch}
                                    onChange={e => setRenameBatchForm({ ...renameBatchForm, newBatch: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
                                    placeholder="Enter new batch name"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowRenameBatchModal(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 font-bold text-sm hover:bg-white/5">Cancel</button>
                                <button onClick={handleRenameBatch}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold text-sm hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/20">
                                    Rename Batch
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
