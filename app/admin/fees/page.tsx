'use client';

import { useState, useEffect, useRef } from 'react';
import {
    DollarSign, Search,
    Plus, CheckCircle, User, ChevronDown,
    CreditCard, RefreshCw, Edit2, Save, X, CheckSquare, Square, History, Trash2, Download
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { Suspense } from 'react';

interface Student {
    _id: string;
    name: string;
    phoneNumber: string;
    courses: string[];
    createdAt?: string;
}

type PaymentMode = 'Online' | 'Offline';
type PaymentReceiver = 'MM' | 'RB';

interface FeeRecord {
    _id: string;
    invoiceNo?: string; // Optional now
    student: Student | string;
    batch: string;
    amount: number;
    paymentMode: PaymentMode;
    paymentReceiver?: PaymentReceiver;
    entryDate: string;
    feesMonth: string;
    year: number;
    monthIndex: number;
    remarks?: string;
    createdAt?: string;
    recordType: 'PAYMENT' | 'NEW_ADMISSION' | 'EXEMPTED';
    status?: 'PENDING' | 'EMPTY'; // For grid cell logic if needed
}

const MONTHS = [
    { name: 'Jan', index: 0 }, { name: 'Feb', index: 1 }, { name: 'Mar', index: 2 },
    { name: 'Apr', index: 3 }, { name: 'May', index: 4 }, { name: 'Jun', index: 5 },
    { name: 'Jul', index: 6 }, { name: 'Aug', index: 7 }, { name: 'Sep', index: 8 },
    { name: 'Oct', index: 9 }, { name: 'Nov', index: 10 }, { name: 'Dec', index: 11 }
];

// Helper to generate a range of months
const generateMonthRange = (startYear: number, endYear: number) => {
    const months = [];
    for (let y = startYear; y <= endYear; y++) {
        for (let m = 0; m < 12; m++) {
            months.push({ year: y, monthIndex: m, name: `${MONTHS[m].name} ${y}` });
        }
    }
    return months;
};

export default function FeesManagementPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#050b14] flex items-center justify-center text-white">Loading...</div>}>
            <FeesManagementContent />
        </Suspense>
    );
}

function FeesManagementContent() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<'entry' | 'record' | 'history'>('entry');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'record' || tab === 'entry' || tab === 'history') {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    const [loading, setLoading] = useState(false);

    // Common Data
    const [batches, setBatches] = useState<string[]>([]);

    // Entry State
    const [entrySearch, setEntrySearch] = useState('');
    const [entryStudents, setEntryStudents] = useState<Student[]>([]);
    const [batchStudents, setBatchStudents] = useState<Student[]>([]); // Students for selected batch
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [studentRecords, setStudentRecords] = useState<FeeRecord[]>([]);
    const [selectedMonths, setSelectedMonths] = useState<Date[]>([]);

    // Refs
    const dropdownRef = useRef<HTMLDivElement>(null);
    const gridContainerRef = useRef<HTMLDivElement>(null);



    const [entryForm, setEntryForm] = useState({
        batch: '',
        amount: '',
        mode: 'Offline' as PaymentMode,
        receiver: '' as PaymentReceiver | '',
        paidOnMonth: new Date().toISOString().slice(0, 7),
        remarks: ''
    });

    // Record Grid State
    const [recordFilters, setRecordFilters] = useState({
        batch: '',
        search: ''
    });
    const [allRecords, setAllRecords] = useState<FeeRecord[]>([]);
    const [recordStudents, setRecordStudents] = useState<Student[]>([]);
    const [gridMonths, setGridMonths] = useState(generateMonthRange(new Date().getFullYear() - 1, new Date().getFullYear() + 1)); // Default range: Last year to Next year

    // History State
    const [historyFilters, setHistoryFilters] = useState({
        month: '',
        batch: '',
        search: '',
        mode: '',
        receiver: ''
    });
    const [historyRecords, setHistoryRecords] = useState<FeeRecord[]>([]);

    // Edit Modal
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<FeeRecord | null>(null);
    const [editForm, setEditForm] = useState({
        amount: '',
        remarks: '',
        feesMonth: '', // YYYY-MM
        mode: 'Offline' as PaymentMode,
        receiver: '' as PaymentReceiver | ''
    });

    // Status Selection Modal (New Admission / Exempted)
    const [statusModalOpen, setStatusModalOpen] = useState<{ open: boolean, student: Student, batch: string, year: number, month: number } | null>(null);

    // Cell Actions Modal (Mobile/Desktop)
    const [cellActionModal, setCellActionModal] = useState<{
        open: boolean;
        student: Student;
        batch: string;
        year: number;
        month: number;
        type: 'PENDING' | 'EMPTY';
        monthName: string;
    } | null>(null);

    useEffect(() => {
        if (activeTab === 'record' && gridMonths.length > 0 && gridContainerRef.current) {
            // Small delay to ensure DOM is fully rendered
            const timer = setTimeout(() => {
                const now = new Date();
                const currentId = `month-header-${now.getFullYear()}-${now.getMonth()}`;
                const el = document.getElementById(currentId);
                const isDesktop = window.innerWidth >= 768;

                if (el && gridContainerRef.current) {
                    // Sticky Widths: Mobile = ~100px, Desktop = ~320px
                    // Desktop Request: Scroll less to left (show more past months) -> High offset subtraction (-700)
                    // Mobile Request: Do not affect -> Standard scroll to visible (-110 for sticky col + padding)

                    let targetScroll = 0;

                    if (isDesktop) {
                        targetScroll = Math.max(0, el.offsetLeft - 640);
                    } else {
                        // Mobile: Sticky col is 100px. We want current month clearly visible.
                        // Scroll to element position minus sticky width minus small padding
                        targetScroll = Math.max(0, el.offsetLeft - 110);
                    }

                    console.log(`[GridScroll] ${isDesktop ? 'Desktop' : 'Mobile'} Target: ${targetScroll}, ElLeft: ${el.offsetLeft}, ID: ${currentId}`);

                    gridContainerRef.current.scrollTo({
                        left: targetScroll,
                        behavior: 'smooth'
                    });
                } else {
                    console.warn('[GridScroll] Target element not found:', currentId);
                }
            }, 300);

            return () => clearTimeout(timer);
        }
    }, [activeTab, gridMonths]);

    useEffect(() => {
        fetchBatches();

        // Click Outside Handler
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Data Fetching ---

    const fetchBatches = async () => {
        try {
            console.log('Fetching batches...');
            const res = await fetch('/api/admin/fees/batches');
            if (!res.ok) throw new Error(`Failed to fetch batches: ${res.status}`);
            const data = await res.json();
            console.log('Batches fetched:', data.batches);
            if (data.batches) setBatches(data.batches);
        } catch (e) { console.error('Error fetching batches:', e); }
    };

    const fetchStudents = async (batch?: string, search?: string): Promise<Student[]> => {
        try {
            const params = new URLSearchParams();
            if (batch) params.append('batch', batch);
            if (search) params.append('studentName', search);

            const res = await fetch(`/api/admin/fees/students?${params.toString()}`);
            const data = await res.json();
            return data.students || [];
        } catch (e) {
            console.error(e);
            return [];
        }
    };

    const fetchStudentHistory = async (studentId: string, studentName?: string) => {
        setLoading(true);
        try {
            const nameToSearch = studentName || selectedStudent?.name || '';
            const res = await fetch(`/api/admin/fees?studentName=${encodeURIComponent(nameToSearch)}`);
            const data = await res.json();
            if (data.records) {
                const records = data.records.filter((r: FeeRecord) => {
                    const rId = typeof r.student === 'object' ? (r.student as Student)._id : r.student;
                    // Allow PAYMENT, NEW_ADMISSION, EXEMPTED
                    return rId === studentId && (['PAYMENT', 'NEW_ADMISSION', 'EXEMPTED'].includes(r.recordType) || !r.recordType);
                });
                setStudentRecords(records);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchAllRecords = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (recordFilters.batch) params.append('batch', recordFilters.batch);
            if (recordFilters.search) params.append('studentName', recordFilters.search);
            // Fetch ALL records for the grid timeframe
            // In a real app with infinite scroll, we'd fetch chunks. currently fetching all for simplicity + filter.

            const res = await fetch(`/api/admin/fees?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.records) setAllRecords(data.records);
        } catch (e) { toast.error('Failed to load records'); }
        setLoading(false);
    };

    const fetchRecordStudents = async () => {
        const students = await fetchStudents(recordFilters.batch || undefined, recordFilters.search);
        setRecordStudents(students);
    };

    const fetchHistoryRecords = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (historyFilters.batch) params.append('batch', historyFilters.batch);
            if (historyFilters.mode) params.append('mode', historyFilters.mode);
            if (historyFilters.receiver) params.append('receiver', historyFilters.receiver);
            if (historyFilters.search) params.append('studentName', historyFilters.search);
            if (historyFilters.month) params.append('paymentMonth', historyFilters.month);

            const res = await fetch(`/api/admin/fees?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.records) {
                // Return only payments in history tab
                const paymentsOnly = data.records.filter((r: FeeRecord) =>
                    r.recordType === 'PAYMENT' || !r.recordType
                );
                setHistoryRecords(paymentsOnly);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        if (activeTab === 'record') {
            fetchAllRecords();
            fetchRecordStudents();
            // Scroll to current month on open? Handled by auto-scroll logic in render or separate effect
        } else if (activeTab === 'history') {
            fetchHistoryRecords();
        }
    }, [activeTab, recordFilters, historyFilters]);

    // --- Entry Logic ---

    const handleBatchChange = async (batch: string) => {
        setEntryForm(prev => ({ ...prev, batch, studentId: '' }));
        setSelectedStudent(null);
        setStudentRecords([]);
        setSelectedMonths([]);
        if (batch) {
            const students = await fetchStudents(batch);
            setBatchStudents(students); // Set for the side list
            setEntryStudents(students); // Also set for search dropdown initially? Or strict search?
            // Actually, entryStudents is for the search dropdown. batchStudents is for the new list.
        } else {
            setBatchStudents([]);
            setEntryStudents([]);
        }
    };

    const handleSearch = async (term: string) => {
        setEntrySearch(term);
        setIsDropdownOpen(true);
        console.log('Searching for:', term);

        // 1. If batch is selected and search is cleared, show all batch students
        if (entryForm.batch && term.trim().length === 0) {
            console.log('Search cleared with batch selected, fetching batch students');
            const students = await fetchStudents(entryForm.batch);
            setEntryStudents(students);
            return;
        }

        // 2. Global search (threshold lowered to > 0 to be responsive)
        if (term.trim().length > 0) {
            console.log('Fetching students for term:', term);
            const students = await fetchStudents(undefined, term);
            console.log('Found students:', students.length);
            setEntryStudents(students);
        } else {
            // 3. Search cleared and no batch -> clear list
            setEntryStudents([]);
        }
    };

    const handleStudentSelect = (student: Student, batchName?: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        console.log('Selecting student:', student.name, 'Batch:', batchName);

        if (!student) {
            console.error('No student object passed to handleStudentSelect');
            return;
        }

        setSelectedStudent(student);

        // Auto Select Batch
        // Robust handling: Check if courses exists. If not, default to empty string.
        const courseList = student.courses || [];

        // 1. If batchName is passed, use it.
        // 2. If entryForm.batch is already set AND student is in that batch, keep it.
        // 3. Otherwise, use the first batch in student's list.
        // 4. Fallback to empty.
        let targetBatch = batchName || '';

        if (!targetBatch) {
            if (entryForm.batch && courseList.includes(entryForm.batch)) {
                targetBatch = entryForm.batch;
            } else if (courseList.length > 0) {
                targetBatch = courseList[0];
            }
        }

        console.log('Target Batch:', targetBatch);

        setEntryForm(prev => ({ ...prev, batch: targetBatch }));
        fetchStudentHistory(student._id, student.name);
        setSelectedMonths([]);
        setIsDropdownOpen(false);
        setEntrySearch(student.name); // Set search to selected name
    };

    const toggleMonth = (year: number, monthIndex: number) => {
        // Use UTC noon to avoid timezone shifts when collecting/displaying
        const date = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
        const exists = selectedMonths.find(d => d.getTime() === date.getTime());
        if (exists) {
            setSelectedMonths(prev => prev.filter(d => d.getTime() !== date.getTime()));
        } else {
            setSelectedMonths(prev => [...prev, date].sort((a, b) => a.getTime() - b.getTime()));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent || !entryForm.amount || selectedMonths.length === 0) {
            toast.error('Please select student, amount and at least one month');
            return;
        }

        const toastId = toast.loading('Recording payment...');
        try {
            const [entryYear, entryMonth] = entryForm.paidOnMonth.split('-').map(Number);
            const entryDate = new Date(Date.UTC(entryYear, entryMonth - 1, 1, 12, 0, 0));

            const payload = {
                student: selectedStudent._id,
                batch: entryForm.batch,
                amount: parseFloat(entryForm.amount),
                paymentMode: entryForm.mode,
                paymentReceiver: entryForm.mode === 'Online' ? entryForm.receiver : null,
                entryDate: entryDate, // Paid On Date
                months: selectedMonths.map(d => d.toISOString()), // Fees Months
                remarks: entryForm.remarks
            };

            const res = await fetch('/api/admin/fees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(`Recorded ${data.count} payments!`, { id: toastId });
                fetchStudentHistory(selectedStudent._id, selectedStudent.name);
                setEntryForm(prev => ({
                    ...prev,
                    amount: '',
                    remarks: ''
                }));
                setSelectedMonths([]);
            } else {
                throw new Error('Failed to save');
            }
        } catch (e) {
            toast.error('Error recording fee', { id: toastId });
        }
    };

    // --- Edit/Delete Logic ---

    const openEditModal = (record: FeeRecord) => {
        setEditingRecord(record);
        setEditForm({
            amount: record.amount.toString(),
            remarks: record.remarks || '',
            feesMonth: (() => {
                const d = new Date(record.feesMonth);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                return `${yyyy}-${mm}`;
            })(), // YYYY-MM in Local Time
            mode: record.paymentMode,
            receiver: (record.paymentReceiver as PaymentReceiver) || ''
        });
        setEditModalOpen(true);
    };

    const handleDeleteRecord = async () => {
        if (!editingRecord || !confirm('Are you sure you want to delete this record permanentely?')) return;
        const toastId = toast.loading('Deleting...');
        try {
            const res = await fetch(`/api/admin/fees?id=${editingRecord._id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Deleted', { id: toastId });
                setEditModalOpen(false);
                // Refresh all views
                if (activeTab === 'record') fetchAllRecords();
                if (activeTab === 'history') fetchHistoryRecords();
                if (activeTab === 'entry' && selectedStudent) fetchStudentHistory(selectedStudent._id, selectedStudent.name);
            } else {
                throw new Error('Failed');
            }
        } catch (e) { toast.error('Delete failed', { id: toastId }); }
    };

    const handleUpdateRecord = async () => {
        if (!editingRecord) return;
        const toastId = toast.loading('Updating...');
        try {
            const res = await fetch(`/api/admin/fees/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingRecord._id,
                    amount: parseFloat(editForm.amount),
                    remarks: editForm.remarks,
                    feesMonth: `${editForm.feesMonth}-01T12:00:00.000Z`, // Force UTC Noon to avoid timezone shifts
                    paymentMode: editForm.mode,
                    paymentReceiver: editForm.mode === 'Online' ? editForm.receiver : null
                })
            });
            if (res.ok) {
                toast.success('Updated successfully', { id: toastId });
                setEditModalOpen(false);
                if (activeTab === 'record') fetchAllRecords();
                if (activeTab === 'history') fetchHistoryRecords();
                if (activeTab === 'entry' && selectedStudent) fetchStudentHistory(selectedStudent._id, selectedStudent.name);
            } else {
                throw new Error('Update failed');
            }
        } catch (e) { toast.error('Update failed', { id: toastId }); }
    };

    const handleCreateStatusRecord = async (type: 'NEW_ADMISSION' | 'EXEMPTED') => {
        if (!statusModalOpen) return;
        const { student, batch, year, month } = statusModalOpen;
        const feesMonth = new Date(Date.UTC(year, month, 1, 12, 0, 0));

        try {
            const res = await fetch('/api/admin/fees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student: student._id,
                    batch: batch,
                    amount: 0,
                    paymentMode: 'Offline',
                    entryDate: new Date(),
                    months: [feesMonth.toISOString()],
                    remarks: type,
                    recordType: type
                    // invoiceNo: No invoice for status updates
                })
            });

            if (res.ok) {
                toast.success(`Marked as ${type}`);
                setStatusModalOpen(null);
                fetchAllRecords();
            } else {
                toast.error('Failed');
            }
        } catch (e) { toast.error('Error'); }
    };

    const copyPendingMessage = (student: Student, batch: string, monthName: string) => {
        const msg = `Your fees for the month of *${monthName}* is pending for the *${batch}* at RB Maths Academy. Please clear the pending fees to resume your App login activation as it has become deactivated. After payment send me the screenshot. \n*If Already paid please share the screenshot*.\n- Puja Singh (Manager)\nRB Maths Academy`;
        navigator.clipboard.writeText(msg);
        toast.success('Message copied!');
    };

    const exportHistory = () => {
        if (!historyRecords.length) return;
        const headers = ['Invoice', 'Student', 'Batch', 'Amount', 'Fees Month', 'Paid On', 'Mode', 'Receiver', 'Remarks'];
        const rows = historyRecords.map(r => {
            const sName = typeof r.student === 'object' ? r.student?.name : 'Unknown';
            return [
                r.invoiceNo,
                sName,
                r.batch,
                r.amount,
                new Date(r.feesMonth).toLocaleDateString('default', { month: 'short', year: 'numeric' }),
                new Date(r.entryDate).toLocaleDateString(),
                r.paymentMode,
                r.paymentReceiver || '-',
                r.remarks || ''
            ].map(v => `"${v}"`).join(',');
        }).join('\n');

        const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${rows}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Fees_History_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    return (
        <div className="min-h-screen bg-[#050b14] p-2 md:p-6 text-slate-200 font-sans max-w-[100vw] overflow-x-hidden">
            <Toaster position="top-right" />

            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                    <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-emerald-500" /> Fees Management
                </h1>
                <div className="flex gap-1 md:gap-2 bg-slate-900 rounded-lg p-1 border border-white/10 w-full md:w-auto">
                    <button onClick={() => setActiveTab('entry')} className={`flex-1 md:flex-none px-2 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'entry' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <Plus className="h-3 w-3 md:h-4 md:w-4 inline mr-1" /> Entry
                    </button>
                    <button onClick={() => setActiveTab('record')} className={`flex-1 md:flex-none px-2 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'record' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <CreditCard className="h-3 w-3 md:h-4 md:w-4 inline mr-1" /> Grid
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none px-2 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <History className="h-3 w-3 md:h-4 md:w-4 inline mr-1" /> History
                    </button>
                </div>
            </div>

            {/* ERROR BOUNDARY for Tabs */}
            {activeTab === 'entry' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Find Student</h2>
                            <div className="space-y-4">
                                {/* Custom Searchable Combobox */}
                                <div className="relative group" ref={dropdownRef}>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search Student..."
                                            className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-500"
                                            value={entrySearch}
                                            onChange={(e) => handleSearch(e.target.value)}
                                            onFocus={() => setIsDropdownOpen(true)}
                                        />
                                    </div>
                                    {/* Dropdown Results */}
                                    {isDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1520] border border-white/10 rounded-xl shadow-2xl max-h-[350px] overflow-y-auto z-50 backdrop-blur-xl ring-1 ring-black/50 custom-scrollbar">
                                            {entryStudents.length > 0 ? (
                                                <div className="p-2 space-y-1">
                                                    {entryStudents.map(s => {
                                                        const studentBatches = s.courses && s.courses.length > 0 ? s.courses : ['No Batch'];
                                                        const displayBatches = entryForm.batch
                                                            ? studentBatches.filter(b => b === entryForm.batch)
                                                            : studentBatches;

                                                        if (displayBatches.length === 0) return null;

                                                        return displayBatches.map(batchName => (
                                                            <div
                                                                key={`${s._id}-${batchName}`}
                                                                onClick={(e) => handleStudentSelect(s, batchName, e)}
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/80 cursor-pointer transition-all group/item border border-transparent hover:border-white/5 active:scale-[0.98]"
                                                            >
                                                                {/* Avatar Placeholder */}
                                                                <div className="h-10 w-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-sm font-bold border border-blue-500/30 group-hover/item:bg-blue-600 group-hover/item:text-white transition-colors">
                                                                    {s.name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-semibold text-slate-200 text-sm truncate group-hover/item:text-white transition-colors">
                                                                        {s.name}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                                        <span>{s.phoneNumber}</span>
                                                                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                                        <span className="text-blue-400/80">{batchName}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                    <div className="bg-blue-600 p-1 rounded-full">
                                                                        <Plus className="h-3 w-3 text-white" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ));
                                                    })}
                                                </div>
                                            ) : (
                                                entrySearch.length > 2 && (
                                                    <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500">
                                                        <Search className="h-8 w-8 mb-2 opacity-20" />
                                                        <p className="text-xs font-medium">No students found</p>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Filter by Batch</label>
                                    <div className="relative">
                                        <select
                                            className="w-full appearance-none bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all cursor-pointer"
                                            value={entryForm.batch}
                                            onChange={(e) => handleBatchChange(e.target.value)}
                                        >
                                            <option value="">All Batches</option>
                                            {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                                            <ChevronDown className="h-4 w-4" />
                                        </div>
                                    </div>
                                </div>

                                {/* Batch Student List */}
                                <div className="w-full transition-all duration-300 ease-in-out">
                                    {entryForm.batch && (
                                        <>
                                            <div className="flex items-center justify-between mb-2 px-1">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Students in {entryForm.batch} <span className="text-slate-600">({batchStudents.length})</span>
                                                </div>
                                            </div>

                                            <div className="bg-slate-900/40 border border-white/5 rounded-xl overflow-hidden relative">
                                                <div className="max-h-[350px] md:max-h-[450px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                                                    {batchStudents.length === 0 ? (
                                                        <div className="h-24 flex flex-col items-center justify-center text-slate-500 p-4">
                                                            <User className="h-6 w-6 mb-2 opacity-20" />
                                                            <p className="text-xs">No students in this batch</p>
                                                        </div>
                                                    ) : (
                                                        batchStudents.map(s => {
                                                            const isSelected = selectedStudent?._id === s._id;
                                                            return (
                                                                <div
                                                                    key={s._id}
                                                                    onClick={(e) => handleStudentSelect(s, entryForm.batch, e)}
                                                                    className={`group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border
                                                                        ${isSelected
                                                                            ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-900/20'
                                                                            : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'
                                                                        }`}
                                                                >
                                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                                                                        ${isSelected
                                                                            ? 'bg-blue-600 text-white shadow-md'
                                                                            : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200'
                                                                        }`}>
                                                                        {s.name.substring(0, 2).toUpperCase()}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        <div className={`text-sm font-medium truncate transition-colors ${isSelected ? 'text-blue-400' : 'text-slate-300 group-hover:text-white'}`}>
                                                                            {s.name}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-500 truncate">
                                                                            {s.phoneNumber}
                                                                        </div>
                                                                    </div>

                                                                    {isSelected && (
                                                                        <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        {selectedStudent ? (
                            <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{selectedStudent.name}</h2>
                                        <p className="text-slate-400 text-sm">{selectedStudent.phoneNumber} • {entryForm.batch}</p>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Select Month(s)</label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                        {MONTHS.map((m) => {
                                            const currentGridYear = parseInt(entryForm.paidOnMonth.split('-')[0]) || new Date().getFullYear();
                                            const record = studentRecords.find(r => r.monthIndex === m.index && r.year === currentGridYear);
                                            const isSelected = selectedMonths.some(d => d.getMonth() === m.index && d.getFullYear() === currentGridYear);

                                            const isPaid = !!(record?.recordType === 'PAYMENT' || (!record?.recordType && record));
                                            const isNewAdmission = record?.recordType === 'NEW_ADMISSION';
                                            const isExempted = record?.recordType === 'EXEMPTED';

                                            return (
                                                <button key={m.name} type="button" disabled={isPaid || isNewAdmission || isExempted}
                                                    onClick={() => toggleMonth(currentGridYear, m.index)}
                                                    className={`h-12 rounded-lg border transition-all flex flex-col items-center justify-center relative
                                                       ${isNewAdmission ? 'bg-orange-600 border-orange-400 text-white cursor-not-allowed opacity-100 shadow-md'
                                                            : isExempted ? 'bg-purple-600 border-purple-400 text-white cursor-not-allowed opacity-100 shadow-md'
                                                                : isPaid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 cursor-not-allowed'
                                                                    : isSelected ? 'bg-blue-600 text-white border-blue-500 shadow-lg scale-105'
                                                                        : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'}`}
                                                >
                                                    <span className="text-xs font-bold leading-tight">{m.name}</span>
                                                    {(isNewAdmission || isExempted) && (
                                                        <span className="text-[7px] font-black uppercase opacity-80 leading-none mt-0.5">
                                                            {isNewAdmission ? 'JOINED' : 'EXEMPT'}
                                                        </span>
                                                    )}
                                                    {isSelected && <CheckCircle className="h-3 w-3 absolute top-1 right-1" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Amount (Per Month)</label>
                                        <input type="number" required className="w-full bg-slate-800 border-white/10 rounded-lg p-3 text-lg font-bold text-white"
                                            value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Paid on Month</label>
                                        <input type="month" required className="w-full bg-slate-800 border-white/10 rounded-lg p-3 text-sm text-white"
                                            value={entryForm.paidOnMonth} onChange={(e) => setEntryForm({ ...entryForm, paidOnMonth: e.target.value })} />
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="flex gap-4">
                                        {['Offline', 'Online'].map(mode => (
                                            <label key={mode} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer ${entryForm.mode === mode ? 'bg-slate-800 border-blue-500 text-white' : 'bg-slate-800/50 border-white/5 text-slate-400'}`}>
                                                <input type="radio" name="mode" className="hidden" checked={entryForm.mode === mode} onChange={() => setEntryForm({ ...entryForm, mode: mode as PaymentMode })} />
                                                {mode}
                                            </label>
                                        ))}
                                    </div>
                                    {entryForm.mode === 'Online' && (
                                        <div className="flex gap-4 p-4 bg-slate-800/50 rounded-lg border border-white/5 flex-wrap">
                                            {['MM', 'RB'].map(r => (
                                                <label key={r} className="flex items-center gap-2 cursor-pointer group min-w-[60px]">
                                                    <input type="radio" name="receiver" className="accent-purple-500" checked={entryForm.receiver === r} onChange={() => setEntryForm({ ...entryForm, receiver: r as PaymentReceiver })} />
                                                    <span className="text-sm font-bold group-hover:text-white">{r}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 mb-6">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Remarks</label>
                                    <textarea className="w-full bg-slate-800 border-white/10 rounded-lg p-3 text-sm text-white resize-none" rows={2}
                                        value={entryForm.remarks} onChange={(e) => setEntryForm({ ...entryForm, remarks: e.target.value })} />
                                </div>

                                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all">
                                    {loading ? 'Saving...' : 'Record Payment'}
                                </button>
                            </form>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/30 border border-dashed border-white/10 rounded-2xl p-12">
                                <p>Select a student to begin</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'record' && (
                <div className="space-y-4 h-[calc(100dvh-130px)] md:h-[calc(100vh-100px)] flex flex-col">
                    <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 flex flex-col md:flex-row gap-3 items-stretch md:items-end flex-shrink-0">
                        <div className="space-y-1 w-full md:w-auto">
                            <label className="text-xs font-bold text-slate-500 uppercase">Batch</label>
                            <select className="bg-slate-800 border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full md:w-48" value={recordFilters.batch} onChange={(e) => setRecordFilters({ ...recordFilters, batch: e.target.value })}>
                                <option value="">-- All Batches --</option>
                                {batches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1 flex-1 min-w-[200px]">
                            <label className="text-xs font-bold text-slate-500 uppercase">Search (Phone/Name)</label>
                            <input type="text" placeholder="Search..." className="w-full bg-slate-800 border-white/10 rounded-lg px-4 py-2 text-sm text-white"
                                value={recordFilters.search} onChange={(e) => setRecordFilters({ ...recordFilters, search: e.target.value })} />
                        </div>
                    </div>

                    <div className="bg-slate-900/60 border border-white/10 rounded-xl overflow-hidden flex-1 relative flex flex-col">
                        <div className="flex-1 overflow-auto relative custom-scrollbar" id="grid-container" ref={gridContainerRef}>
                            <table className="w-full text-sm border-collapse relative">
                                <thead className="bg-[#0d1520] sticky top-0 z-30">
                                    <tr className="border-b border-white/10">
                                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-bold text-slate-400 uppercase sticky left-0 bg-[#0d1520] z-40 border-r border-white/10 w-[100px] md:w-[200px] min-w-[100px] md:min-w-[200px] shadow-xl">Student</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase hidden md:table-cell md:sticky md:left-[200px] bg-[#0d1520] z-30 border-r border-white/10 w-[120px] min-w-[120px] shadow-xl">Batch</th>
                                        {gridMonths.map(m => (
                                            <th
                                                key={`${m.year}-${m.monthIndex}`}
                                                id={`month-header-${m.year}-${m.monthIndex}`}
                                                className={`px-1 md:px-2 py-2 md:py-3 text-center border-l border-white/5 font-bold uppercase min-w-[70px] md:min-w-[100px] ${m.year === new Date().getFullYear() && m.monthIndex === new Date().getMonth() ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-400'}`}
                                            >
                                                {m.name.substring(0, 3)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {recordStudents
                                        .filter(s => s.name.toLowerCase().includes(recordFilters.search.toLowerCase()) || s.phoneNumber.includes(recordFilters.search))
                                        .flatMap(student => {
                                            // Normalize courses: If no courses, show 'No Batch' or handle gracefully
                                            const studentBatches = (student.courses && student.courses.length > 0) ? student.courses : [];

                                            // If filtering by batch, only show that batch row
                                            const displayBatches = recordFilters.batch
                                                ? studentBatches.filter(b => b === recordFilters.batch)
                                                : studentBatches;

                                            // If no batch matches filter (and filter exists), return empty
                                            if (recordFilters.batch && displayBatches.length === 0) return [];

                                            // If no batches at all for student, maybe show one row with 'No Batch'?
                                            // For now, only showing actual batches as per request "Student + Batch"
                                            if (displayBatches.length === 0) return [{ student, batch: 'No Batch' }];

                                            // Sort by Batch then Student Name
                                            const feeRowData = displayBatches.map(batch => ({ student, batch }));
                                            return feeRowData;
                                        })
                                        // Explicit Sort: Batch (Asc) -> Name (Asc)
                                        .sort((a, b) => {
                                            const batchA = (a.batch || '').toString().toLowerCase();
                                            const batchB = (b.batch || '').toString().toLowerCase();
                                            if (batchA < batchB) return -1;
                                            if (batchA > batchB) return 1;

                                            // Variable 'student' might be populated differently
                                            const nameA = a.student.name.toLowerCase();
                                            const nameB = b.student.name.toLowerCase();
                                            return nameA.localeCompare(nameB);
                                        })
                                        .map(({ student, batch }) => (
                                            <tr key={`${student._id}-${batch}`} className="hover:bg-white/5 group">
                                                <td className="px-2 md:px-4 py-2 md:py-3 sticky left-0 bg-[#0d1520] group-hover:bg-[#151e2d] border-r border-white/10 z-30">
                                                    <div className="font-medium text-white text-xs md:text-sm truncate w-[90px] md:w-auto">{student.name}</div>
                                                    <div className="text-[9px] md:text-[10px] text-slate-500 truncate md:block hidden">{student.phoneNumber}</div>
                                                </td>
                                                <td className="px-4 py-3 hidden md:table-cell md:sticky md:left-[200px] bg-[#0d1520] group-hover:bg-[#151e2d] border-r border-white/10 z-20">
                                                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">{batch}</span>
                                                </td>
                                                {gridMonths.map(m => {
                                                    const record = allRecords.find(r => {
                                                        const rId = typeof r.student === 'object' ? r.student._id : r.student;
                                                        return String(rId) === String(student._id) &&
                                                            String(r.batch).trim() === String(batch).trim() &&
                                                            r.monthIndex === m.monthIndex &&
                                                            r.year === m.year;
                                                    });

                                                    // Logic for CELL STATUS
                                                    // 1. Is New Admission?
                                                    if (record && record.recordType === 'NEW_ADMISSION') {
                                                        return (
                                                            <td key={`${m.year}-${m.monthIndex}`} onClick={() => openEditModal(record)} className="p-0.5 md:p-1 border-l border-white/5 h-16 md:h-24 cursor-pointer">
                                                                <div className="w-full h-full bg-orange-500 border border-orange-400 text-white rounded flex items-center justify-center text-[8px] md:text-[10px] font-bold uppercase text-center leading-tight shadow-lg hover:bg-orange-400 transition-colors">
                                                                    New<br />Adm
                                                                </div>
                                                            </td>
                                                        );
                                                    }

                                                    // 2. Is Exempted?
                                                    if (record && record.recordType === 'EXEMPTED') {
                                                        return (
                                                            <td key={`${m.year}-${m.monthIndex}`} onClick={() => openEditModal(record)} className="p-0.5 md:p-1 border-l border-white/5 h-16 md:h-24 cursor-pointer">
                                                                <div className="w-full h-full bg-purple-500 border border-purple-400 text-white rounded flex items-center justify-center text-[8px] md:text-[10px] font-bold uppercase shadow-lg hover:bg-purple-400 transition-colors">
                                                                    Exempt
                                                                </div>
                                                            </td>
                                                        );
                                                    }

                                                    // 3. Is Payment?
                                                    if (record) {
                                                        return (
                                                            <td key={`${m.year}-${m.monthIndex}`} className="p-0.5 md:p-1 border-l border-white/5 h-16 md:h-24">
                                                                <div onClick={() => openEditModal(record)} className="w-full h-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded flex flex-col items-center justify-center cursor-pointer relative transition-all">
                                                                    <span className="font-bold text-[10px] md:text-xs">₹{record.amount}</span>
                                                                    <span className="text-[8px] md:text-[9px] opacity-70 leading-none mt-0.5 md:mt-1">{new Date(record.entryDate).toLocaleDateString('default', { day: 'numeric', month: 'short' })}</span>
                                                                    {record.remarks && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                                                                </div>
                                                            </td>
                                                        );
                                                    }

                                                    // 4. Empty Logic (Pending vs Future vs Pre-Admission)
                                                    const cellDate = new Date(m.year, m.monthIndex, 1);
                                                    cellDate.setHours(0, 0, 0, 0);

                                                    const now = new Date();
                                                    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                                                    currentMonthStart.setHours(0, 0, 0, 0);

                                                    // Find New Admission Date for this Student+Batch
                                                    // We look through all records for this student+batch that are NEW_ADMISSION
                                                    const admissionRecord = allRecords.find(r => {
                                                        const rId = typeof r.student === 'object' ? r.student._id : r.student;
                                                        // Robust comparison: stringify IDs and trim batches
                                                        return String(rId) === String(student._id) &&
                                                            r.batch?.trim() === batch?.trim() &&
                                                            r.recordType === 'NEW_ADMISSION';
                                                    });

                                                    // Debug log if we expect an admission record but don't find one for a specific test case (e.g., first student in list)
                                                    // if (m.monthIndex === 0 && student.name.includes('Abhinav')) console.log('Checking Admission for', student.name, batch, admissionRecord);

                                                    let admissionDate = null;
                                                    if (admissionRecord) {
                                                        admissionDate = new Date(admissionRecord.feesMonth);
                                                        admissionDate.setHours(0, 0, 0, 0);
                                                    }

                                                    // PENDING if:
                                                    // - Date < Current Month
                                                    // - Date >= Admission Date (if exists)
                                                    // - OR Date >= Default Date (if no admission record, assume pending for all past? As per requirement: "any empty grid of present month and months prior... should be red")

                                                    let isPending = false;
                                                    if (cellDate <= currentMonthStart) {
                                                        if (admissionDate) {
                                                            // ONLY pending if cell is ON or AFTER admission date
                                                            isPending = cellDate >= admissionDate;
                                                        } else {
                                                            // IF NO admission date found, we mark as pending by default
                                                            // BUT if the user wants it to NOT be red before admission, they MUST set an admission month.
                                                            isPending = true;
                                                        }
                                                    }

                                                    if (isPending) {
                                                        return (
                                                            <td key={`${m.year}-${m.monthIndex}`} className="p-0.5 md:p-1 border-l border-white/5 h-16 md:h-24 relative" onClick={() => setCellActionModal({ open: true, student, batch, year: m.year, month: m.monthIndex, type: 'PENDING', monthName: m.name })}>
                                                                <div className="w-full h-full bg-red-500/10 border border-red-500/20 rounded flex items-center justify-center cursor-pointer hover:bg-red-500/20 active:scale-95 transition-all">
                                                                    <span className="text-[8px] md:text-[10px] font-bold text-red-500 uppercase tracking-wider">Pending</span>
                                                                </div>
                                                            </td>
                                                        );
                                                    }

                                                    // Future / Pre-Admission (Empty)
                                                    return (
                                                        <td key={`${m.year}-${m.monthIndex}`} className="p-0.5 md:p-1 border-l border-white/5 h-16 md:h-24 relative" onClick={() => setCellActionModal({ open: true, student, batch, year: m.year, month: m.monthIndex, type: 'EMPTY', monthName: m.name })}>
                                                            <div className="w-full h-full rounded hover:bg-white/5 flex items-center justify-center text-slate-700 text-xs cursor-pointer active:scale-95 transition-all">
                                                                -
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Modal */}
            {statusModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm" onClick={() => setStatusModalOpen(null)}>
                    <div className="bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in-0 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6 sm:hidden" />
                        <h3 className="text-lg font-bold text-white mb-4">Set Status for {MONTHS[statusModalOpen.month].name} {statusModalOpen.year}</h3>
                        <div className="space-y-3">
                            <button onClick={() => handleCreateStatusRecord('NEW_ADMISSION')} className="w-full py-3 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border border-yellow-500/50 rounded-xl font-bold transition-all">
                                Mark as New Admission
                                <span className="block text-xs font-normal opacity-70 mt-1">Starts fees from this month</span>
                            </button>
                            <button onClick={() => handleCreateStatusRecord('EXEMPTED')} className="w-full py-3 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/50 rounded-xl font-bold transition-all">
                                Mark as Exempted
                                <span className="block text-xs font-normal opacity-70 mt-1">No fees required for this month</span>
                            </button>
                            <button onClick={() => setStatusModalOpen(null)} className="w-full py-3 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-xl font-medium">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-6">
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex flex-col md:flex-row flex-wrap gap-4 items-stretch md:items-end">
                        <div className="grid grid-cols-2 md:flex gap-4 w-full md:w-auto">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Fees Month</label>
                                <input type="month" className="bg-slate-800 border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full"
                                    value={historyFilters.month} onChange={(e) => setHistoryFilters({ ...historyFilters, month: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Batch</label>
                                <select className="bg-slate-800 border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full md:w-32" value={historyFilters.batch} onChange={(e) => setHistoryFilters({ ...historyFilters, batch: e.target.value })}>
                                    <option value="">All</option>
                                    {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:flex gap-4 w-full md:w-auto">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Mode</label>
                                <select className="bg-slate-800 border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full" value={historyFilters.mode} onChange={(e) => setHistoryFilters({ ...historyFilters, mode: e.target.value })}>
                                    <option value="">All</option>
                                    <option value="Online">Online</option>
                                    <option value="Offline">Offline</option>
                                </select>
                            </div>
                            {historyFilters.mode === 'Online' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Receiver</label>
                                    <select className="bg-slate-800 border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full" value={historyFilters.receiver} onChange={(e) => setHistoryFilters({ ...historyFilters, receiver: e.target.value })}>
                                        <option value="">All</option>
                                        <option value="MM">MM</option>
                                        <option value="RB">RB</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1 flex-1 min-w-[200px]">
                            <label className="text-xs font-bold text-slate-500 uppercase">Search</label>
                            <input type="text" placeholder="Student Name/Phone..." className="w-full bg-slate-800 border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                value={historyFilters.search} onChange={(e) => setHistoryFilters({ ...historyFilters, search: e.target.value })} />
                        </div>
                        <button onClick={exportHistory} className="px-4 py-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 w-full md:w-auto">
                            <Download className="h-4 w-4" /> Export CSV
                        </button>
                    </div>

                    <div className="bg-slate-900/60 border border-white/10 rounded-xl overflow-x-auto">
                        <table className="w-full text-sm text-left hidden md:table">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-3">Invoice</th>
                                    <th className="px-6 py-3">Student</th>
                                    <th className="px-6 py-3">Batch</th>
                                    <th className="px-6 py-3">Paid For</th>
                                    <th className="px-6 py-3">Paid On</th>
                                    <th className="px-6 py-3">Mode</th>
                                    <th className="px-6 py-3">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {historyRecords.map((record) => (
                                    <tr key={record._id} onClick={() => openEditModal(record)} className="hover:bg-white/5 cursor-pointer">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{record.invoiceNo}</td>
                                        <td className="px-6 py-4 font-medium text-white">
                                            {typeof record.student === 'object' ? record.student?.name : 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">{record.batch}</td>
                                        <td className="px-6 py-4 text-white">
                                            {new Date(record.feesMonth).toLocaleDateString('default', { month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 text-xs">
                                            {new Date(record.entryDate).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${record.paymentMode === 'Online' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-700 text-slate-300'}`}>
                                                {record.paymentMode} {record.paymentReceiver ? `(${record.paymentReceiver})` : ''}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-emerald-400">₹{record.amount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile Card View for History */}
                        <div className="md:hidden space-y-4 p-4">
                            {historyRecords.map((record) => (
                                <div key={record._id} onClick={() => openEditModal(record)} className="bg-slate-800/50 border border-white/5 rounded-xl p-4 space-y-3 cursor-pointer active:scale-98 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-white text-base">
                                                {typeof record.student === 'object' ? record.student?.name : 'Unknown'}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5">{record.batch}</div>
                                        </div>
                                        <div className="text-emerald-400 font-bold text-lg">₹{record.amount}</div>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-slate-500 border-t border-white/5 pt-3">
                                        <div className="bg-slate-900 px-2 py-1 rounded font-mono text-slate-400">
                                            {record.invoiceNo}
                                        </div>
                                        <div className="flex-1 text-right">
                                            {new Date(record.entryDate).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-xs">
                                        <div className="text-slate-300">
                                            For <span className="text-white font-medium">{new Date(record.feesMonth).toLocaleDateString('default', { month: 'long', year: 'numeric' })}</span>
                                        </div>
                                        <span className={`px-2 py-1 rounded ${record.paymentMode === 'Online' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-700 text-slate-300'}`}>
                                            {record.paymentMode} {record.paymentReceiver ? `(${record.paymentReceiver})` : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}



            {editModalOpen && editingRecord && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Edit2 className="h-5 w-5 text-blue-400" /> Edit Record</h3>
                            <button onClick={() => setEditModalOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
                        </div>

                        {/* Invoice No at top */}
                        <div className="text-center mb-6 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                            <span className="text-xs text-slate-500 uppercase tracking-widest block mb-1">Invoice Number</span>
                            <span className="text-xl font-mono font-bold text-white tracking-widest">{editingRecord.invoiceNo}</span>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Amount</label>
                                    <input type="number" className="w-full bg-slate-800 border-white/10 rounded-lg p-3 text-white font-bold" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Fees Month</label>
                                    <input type="month" className="w-full bg-slate-800 border-white/10 rounded-lg p-3 text-white text-sm" value={editForm.feesMonth} onChange={(e) => setEditForm({ ...editForm, feesMonth: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Payment Mode</label>
                                <div className="flex gap-2">
                                    {['Offline', 'Online'].map(mode => (
                                        <label key={mode} className={`flex-1 text-center py-2 rounded cursor-pointer text-xs font-bold border transition-all ${editForm.mode === mode ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                                            <input type="radio" className="hidden" checked={editForm.mode === mode} onChange={() => setEditForm({ ...editForm, mode: mode as PaymentMode })} />
                                            {mode}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {editForm.mode === 'Online' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Receiver</label>
                                    <div className="flex gap-2">
                                        {['MM', 'RB'].map(r => (
                                            <label key={r} className={`flex-1 text-center py-2 rounded cursor-pointer text-xs font-bold border transition-all ${editForm.receiver === r ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                                                <input type="radio" className="hidden" checked={editForm.receiver === r} onChange={() => setEditForm({ ...editForm, receiver: r as PaymentReceiver })} />
                                                {r}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Remarks</label>
                                <textarea className="w-full bg-slate-800 border-white/10 rounded-lg p-3 text-white h-20 resize-none" value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} />
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-white/5">
                                <button onClick={handleDeleteRecord} className="px-4 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete</button>
                                <button onClick={handleUpdateRecord} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Save className="h-4 w-4" /> Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editModalOpen && editingRecord && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setEditModalOpen(false)}>
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm md:max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

                        <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center shrink-0">
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2"><Edit2 className="h-4 w-4 md:h-5 md:w-5 text-blue-400" /> Edit Record</h3>
                            <button onClick={() => setEditModalOpen(false)} className="p-1 hover:bg-white/5 rounded-full transition-colors"><X className="h-5 w-5 text-slate-400" /></button>
                        </div>

                        <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar">
                            {/* Invoice No at top */}
                            <div className="text-center mb-4 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Invoice Number</span>
                                <span className="text-lg md:text-xl font-mono font-bold text-white tracking-widest">{editingRecord.invoiceNo}</span>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Amount</label>
                                        <input type="number" className="w-full bg-slate-800 border-white/10 rounded-lg p-2.5 text-white font-bold text-sm" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Fees Month</label>
                                        <input type="month" className="w-full bg-slate-800 border-white/10 rounded-lg p-2.5 text-white text-xs md:text-sm" value={editForm.feesMonth} onChange={(e) => setEditForm({ ...editForm, feesMonth: e.target.value })} />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Mode</label>
                                    <div className="flex gap-2">
                                        {['Offline', 'Online'].map(mode => (
                                            <label key={mode} className={`flex-1 text-center py-2 rounded-lg cursor-pointer text-xs font-bold border transition-all ${editForm.mode === mode ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                                                <input type="radio" className="hidden" checked={editForm.mode === mode} onChange={() => setEditForm({ ...editForm, mode: mode as PaymentMode })} />
                                                {mode}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {editForm.mode === 'Online' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Receiver</label>
                                        <div className="flex gap-2">
                                            {['MM', 'RB'].map(r => (
                                                <label key={r} className={`flex-1 text-center py-2 rounded-lg cursor-pointer text-xs font-bold border transition-all ${editForm.receiver === r ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                                                    <input type="radio" className="hidden" checked={editForm.receiver === r} onChange={() => setEditForm({ ...editForm, receiver: r as PaymentReceiver })} />
                                                    {r}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Remarks</label>
                                    <textarea className="w-full bg-slate-800 border-white/10 rounded-lg p-2.5 text-white text-sm h-16 resize-none" value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 md:p-6 border-t border-white/5 shrink-0 flex gap-3">
                            <button onClick={handleDeleteRecord} className="px-3 md:px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold text-xs md:text-sm flex items-center gap-2 transition-colors"><Trash2 className="h-4 w-4" /> Delete</button>
                            <button onClick={handleUpdateRecord} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs md:text-sm flex items-center justify-center gap-2 transition-colors"><Save className="h-4 w-4" /> Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cell Actions Modal */}
            {cellActionModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm" onClick={() => setCellActionModal(null)}>
                    <div className="bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in-0 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6 sm:hidden" />

                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-white leading-tight">Actions</h3>
                            <p className="text-sm text-slate-400">
                                {cellActionModal.student.name} • {cellActionModal.monthName}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {cellActionModal.type === 'PENDING' && (
                                <>
                                    <button onClick={() => {
                                        navigator.clipboard.writeText(cellActionModal.student.phoneNumber);
                                        toast.success('Phone Copied!');
                                        setCellActionModal(null);
                                    }} className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium flex items-center gap-3 transition-colors">
                                        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><User className="h-4 w-4" /></div>
                                        Copy Phone Number
                                    </button>

                                    <button onClick={() => {
                                        copyPendingMessage(cellActionModal.student, cellActionModal.batch, cellActionModal.monthName);
                                        setCellActionModal(null);
                                    }} className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium flex items-center gap-3 transition-colors">
                                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><RefreshCw className="h-4 w-4" /></div>
                                        Copy Reminder Message
                                    </button>
                                </>
                            )}

                            <button onClick={() => {
                                setStatusModalOpen({
                                    open: true,
                                    student: cellActionModal.student,
                                    batch: cellActionModal.batch,
                                    year: cellActionModal.year,
                                    month: cellActionModal.month
                                });
                                setCellActionModal(null);
                            }} className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium flex items-center gap-3 transition-colors">
                                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><Edit2 className="h-4 w-4" /></div>
                                Set Status (Admission/Exempt)
                            </button>

                            <button onClick={() => setCellActionModal(null)} className="w-full py-3.5 text-slate-500 font-medium hover:text-white transition-colors mt-2">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
