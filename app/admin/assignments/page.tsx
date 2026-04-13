
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye, Trash2, FileText, List, Clock, AlertTriangle, CheckCircle, File, Folder, FolderPlus, ArrowLeft, ArrowUpRight, ClipboardEdit, Save, X, Edit3, ChevronDown, ChevronUp, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast, Toaster } from 'react-hot-toast';

interface Assignment {
    _id: string;
    title: string;
    type: 'PDF' | 'QUESTIONS';
    batch: string;
    deadline: string;
    submissionCount: number;
    lateCount: number;
    missedCount: number;
    totalStudents: number;
    createdAt: string;
    folderId?: string;
}

interface AssignmentFolder {
    _id: string;
    name: string;
    createdAt: string;
}

interface OfflineExam {
    _id: string;
    batch: string;
    chapterName: string;
    testDate: string;
    fullMarks: number;
    results: Array<{
        studentId: string;
        studentPhone: string;
        studentName: string;
        marksObtained: number;
        percentage: number;
    }>;
}

interface StudentForMarks {
    _id: string;
    name: string;
    phoneNumber: string;
    marks: string;
}

export default function AdminAssignmentsPage() {
    const router = useRouter();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [folders, setFolders] = useState<AssignmentFolder[]>([]);
    const [currentFolder, setCurrentFolder] = useState<AssignmentFolder | null>(null);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [assignmentToMove, setAssignmentToMove] = useState<Assignment | null>(null);

    // Offline Exam State
    const [showOfflineModal, setShowOfflineModal] = useState(false);
    const [offlineBatches, setOfflineBatches] = useState<string[]>([]);
    const [offlineSelectedBatch, setOfflineSelectedBatch] = useState('');
    const [offlineStudents, setOfflineStudents] = useState<StudentForMarks[]>([]);
    const [offlineChapter, setOfflineChapter] = useState('');
    const [offlineTestDate, setOfflineTestDate] = useState('');
    const [offlineFullMarks, setOfflineFullMarks] = useState('');
    const [offlineLoading, setOfflineLoading] = useState(false);
    const [offlineSaving, setOfflineSaving] = useState(false);
    const [offlineExams, setOfflineExams] = useState<OfflineExam[]>([]);
    const [showOfflineExams, setShowOfflineExams] = useState(false);
    const [editingExam, setEditingExam] = useState<OfflineExam | null>(null);
    const [editStudents, setEditStudents] = useState<StudentForMarks[]>([]);
    const [editChapter, setEditChapter] = useState('');
    const [editTestDate, setEditTestDate] = useState('');
    const [editFullMarks, setEditFullMarks] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    useEffect(() => {
        fetchData();
        fetchOfflineExams();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/admin/assignments');
            const data = await res.json();
            if (data.assignments) {
                setAssignments(data.assignments);
                setFolders(data.folders || []);
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchOfflineExams = async () => {
        try {
            const res = await fetch('/api/admin/offline-exams');
            const data = await res.json();
            if (data.exams) setOfflineExams(data.exams);
        } catch { }
    };

    const openOfflineModal = async () => {
        setShowOfflineModal(true);
        setOfflineSelectedBatch('');
        setOfflineStudents([]);
        setOfflineChapter('');
        setOfflineTestDate('');
        setOfflineFullMarks('');
        try {
            const res = await fetch('/api/admin/courses');
            const data = await res.json();
            if (Array.isArray(data)) setOfflineBatches(data);
        } catch {
            toast.error('Failed to load batches');
        }
    };

    const loadStudentsForBatch = async (batch: string) => {
        setOfflineSelectedBatch(batch);
        if (!batch) { setOfflineStudents([]); return; }
        setOfflineLoading(true);
        try {
            const res = await fetch(`/api/admin/students?batch=${encodeURIComponent(batch)}&limit=500`);
            const data = await res.json();
            if (data.students) {
                const sorted = data.students.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
                setOfflineStudents(sorted.map((s: any) => ({ _id: s._id, name: s.name, phoneNumber: s.phoneNumber, marks: '' })));
            }
        } catch {
            toast.error('Failed to load students');
        } finally {
            setOfflineLoading(false);
        }
    };

    const handleOfflineMarksChange = (index: number, value: string) => {
        const updated = [...offlineStudents];
        updated[index].marks = value;
        setOfflineStudents(updated);
    };

    const handleSaveOfflineExam = async () => {
        if (!offlineSelectedBatch || !offlineChapter.trim() || !offlineTestDate || !offlineFullMarks) {
            toast.error('Please fill in all fields'); return;
        }
        const fm = parseFloat(offlineFullMarks);
        if (isNaN(fm) || fm <= 0) { toast.error('Invalid full marks'); return; }

        const results = offlineStudents
            .filter(s => s.marks.trim() !== '')
            .map(s => {
                const numericMarks = parseFloat(s.marks);
                const isNumeric = !isNaN(numericMarks) && typeof s.marks !== 'string' || (typeof s.marks === 'string' && !isNaN(Number(s.marks)));
                if (isNumeric) {
                    if (numericMarks < 0 || numericMarks > fm) return null;
                    return {
                        studentId: s._id,
                        studentPhone: s.phoneNumber,
                        studentName: s.name,
                        marksObtained: numericMarks,
                        percentage: parseFloat(((numericMarks / fm) * 100).toFixed(2))
                    };
                } else {
                    return {
                        studentId: s._id,
                        studentPhone: s.phoneNumber,
                        studentName: s.name,
                        marksObtained: s.marks.trim(),
                        percentage: s.marks.trim()
                    };
                }
            }).filter(Boolean);

        if (results.length === 0) { toast.error('Enter marks for at least one student'); return; }

        setOfflineSaving(true);
        try {
            const res = await fetch('/api/admin/offline-exams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batch: offlineSelectedBatch,
                    chapterName: offlineChapter.trim(),
                    testDate: offlineTestDate,
                    fullMarks: fm,
                    results
                })
            });
            if (res.ok) {
                toast.success('Offline exam saved!');
                setShowOfflineModal(false);
                fetchOfflineExams();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save');
            }
        } catch {
            toast.error('Error saving offline exam');
        } finally {
            setOfflineSaving(false);
        }
    };

    const startEditExam = async (exam: OfflineExam) => {
        setEditingExam(exam);
        setEditChapter(exam.chapterName);
        setEditTestDate(exam.testDate.split('T')[0]);
        setEditFullMarks(exam.fullMarks.toString());
        setEditStudents([]); // Clear while loading

        try {
            const res = await fetch(`/api/admin/students?batch=${encodeURIComponent(exam.batch)}&limit=500`);
            const data = await res.json();
            if (data.students) {
                const merged = data.students.map((s: any) => {
                    const existing = exam.results.find(r => r.studentId === s._id);
                    return {
                        _id: s._id,
                        name: s.name,
                        phoneNumber: s.phoneNumber,
                        marks: existing ? existing.marksObtained.toString() : ''
                    };
                });
                const sorted = merged.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
                setEditStudents(sorted);
                return;
            }
        } catch {}

        setEditStudents(exam.results.map(r => ({
            _id: r.studentId,
            name: r.studentName,
            phoneNumber: r.studentPhone,
            marks: r.marksObtained.toString()
        })));
    };

    const handleEditMarksChange = (index: number, value: string) => {
        const updated = [...editStudents];
        updated[index].marks = value;
        setEditStudents(updated);
    };

    const handleUpdateExam = async () => {
        if (!editingExam || !editChapter.trim() || !editTestDate || !editFullMarks) {
            toast.error('Please fill in all fields'); return;
        }
        const fm = parseFloat(editFullMarks);
        if (isNaN(fm) || fm <= 0) { toast.error('Invalid full marks'); return; }

        const results = editStudents
            .filter(s => s.marks.trim() !== '')
            .map(s => {
                const numericMarks = parseFloat(s.marks);
                const isNumeric = !isNaN(numericMarks) && typeof s.marks !== 'string' || (typeof s.marks === 'string' && !isNaN(Number(s.marks)));
                if (isNumeric) {
                    if (numericMarks < 0 || numericMarks > fm) return null;
                    return {
                        studentId: s._id,
                        studentPhone: s.phoneNumber,
                        studentName: s.name,
                        marksObtained: numericMarks,
                        percentage: parseFloat(((numericMarks / fm) * 100).toFixed(2))
                    };
                } else {
                    return {
                        studentId: s._id,
                        studentPhone: s.phoneNumber,
                        studentName: s.name,
                        marksObtained: s.marks.trim(),
                        percentage: s.marks.trim()
                    };
                }
            }).filter(Boolean);

        setEditSaving(true);
        try {
            const res = await fetch(`/api/admin/offline-exams/${editingExam._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chapterName: editChapter.trim(),
                    testDate: editTestDate,
                    fullMarks: fm,
                    results
                })
            });
            if (res.ok) {
                toast.success('Exam updated!');
                setEditingExam(null);
                fetchOfflineExams();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to update');
            }
        } catch {
            toast.error('Error updating exam');
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeleteExam = async (id: string) => {
        if (!confirm('Delete this offline exam record?')) return;
        try {
            const res = await fetch(`/api/admin/offline-exams/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Deleted');
                fetchOfflineExams();
                if (editingExam?._id === id) setEditingExam(null);
            } else { toast.error('Failed to delete'); }
        } catch { toast.error('Error deleting'); }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const res = await fetch('/api/admin/assignments/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newFolderName })
            });
            const data = await res.json();
            if (res.ok) {
                setFolders([data.folder, ...folders]);
                setShowCreateFolder(false);
                setNewFolderName('');
                toast.success('Folder created');
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error('Failed to create folder');
        }
    };

    const handleMoveAssignment = async (folderId: string | null) => {
        if (!assignmentToMove) return;
        try {
            const res = await fetch(`/api/admin/assignments/${assignmentToMove._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderId })
            });

            if (res.ok) {
                setAssignments(assignments.map(a =>
                    a._id === assignmentToMove._id ? { ...a, folderId: folderId || undefined } : a
                ));
                setShowMoveModal(false);
                setAssignmentToMove(null);
                toast.success('Assignment moved');
                // If moving out of current view, maybe refresh? No, state update handles it.
            } else {
                toast.error('Failed to move');
            }
        } catch (error) {
            toast.error('Error moving assignment');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this assignment? All submissions will be lost.')) return;
        try {
            const res = await fetch(`/api/admin/assignments/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Assignment deleted');
                setAssignments(assignments.filter(a => a._id !== id));
            } else {
                toast.error('Failed to delete');
            }
        } catch (error) {
            toast.error('Error deleting assignment');
        }
    };

    const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure? Assignments inside will be moved to the root.')) return;
        try {
            const res = await fetch(`/api/admin/assignments/folders/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Folder deleted');
                setFolders(folders.filter(f => f._id !== id));
                // If we were inside the folder (unlikely given UI logic), go back
                if (currentFolder?._id === id) setCurrentFolder(null);
            } else {
                toast.error('Failed to delete folder');
            }
        } catch (error) {
            toast.error('Error deleting folder');
        }
    };

    const handleDownloadPDF = () => {
        if (!editingExam) return;

        const doc = new jsPDF();

        // Header
        doc.setFillColor(30, 58, 138); // Blue
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("RB Maths Academy", 105, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.text("Offline Exam Marksheet", 105, 32, { align: 'center' });

        // Details
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text(`Chapter: ${editChapter}`, 14, 52);
        doc.text(`Exam Date: ${new Date(editTestDate).toLocaleDateString('en-IN')}`, 14, 60);
        doc.text(`Full Marks: ${editFullMarks}`, 14, 68);

        // Process Data
        const fullMarks = parseFloat(editFullMarks) || 0;

        const validStudents: any[] = [];
        const naStudents: any[] = [];

        editStudents.forEach(s => {
            if (s.marks.trim() === '') {
                naStudents.push(s);
            } else {
                validStudents.push({ ...s, numericMarks: parseFloat(s.marks) });
            }
        });

        // Sort descending
        validStudents.sort((a, b) => b.numericMarks - a.numericMarks);

        const tableBody: any[] = [];

        validStudents.forEach((s, index) => {
            let rankStr = `${index + 1}`;
            if (index === 0) rankStr += ' 1st';
            else if (index === 1) rankStr += ' 2nd';
            else if (index === 2) rankStr += ' 3rd';

            const pct = fullMarks > 0 ? ((s.numericMarks / fullMarks) * 100).toFixed(1) + '%' : '-';

            tableBody.push([
                rankStr,
                s.name,
                `${s.numericMarks}`,
                pct
            ]);
        });

        naStudents.forEach(s => {
            tableBody.push([
                '-',
                s.name,
                'Not applicable',
                '-'
            ]);
        });

        // Define options properly for jspdf-autotable
        autoTable(doc, {
            startY: 75,
            head: [['Rank', 'Student Name', 'Marks Obtained', 'Percentage']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold', halign: 'center' }, // Orange head
            columnStyles: {
                0: { halign: 'center', fontStyle: 'bold' },
                1: { fontStyle: 'bold' },
                2: { halign: 'center' },
                3: { halign: 'center', fontStyle: 'bold' } 
            },
            alternateRowStyles: { fillColor: [255, 247, 237] }, // Light orange
            styles: { font: 'helvetica', fontSize: 10, cellPadding: 4, textColor: [30, 30, 30] }, // fallback text color
            didParseCell: function(data) {
                if (data.section === 'body') {
                    if (data.column.index === 0) {
                        if (data.cell.raw && data.cell.raw.toString().includes('1st')) {
                            data.cell.styles.fillColor = [255, 215, 0]; // Gold fill for 1st
                        } else if (data.cell.raw && data.cell.raw.toString().includes('2nd')) {
                            data.cell.styles.fillColor = [224, 224, 224]; // Silver fill for 2nd
                        } else if (data.cell.raw && data.cell.raw.toString().includes('3rd')) {
                            data.cell.styles.fillColor = [205, 127, 50]; // Bronze fill for 3rd
                        }
                    }
                    if (data.column.index === 3 && data.cell.raw !== '-') {
                         data.cell.styles.textColor = [21, 128, 61]; // green text
                    }
                }
            }
        });

        doc.save(`${editChapter.replace(/\\s+/g, '_')}_Marksheet.pdf`);
    };

    // Filter Logic
    const displayedAssignments = assignments.filter(a => {
        if (currentFolder) return a.folderId === currentFolder._id;
        return !a.folderId; // Root level assignments
    });

    const displayedFolders = currentFolder ? [] : folders;

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto text-gray-200">
            <Toaster />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        {currentFolder && (
                            <button
                                onClick={() => setCurrentFolder(null)}
                                className="text-gray-400 hover:text-white flex items-center gap-1 text-sm bg-white/5 px-2 py-1 rounded hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                        )}
                        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                            {currentFolder ? (
                                <>
                                    <Folder className="w-8 h-8 text-blue-400" />
                                    {currentFolder.name}
                                </>
                            ) : 'Assignments'}
                        </h1>
                    </div>
                </div>
                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
                    <button
                        onClick={openOfflineModal}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-red-900/20 text-sm sm:text-base flex-1 sm:flex-none justify-center"
                    >
                        <ClipboardEdit className="w-4 h-4 sm:w-5 sm:h-5" />
                        Record Offline Exam
                    </button>
                    {!currentFolder && (
                        <button
                            onClick={() => setShowCreateFolder(true)}
                            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#1a1f2e] border border-white/10 hover:border-blue-500/50 hover:text-blue-400 rounded-lg transition-all text-sm sm:text-base flex-1 sm:flex-none justify-center"
                        >
                            <FolderPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                            New Folder
                        </button>
                    )}
                    <button
                        onClick={() => router.push('/admin/assignments/create')}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-blue-900/20 text-sm sm:text-base flex-1 sm:flex-none justify-center"
                    >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                        Create
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Folders List (Only at root) */}
                    {displayedFolders.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            {displayedFolders.map(folder => (
                                <div
                                    key={folder._id}
                                    onClick={() => setCurrentFolder(folder)}
                                    className="bg-[#1a1f2e] border border-white/5 p-3 sm:p-4 rounded-xl cursor-pointer hover:border-blue-500/30 hover:bg-white/5 transition-all group flex items-center gap-3"
                                >
                                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 group-hover:scale-105 transition-all">
                                        <Folder className="w-6 h-6 fill-current" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-200 group-hover:text-white truncate">{folder.name}</h3>
                                        <p className="text-xs text-gray-500">{assignments.filter(a => a.folderId === folder._id).length} items</p>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteFolder(e, folder._id)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Delete Folder"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Assignments List */}
                    {displayedAssignments.length === 0 && displayedFolders.length === 0 ? (
                        <div className="text-center py-12 bg-[#1a1f2e] rounded-xl border border-white/5">
                            <FileText className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                            <h3 className="text-xl font-medium text-gray-300">No content found</h3>
                            <p className="text-gray-500 mt-2">
                                {currentFolder ? 'This folder is empty' : 'Create assignments or folders to get started'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {displayedAssignments.map((assignment) => {
                                const deadline = new Date(assignment.deadline);
                                const isExpired = new Date() > deadline;

                                return (
                                    <div key={assignment._id} className="bg-[#1a1f2e] border border-white/5 rounded-xl p-4 sm:p-6 hover:border-blue-500/30 transition-all group relative">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                            <div className="space-y-2 min-w-0 flex-1">
                                                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                                    {assignment.type === 'PDF' ?
                                                        <File className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" /> :
                                                        <List className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />
                                                    }
                                                    <h3 className="text-base sm:text-xl font-semibold text-white group-hover:text-blue-400 transition-colors break-words">
                                                        {assignment.title}
                                                    </h3>
                                                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        {assignment.batch}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-400">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                        <span className={isExpired ? 'text-red-400' : 'text-green-400'}>
                                                            {deadline.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })} {deadline.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                                                        <span>{assignment.submissionCount - assignment.lateCount} Submitted</span>
                                                    </div>
                                                    {assignment.lateCount > 0 && (
                                                        <div className="flex items-center gap-1.5 text-orange-400">
                                                            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                            <span>{assignment.lateCount} Late</span>
                                                        </div>
                                                    )}
                                                    {assignment.missedCount > 0 && (
                                                        <div className="flex items-center gap-1.5 text-red-400">
                                                            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                            <span>{assignment.missedCount} Missed</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 sm:gap-2 self-end sm:self-start">
                                                <button
                                                    onClick={() => { setAssignmentToMove(assignment); setShowMoveModal(true); }}
                                                    className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-yellow-400 transition-colors"
                                                    title="Move to Folder"
                                                >
                                                    <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <button
                                                    onClick={() => router.push(`/admin/assignments/${assignment._id}`)}
                                                    className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(assignment._id)}
                                                    className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Create Folder Modal */}
            {showCreateFolder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1f2e] p-5 sm:p-6 rounded-xl border border-white/10 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-white">Create New Folder</h2>
                        <input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Folder Name"
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 mb-6 text-white focus:outline-none focus:border-blue-500 placeholder-gray-500"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowCreateFolder(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Move Assignment Modal */}
            {showMoveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1f2e] p-5 sm:p-6 rounded-xl border border-white/10 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-white">Move Assignment</h2>
                        <p className="text-sm text-gray-400 mb-4">Select destination for <span className="text-white font-medium">"{assignmentToMove?.title}"</span>:</p>

                        <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-2 custom-scrollbar">
                            <button
                                onClick={() => handleMoveAssignment(null)}
                                className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-all ${!assignmentToMove?.folderId
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                    : 'border-white/5 hover:bg-white/5 text-gray-300 hover:text-white'
                                    }`}
                            >
                                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center">
                                    <List className="w-4 h-4" />
                                </div>
                                <span>/ (Root)</span>
                            </button>

                            {folders.map(f => (
                                <button
                                    key={f._id}
                                    onClick={() => handleMoveAssignment(f._id)}
                                    className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-all ${assignmentToMove?.folderId === f._id
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                        : 'border-white/5 hover:bg-white/5 text-gray-300 hover:text-white'
                                        }`}
                                >
                                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center">
                                        <Folder className="w-4 h-4" />
                                    </div>
                                    <span className="truncate">{f.name}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowMoveModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Record Offline Exam Modal */}
            {showOfflineModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-[#0f1115] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-red-600/20 to-orange-600/20">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <ClipboardEdit className="w-5 h-5 text-orange-400" />
                                Record Offline Exam Marks
                            </h2>
                            <button onClick={() => setShowOfflineModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* Batch Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Select Batch</label>
                                <select
                                    value={offlineSelectedBatch}
                                    onChange={(e) => loadStudentsForBatch(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500/50"
                                >
                                    <option value="">-- Select Batch --</option>
                                    {offlineBatches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>

                            {offlineSelectedBatch && (
                                <>
                                    {/* Exam Details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Chapter Name</label>
                                            <input
                                                type="text"
                                                value={offlineChapter}
                                                onChange={(e) => setOfflineChapter(e.target.value)}
                                                placeholder="e.g. Calculus Ch-3"
                                                className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-orange-500/50 placeholder-gray-600"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Test Date</label>
                                            <input
                                                type="date"
                                                value={offlineTestDate}
                                                onChange={(e) => setOfflineTestDate(e.target.value)}
                                                className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-orange-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Full Marks</label>
                                            <input
                                                type="number"
                                                value={offlineFullMarks}
                                                onChange={(e) => setOfflineFullMarks(e.target.value)}
                                                placeholder="e.g. 50"
                                                min="1"
                                                className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-orange-500/50 placeholder-gray-600"
                                            />
                                        </div>
                                    </div>

                                    {/* Student Marks Table */}
                                    {offlineLoading ? (
                                        <div className="flex justify-center py-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                                        </div>
                                    ) : (
                                        <div className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden">
                                            <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 p-3 bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                <div>Student Name</div>
                                                <div className="text-center">Marks</div>
                                                <div className="text-center">Percentage</div>
                                            </div>
                                            <div className="max-h-[40vh] overflow-y-auto">
                                                {offlineStudents.map((student, i) => {
                                                    const fm = parseFloat(offlineFullMarks) || 0;
                                                    const marks = parseFloat(student.marks);
                                                    const pct = (!isNaN(marks) && fm > 0) ? ((marks / fm) * 100).toFixed(1) : '-';
                                                    return (
                                                        <div key={student._id} className={`grid grid-cols-[2fr_1fr_1fr] gap-2 p-3 items-center border-t border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                                                            <div>
                                                                <p className="text-sm font-medium text-white truncate">{student.name}</p>
                                                                <p className="text-[10px] text-gray-500">{student.phoneNumber}</p>
                                                            </div>
                                                            <div className="flex justify-center">
                                                                <input
                                                                    type="text"
                                                                    value={student.marks}
                                                                    onChange={(e) => handleOfflineMarksChange(i, e.target.value)}
                                                                    placeholder="-"
                                                                    className="w-20 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-center text-white text-sm focus:outline-none focus:border-orange-500/50"
                                                                />
                                                            </div>
                                                            <div className="text-center">
                                                                <span className={`text-sm font-bold ${typeof pct === 'string' && pct !== '-' ? 'text-blue-400 text-xs' : pct === '-' ? 'text-gray-600' : parseFloat(pct as string) >= 75 ? 'text-green-400' : parseFloat(pct as string) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                    {pct}{typeof pct === 'number' || (typeof pct === 'string' && pct !== '-' && !isNaN(parseFloat(pct))) ? '%' : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {offlineSelectedBatch && (
                            <div className="p-5 border-t border-white/10 flex justify-end gap-3">
                                <button onClick={() => setShowOfflineModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <button
                                    onClick={handleSaveOfflineExam}
                                    disabled={offlineSaving}
                                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-lg text-white font-medium shadow-lg disabled:opacity-50 transition-all"
                                >
                                    <Save className="w-4 h-4" />
                                    {offlineSaving ? 'Saving...' : 'Save Exam'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Offline Exams Collapsible Section */}
            {offlineExams.length > 0 && !showOfflineModal && (
                <div className="mt-6">
                    <button
                        onClick={() => setShowOfflineExams(!showOfflineExams)}
                        className="flex items-center gap-2 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors mb-3"
                    >
                        {showOfflineExams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <ClipboardEdit className="w-4 h-4" />
                        Offline Exam Records ({offlineExams.length})
                    </button>

                    {showOfflineExams && (
                        <div className="space-y-3">
                            {offlineExams.map(exam => (
                                <div key={exam._id} className="bg-[#1a1f2e] border border-white/5 rounded-xl p-4 hover:border-orange-500/30 transition-all">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-white font-semibold">{exam.chapterName}</span>
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">{exam.batch}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                                <span>Date: {new Date(exam.testDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                                                <span>Full Marks: {exam.fullMarks}</span>
                                                <span>Students: {exam.results.length}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => startEditExam(exam)}
                                                className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-orange-400 transition-colors"
                                                title="Edit Marks"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteExam(exam._id)}
                                                className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Edit Offline Exam Modal */}
            {editingExam && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-[#0f1115] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-orange-600/20 to-amber-600/20">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Edit3 className="w-5 h-5 text-amber-400" />
                                Edit Offline Exam
                            </h2>
                            <button onClick={() => setEditingExam(null)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Chapter Name</label>
                                    <input type="text" value={editChapter} onChange={(e) => setEditChapter(e.target.value)}
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-amber-500/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Test Date</label>
                                    <input type="date" value={editTestDate} onChange={(e) => setEditTestDate(e.target.value)}
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-amber-500/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Full Marks</label>
                                    <input type="number" value={editFullMarks} onChange={(e) => setEditFullMarks(e.target.value)} min="1"
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-amber-500/50" />
                                </div>
                            </div>

                            <div className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden">
                                <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 p-3 bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    <div>Student Name</div>
                                    <div className="text-center">Marks</div>
                                    <div className="text-center">Percentage</div>
                                </div>
                                <div className="max-h-[40vh] overflow-y-auto">
                                    {editStudents.map((student, i) => {
                                        const fm = parseFloat(editFullMarks) || 0;
                                        const marks = parseFloat(student.marks);
                                        const pct = (!isNaN(marks) && fm > 0) ? ((marks / fm) * 100).toFixed(1) : '-';
                                        return (
                                            <div key={student._id} className={`grid grid-cols-[2fr_1fr_1fr] gap-2 p-3 items-center border-t border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                                                <div>
                                                    <p className="text-sm font-medium text-white truncate">{student.name}</p>
                                                    <p className="text-[10px] text-gray-500">{student.phoneNumber}</p>
                                                </div>
                                                <div className="flex justify-center">
                                                    <input
                                                        type="text"
                                                        value={student.marks}
                                                        onChange={(e) => handleEditMarksChange(i, e.target.value)}
                                                        placeholder="-"
                                                        className="w-20 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-center text-white text-sm focus:outline-none focus:border-amber-500/50"
                                                    />
                                                </div>
                                                <div className="text-center">
                                                    <span className={`text-sm font-bold ${typeof pct === 'string' && pct !== '-' ? 'text-blue-400 text-xs' : pct === '-' ? 'text-gray-600' : parseFloat(pct as string) >= 75 ? 'text-green-400' : parseFloat(pct as string) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {pct}{typeof pct === 'number' || (typeof pct === 'string' && pct !== '-' && !isNaN(parseFloat(pct))) ? '%' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-white/10 flex justify-between items-center bg-black/20">
                            <button
                                onClick={handleDownloadPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 rounded-lg transition-colors text-sm font-medium"
                            >
                                <Download className="w-4 h-4" />
                                Download PDF
                            </button>
                            <div className="flex gap-3">
                                <button onClick={() => setEditingExam(null)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <button
                                    onClick={handleUpdateExam}
                                    disabled={editSaving}
                                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 rounded-lg text-white font-medium shadow-lg disabled:opacity-50 transition-all"
                                >
                                    <Save className="w-4 h-4" />
                                    {editSaving ? 'Updating...' : 'Update Exam'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
