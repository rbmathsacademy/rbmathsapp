
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Clock, FileText, ExternalLink, CheckCircle, AlertTriangle, User, Pen, X, Save, Trash2, Filter, ChevronDown, ChevronUp, Plus, Search } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface StudentSubmission {
    _id: string | null; // submission ID if exists
    student: {
        _id: string;
        name: string;
        phoneNumber: string;
    };
    status: 'PENDING' | 'CORRECTED'; // Correction Status
    submissionStatus: 'SUBMITTED' | 'LATE_SUBMITTED' | 'MISSED' | 'PENDING';
    submittedAt: string | null;
    link: string | null;
    isLate: boolean;
    quality?: 'GOOD' | 'SATISFACTORY' | 'POOR' | null;
}

interface Assignment {
    _id: string;
    title: string;
    type: 'PDF' | 'QUESTIONS';
    batch: string;
    deadline: string;
    cooldownDuration?: number;
    content: any;
    folderId?: string;
}

export default function AssignmentDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [students, setStudents] = useState<StudentSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDeadline, setEditDeadline] = useState('');
    const [editCooldown, setEditCooldown] = useState(0);

    // Filter State
    const [correctionFilter, setCorrectionFilter] = useState<'ALL' | 'CORRECTED' | 'NOT_CORRECTED'>('ALL');
    const [submissionFilter, setSubmissionFilter] = useState<'ALL' | 'ON_TIME' | 'LATE' | 'PENDING' | 'MISSED'>('ALL');

    // Question Viewer / Manager State
    const [assignmentQuestions, setAssignmentQuestions] = useState<any[]>([]);
    const [isViewQModalOpen, setIsViewQModalOpen] = useState(false);
    const [isEditQuestionsExpanded, setIsEditQuestionsExpanded] = useState(false);

    // Question Edit Modal State
    const [isQEditModalOpen, setIsQEditModalOpen] = useState(false);
    const [allBankQuestions, setAllBankQuestions] = useState<any[]>([]);
    const [qEditSelectedIds, setQEditSelectedIds] = useState<Set<string>>(new Set());
    const [qBankLoading, setQBankLoading] = useState(false);
    const [qSearchQuery, setQSearchQuery] = useState('');
    const [qTopicFilter, setQTopicFilter] = useState('');
    const [qTypeFilter, setQTypeFilter] = useState('');

    useEffect(() => {
        if (params.id) fetchDetails();
    }, [params.id]);

    const fetchDetails = async () => {
        try {
            const res = await fetch(`/api/admin/assignments/${params.id}`);
            const data = await res.json();
            if (data.assignment) {
                setAssignment(data.assignment);
                // Sort students alphabetically by name
                const sortedStudents = (data.studentList || []).sort((a: any, b: any) =>
                    (a.student.name || '').localeCompare(b.student.name || '')
                );
                setStudents(sortedStudents);

                // Set assignment questions
                if (data.assignmentQuestions) {
                    setAssignmentQuestions(data.assignmentQuestions);
                }

                // Init edit state
                setEditTitle(data.assignment.title);
                setEditCooldown(data.assignment.cooldownDuration || 0);
                // Convert UTC date to local datetime-local string format
                const d = new Date(data.assignment.deadline);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                setEditDeadline(d.toISOString().slice(0, 16));
            } else {
                toast.error('Assignment not found');
            }
        } catch (error) {
            toast.error('Failed to load details');
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (submissionId: string | null, currentStatus: string, quality: string | null = null) => {
        if (!submissionId) return; // Cannot toggle status if not submitted

        const newStatus = currentStatus === 'CORRECTED' && !quality ? 'PENDING' : 'CORRECTED';

        // Optimistic update
        setStudents(prev => prev.map(s =>
            s._id === submissionId ? { ...s, status: newStatus as any, quality: quality as any } : s
        ));

        try {
            const res = await fetch('/api/admin/assignments/submission/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, status: newStatus, quality })
            });

            if (!res.ok) throw new Error('Failed to update');
            toast.success(newStatus === 'CORRECTED' ? (quality ? `Marked as Corrected (${quality})` : 'Marked as Corrected') : 'Marked as Pending');
        } catch (error) {
            toast.error('Failed to update status');
            // Revert optimistic update on failure
            fetchDetails();
        }
    };

    const handleQualityChange = (submissionId: string | null, quality: string) => {
        if (!submissionId) return;
        toggleStatus(submissionId, 'CORRECTED', quality);
    };


    const handleUpdateAssignment = async () => {
        if (!assignment) return;
        try {
            const res = await fetch(`/api/admin/assignments/${assignment._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editTitle,
                    deadline: new Date(editDeadline).toISOString(),
                    cooldownDuration: editCooldown
                })
            });
            const data = await res.json();
            if (res.ok) {
                setAssignment(data.assignment);
                setIsEditModalOpen(false);
                toast.success('Assignment updated');
                fetchDetails(); // Refresh list to update statuses based on new deadline
            } else {
                toast.error(data.error || 'Failed to update');
            }
        } catch (error) {
            toast.error('Error updating assignment');
        }
    };

    const handleDeleteSubmission = async (submissionId: string) => {
        if (!confirm('Are you sure you want to delete this submission? The student will be able to submit again.')) return;

        try {
            const res = await fetch(`/api/admin/assignments/submission/${submissionId}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Failed to delete');

            toast.success('Submission deleted successfully');
            fetchDetails(); // Refresh the list
        } catch (error) {
            toast.error('Failed to delete submission');
        }
    };

    // Question Edit Modal Functions
    const openQEditModal = async () => {
        if (allBankQuestions.length === 0) {
            setQBankLoading(true);
            try {
                const res = await fetch('/api/admin/questions', {
                    headers: { 'X-Global-Admin-Key': 'globaladmin_25' }
                });
                const data = await res.json();
                const qs = Array.isArray(data) ? data : (data.questions || []);
                setAllBankQuestions(qs);
            } catch {
                toast.error('Failed to load question bank');
            } finally {
                setQBankLoading(false);
            }
        }
        // Pre-select current assignment questions
        if (assignment && Array.isArray(assignment.content)) {
            setQEditSelectedIds(new Set(assignment.content as string[]));
        }
        setIsQEditModalOpen(true);
    };

    const handleSaveQuestionEdits = async () => {
        if (!assignment) return;
        const newContent = Array.from(qEditSelectedIds);
        try {
            const res = await fetch(`/api/admin/assignments/${assignment._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newContent })
            });
            if (res.ok) {
                toast.success('Assignment questions updated');
                setIsQEditModalOpen(false);
                fetchDetails();
            } else {
                toast.error('Failed to update questions');
            }
        } catch {
            toast.error('Error saving question changes');
        }
    };

    const toggleQEditSelection = (id: string) => {
        const s = new Set(qEditSelectedIds);
        if (s.has(id)) s.delete(id); else s.add(id);
        setQEditSelectedIds(s);
    };

    const handleRemoveQuestion = async (questionId: string) => {
        if (!assignment || !Array.isArray(assignment.content)) return;
        if (!confirm('Are you sure you want to remove this question from the assignment?')) return;
        
        const newContent = assignment.content.filter(id => id !== questionId);
        
        try {
            const res = await fetch(`/api/admin/assignments/${assignment._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newContent })
            });
            if (res.ok) {
                toast.success('Question removed');
                setAssignmentQuestions(prev => prev.filter(q => (q._id || q.id) !== questionId));
                setAssignment(prev => prev ? { ...prev, content: newContent } : null);
                // Also update the selected set for the modal to stay in sync
                const s = new Set(qEditSelectedIds);
                s.delete(questionId);
                setQEditSelectedIds(s);
            } else {
                toast.error('Failed to remove question');
            }
        } catch {
            toast.error('Error removing question');
        }
    };

    // Filtered question bank for edit modal
    const filteredBankQuestions = allBankQuestions.filter(q => {
        if (qSearchQuery) {
            const query = qSearchQuery.toLowerCase();
            if (!q.text?.toLowerCase().includes(query) && !q.id?.toLowerCase().includes(query) && !q.topic?.toLowerCase().includes(query)) return false;
        }
        if (qTopicFilter && q.topic !== qTopicFilter) return false;
        if (qTypeFilter && q.type !== qTypeFilter) return false;
        return true;
    });

    const bankTopics = [...new Set(allBankQuestions.map((q: any) => q.topic).filter(Boolean))].sort() as string[];
    const bankTypes = [...new Set(allBankQuestions.map((q: any) => q.type).filter(Boolean))] as string[];

    if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;
    if (!assignment) return <div className="p-12 text-center text-gray-400">Assignment not found</div>;

    const deadline = new Date(assignment.deadline);
    const isExpired = new Date() > deadline;
    const cooldownEnd = new Date(deadline.getTime() + (assignment.cooldownDuration || 0) * 60000);
    const isCooldownExpired = new Date() > cooldownEnd;

    // Counts
    const submittedCount = students.filter(s => s.submissionStatus === 'SUBMITTED' || s.submissionStatus === 'LATE_SUBMITTED').length;
    const lateCount = students.filter(s => s.submissionStatus === 'LATE_SUBMITTED').length;
    const missedCount = students.filter(s => s.submissionStatus === 'MISSED').length;
    const pendingCount = students.filter(s => s.submissionStatus === 'PENDING').length;

    // Apply filters
    const filteredStudents = students.filter(s => {
        // Correction filter
        if (correctionFilter === 'CORRECTED' && s.status !== 'CORRECTED') return false;
        if (correctionFilter === 'NOT_CORRECTED' && s.status === 'CORRECTED') return false;

        // Submission filter
        if (submissionFilter === 'ON_TIME' && s.submissionStatus !== 'SUBMITTED') return false;
        if (submissionFilter === 'LATE' && s.submissionStatus !== 'LATE_SUBMITTED') return false;
        if (submissionFilter === 'PENDING' && s.submissionStatus !== 'PENDING') return false;
        if (submissionFilter === 'MISSED' && s.submissionStatus !== 'MISSED') return false;

        return true;
    });

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full text-gray-200 overflow-x-hidden sm:overflow-visible">
            <Toaster />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                <button
                    onClick={() => router.push('/admin/assignments')}
                    className="flex items-center w-fit gap-2 text-gray-400 hover:text-white transition-colors text-sm sm:text-base"
                >
                    <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    Back
                </button>
                {assignment?.type === 'QUESTIONS' && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setIsViewQModalOpen(true)}
                            className="bg-purple-600 hover:bg-purple-500 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-white transition-colors flex items-center gap-1.5"
                        >
                            <FileText className="w-4 h-4" /> View Assignment
                        </button>
                        <button
                            onClick={() => setIsEditQuestionsExpanded(true)}
                            className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-white transition-colors flex items-center gap-1.5"
                        >
                            <Pen className="w-4 h-4" /> Edit Questions
                        </button>
                    </div>
                )}
            </div>

            {/* Header Card */}
            <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-4 sm:p-8 mb-6 sm:mb-8 relative group">
                <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-all"
                    title="Edit Assignment"
                >
                    <Pen className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <div>
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-mono">
                            {assignment.type}
                        </span>
                        <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-mono">
                            {assignment.batch}
                        </span>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2 pr-10">
                        {assignment.title}
                    </h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-gray-400 mt-3 sm:mt-4 text-sm flex-wrap">
                        <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${isExpired ? 'text-red-400' : 'text-green-400'}`} />
                            <span>Due: {deadline.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })} {deadline.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
                        </div>
                        {(assignment.cooldownDuration || 0) > 0 && (
                            <div className="flex items-center gap-2">
                                <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 ${isCooldownExpired ? 'text-red-400' : 'text-orange-400'}`} />
                                <span className={isCooldownExpired ? 'text-red-400' : 'text-orange-400'}>
                                    Cooldown ends: {cooldownEnd.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })} {cooldownEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                            <span>{submittedCount} / {students.length} Submissions</span>
                        </div>
                    </div>
                </div>
                {assignment.type === 'PDF' && (
                    <div className="mt-4">
                        <a
                            href={typeof assignment.content === 'string' && assignment.content.startsWith('http') ? assignment.content : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors text-sm"
                            onClick={(e) => {
                                if (typeof assignment.content !== 'string' || !assignment.content.startsWith('http')) {
                                    e.preventDefault();
                                    toast.error('Assignment content is not a link');
                                }
                            }}
                        >
                            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                            View Question Paper
                        </a>
                    </div>
                )}
            </div>



            {/* Submissions List */}
            <div className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-white/5">
                    <h2 className="text-lg sm:text-xl font-semibold mb-3">Student Status</h2>
                    <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-1.5 text-green-400">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
                            Submitted on time: {submittedCount - lateCount}
                        </div>
                        <div className="flex items-center gap-1.5 text-orange-400">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-orange-500" />
                            Late: {lateCount}
                        </div>
                        <div className="flex items-center gap-1.5 text-red-400">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
                            Missed: {missedCount}
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gray-500" />
                            Pending: {pendingCount}
                        </div>
                        <div className="flex items-center gap-1.5 text-blue-400 ml-auto sm:ml-4 border-l border-white/10 pl-4">
                            Total Submissions: {submittedCount}
                        </div>
                        <div className="flex items-center gap-1.5 text-purple-400 border-l border-white/10 pl-4">
                            No. of Corrected: {students.filter(s => s.status === 'CORRECTED').length}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-3 mt-3">
                        <div className="flex items-center gap-1.5">
                            <Filter className="w-3.5 h-3.5 text-gray-500" />
                            <select
                                value={correctionFilter}
                                onChange={(e) => setCorrectionFilter(e.target.value as any)}
                                className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-purple-500 cursor-pointer"
                            >
                                <option value="ALL">All Corrections</option>
                                <option value="CORRECTED">Corrected</option>
                                <option value="NOT_CORRECTED">Not Corrected</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <select
                                value={submissionFilter}
                                onChange={(e) => setSubmissionFilter(e.target.value as any)}
                                className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="ALL">All Submissions</option>
                                <option value="ON_TIME">On Time</option>
                                <option value="LATE">Late</option>
                                <option value="PENDING">Pending</option>
                                <option value="MISSED">Missed</option>
                            </select>
                        </div>
                        {(correctionFilter !== 'ALL' || submissionFilter !== 'ALL') && (
                            <button
                                onClick={() => { setCorrectionFilter('ALL'); setSubmissionFilter('ALL'); }}
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 hover:bg-red-500/10 transition-colors"
                            >
                                Clear Filters
                            </button>
                        )}
                        {(correctionFilter !== 'ALL' || submissionFilter !== 'ALL') && (
                            <span className="text-xs text-gray-500 self-center ml-auto">Showing {filteredStudents.length} of {students.length}</span>
                        )}
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/20 text-gray-400 text-sm uppercase">
                                <th className="p-4 font-medium">Student</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">Submitted At</th>
                                <th className="p-4 font-medium text-center">Correction</th>
                                <th className="p-4 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-500">
                                        {students.length === 0 ? 'No students in this batch.' : 'No students match the current filters.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map(student => (
                                    <tr key={student.student._id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{student.student.name || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-500">{student.student.phoneNumber}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {student.submissionStatus === 'SUBMITTED' && (
                                                <span className="inline-flex items-center gap-1.5 text-green-400 text-xs bg-green-500/10 px-2 py-1 rounded-full">
                                                    <CheckCircle className="w-3 h-3" /> Submitted
                                                </span>
                                            )}
                                            {student.submissionStatus === 'LATE_SUBMITTED' && (
                                                <span className="inline-flex items-center gap-1.5 text-orange-400 text-xs bg-orange-500/10 px-2 py-1 rounded-full">
                                                    <AlertTriangle className="w-3 h-3" /> Late
                                                </span>
                                            )}
                                            {student.submissionStatus === 'MISSED' && (
                                                <span className="inline-flex items-center gap-1.5 text-red-400 text-xs bg-red-500/10 px-2 py-1 rounded-full">
                                                    <X className="w-3 h-3" /> Missed
                                                </span>
                                            )}
                                            {student.submissionStatus === 'PENDING' && (
                                                <span className="inline-flex items-center gap-1.5 text-gray-400 text-xs bg-gray-500/10 px-2 py-1 rounded-full">
                                                    <Clock className="w-3 h-3" /> Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-400 text-sm">
                                            {student.submittedAt ? (
                                                <>
                                                    {new Date(student.submittedAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })} <span className="text-gray-600">|</span> {new Date(student.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                                </>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {student._id ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <button
                                                        onClick={() => toggleStatus(student._id, student.status)}
                                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all border w-24 ${student.status === 'CORRECTED'
                                                            ? 'bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(74,222,128,0.2)]'
                                                            : 'bg-gray-700/50 text-gray-400 border-gray-600 hover:bg-gray-700'
                                                            }`}
                                                    >
                                                        {student.status === 'CORRECTED' ? 'CORRECTED' : 'PENDING'}
                                                    </button>
                                                    
                                                    {student.status === 'CORRECTED' && (
                                                        <select
                                                            value={student.quality || ''}
                                                            onChange={(e) => handleQualityChange(student._id!, e.target.value)}
                                                            className={`text-[10px] font-bold px-2 py-1 rounded border outline-none cursor-pointer w-24 ${
                                                                !student.quality ? 'bg-gray-800 text-gray-400 border-gray-600' :
                                                                student.quality === 'GOOD' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                                                student.quality === 'SATISFACTORY' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                                                                'bg-red-500/10 text-red-400 border-red-500/30'
                                                            }`}
                                                        >
                                                            <option value="" disabled>Select Quality</option>
                                                            <option value="GOOD">Good</option>
                                                            <option value="SATISFACTORY">Satisfactory</option>
                                                            <option value="POOR">Poor</option>
                                                        </select>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            {student._id ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    {student.link && (
                                                        <a
                                                            href={student.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors text-white"
                                                        >
                                                            View <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteSubmission(student._id!)}
                                                        className="inline-flex items-center justify-center w-7 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20"
                                                        title="Delete Submission"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 text-xs italic">Not submitted</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card List */}
                <div className="sm:hidden divide-y divide-white/5">
                    {filteredStudents.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">{students.length === 0 ? 'No students in this batch.' : 'No students match the current filters.'}</div>
                    ) : (
                        filteredStudents.map(student => (
                            <div key={student.student._id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-white text-sm truncate">{student.student.name || 'Unknown'}</p>
                                            <p className="text-xs text-gray-500">{student.student.phoneNumber}</p>
                                        </div>
                                    </div>
                                    {/* Status Badge */}
                                    {student.submissionStatus === 'SUBMITTED' && (
                                        <span className="inline-flex items-center gap-1 text-green-400 text-[10px] bg-green-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                            <CheckCircle className="w-3 h-3" /> Submitted
                                        </span>
                                    )}
                                    {student.submissionStatus === 'LATE_SUBMITTED' && (
                                        <span className="inline-flex items-center gap-1 text-orange-400 text-[10px] bg-orange-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                            <AlertTriangle className="w-3 h-3" /> Late
                                        </span>
                                    )}
                                    {student.submissionStatus === 'MISSED' && (
                                        <span className="inline-flex items-center gap-1 text-red-400 text-[10px] bg-red-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                            <X className="w-3 h-3" /> Missed
                                        </span>
                                    )}
                                    {student.submissionStatus === 'PENDING' && (
                                        <span className="inline-flex items-center gap-1 text-gray-400 text-[10px] bg-gray-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                            <Clock className="w-3 h-3" /> Pending
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        {student.submittedAt && (
                                            <span className="text-xs text-gray-500">
                                                {new Date(student.submittedAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })} {new Date(student.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                            </span>
                                        )}
                                        {student._id && (
                                            <div className="flex flex-col gap-1.5 items-end">
                                                <button
                                                    onClick={() => toggleStatus(student._id, student.status)}
                                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all border ${student.status === 'CORRECTED'
                                                        ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                                        : 'bg-gray-700/50 text-gray-400 border-gray-600'
                                                        }`}
                                                >
                                                    {student.status === 'CORRECTED' ? 'CORRECTED' : 'PENDING'}
                                                </button>
                                                
                                                {student.status === 'CORRECTED' && (
                                                    <select
                                                        value={student.quality || ''}
                                                        onChange={(e) => handleQualityChange(student._id!, e.target.value)}
                                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border outline-none cursor-pointer ${
                                                            !student.quality ? 'bg-gray-800 text-gray-400 border-gray-600' :
                                                            student.quality === 'GOOD' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                                            student.quality === 'SATISFACTORY' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                                                            'bg-red-500/10 text-red-400 border-red-500/30'
                                                        }`}
                                                    >
                                                        <option value="" disabled>Select Quality</option>
                                                        <option value="GOOD">Good</option>
                                                        <option value="SATISFACTORY">Satisfactory</option>
                                                        <option value="POOR">Poor</option>
                                                    </select>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {student._id ? (
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {student.link && (
                                                <a
                                                    href={student.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-medium text-white flex-shrink-0"
                                                >
                                                    View <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                            <button
                                                onClick={() => handleDeleteSubmission(student._id!)}
                                                className="inline-flex items-center justify-center w-6 h-6 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded border border-red-500/20 flex-shrink-0"
                                                title="Delete Submission"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1f2e] p-5 sm:p-6 rounded-xl border border-white/10 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                            <Pen className="w-5 h-5" /> Edit Assignment
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Title</label>
                                <input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Deadline</label>
                                <input
                                    type="datetime-local"
                                    value={editDeadline}
                                    onChange={(e) => setEditDeadline(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Cooldown Duration (minutes)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editCooldown}
                                    onChange={(e) => setEditCooldown(Number(e.target.value))}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="e.g. 30"
                                />
                                <p className="text-xs text-gray-500 mt-1">Extra time after deadline for late submissions</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateAssignment}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Question Edit Modal */}
            {isQEditModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-[#1a1f2e] w-full max-w-5xl h-[95vh] sm:h-[85vh] rounded-2xl border border-white/10 flex flex-col shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Edit Assignment Questions</h2>
                            <button onClick={() => setIsQEditModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="p-3 sm:p-4 border-b border-white/5 bg-black/20 space-y-3">
                            <div className="flex gap-2 flex-wrap">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        value={qSearchQuery}
                                        onChange={(e) => setQSearchQuery(e.target.value)}
                                        placeholder="Search questions by text, ID, or topic..."
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm outline-none focus:border-blue-500"
                                    />
                                </div>
                                <select
                                    value={qTopicFilter}
                                    onChange={(e) => setQTopicFilter(e.target.value)}
                                    className="bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none min-w-[150px]"
                                >
                                    <option value="">All Topics</option>
                                    {bankTopics.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select
                                    value={qTypeFilter}
                                    onChange={(e) => setQTypeFilter(e.target.value)}
                                    className="bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none min-w-[120px]"
                                >
                                    <option value="">All Types</option>
                                    {bankTypes.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2 items-center flex-wrap">
                                <button
                                    onClick={() => {
                                        const s = new Set(qEditSelectedIds);
                                        filteredBankQuestions.forEach(q => s.add(q.id || q._id));
                                        setQEditSelectedIds(s);
                                    }}
                                    className="px-4 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-sm border border-blue-500/30"
                                >
                                    Select All ({filteredBankQuestions.length})
                                </button>
                                <button
                                    onClick={() => setQEditSelectedIds(new Set())}
                                    className="px-4 py-1.5 bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg text-sm border border-red-500/20"
                                >
                                    Deselect All
                                </button>
                                <span className="ml-auto text-xs sm:text-sm text-gray-400">
                                    {filteredBankQuestions.length} of {allBankQuestions.length} &bull; {qEditSelectedIds.size} selected
                                </span>
                            </div>
                        </div>

                        {/* Questions List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {qBankLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
                                </div>
                            ) : filteredBankQuestions.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">No questions match your filters.</div>
                            ) : (
                                filteredBankQuestions.map(q => {
                                    const qId = q.id || q._id;
                                    const isSelected = qEditSelectedIds.has(qId);
                                    return (
                                        <div
                                            key={qId}
                                            onClick={() => toggleQEditSelection(qId)}
                                            className={`p-4 rounded-xl border cursor-pointer transition-all ${isSelected
                                                ? 'bg-blue-500/10 border-blue-500/50'
                                                : 'bg-black/20 border-white/5 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex gap-4">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                                                    {isSelected && (
                                                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex gap-2 mb-1.5 flex-wrap">
                                                        <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-400">{q.topic}</span>
                                                        {q.subtopic && <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-400">{q.subtopic}</span>}
                                                        <span className="text-xs bg-purple-500/10 px-2 py-0.5 rounded text-purple-400">{q.type}</span>
                                                        {q.marks && <span className="text-xs bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-400">{q.marks}M</span>}
                                                    </div>
                                                    <div className="text-sm text-gray-200"><Latex>{q.text}</Latex></div>
                                                    {q.image && (
                                                        <img src={q.image} alt="Q" className="mt-2 max-h-24 rounded border border-white/10" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 sm:p-4 border-t border-white/10 flex justify-between items-center bg-black/20">
                            <span className="text-gray-400 font-medium">{qEditSelectedIds.size} questions selected</span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsQEditModalOpen(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveQuestionEdits}
                                    className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Deployed Questions Modal */}
            {isEditQuestionsExpanded && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-[#1a1f2e] w-full max-w-5xl h-[95vh] sm:h-[85vh] rounded-2xl border border-white/10 flex flex-col shadow-2xl">
                        <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-black/20">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2"><Pen className="w-5 h-5 text-blue-400" /> Deployed Questions</h2>
                                <p className="text-xs text-gray-400 mt-1">Delete questions from this assignment or add new ones</p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <button
                                    onClick={openQEditModal}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                                >
                                    <Plus className="w-4 h-4" /> Add More Questions
                                </button>
                                <button onClick={() => setIsEditQuestionsExpanded(false)} className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors ml-auto sm:ml-0">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {assignmentQuestions.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">No questions loaded for this assignment.</div>
                            ) : (
                                assignmentQuestions.map((q, i) => (
                                    <div key={q._id || q.id || i} className="bg-black/20 border border-white/5 rounded-xl p-4 sm:p-5 group relative">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRemoveQuestion(q._id || q.id); }}
                                            className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                                            title="Remove Question"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="flex items-start gap-4 pr-12">
                                            <span className="text-gray-500 font-mono text-sm sm:text-base font-bold flex-shrink-0 pt-0.5">{i + 1}.</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-bold uppercase">{q.topic}</span>
                                                    {q.subtopic && <span className="text-[10px] bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-bold uppercase">{q.subtopic}</span>}
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${q.type === 'broad' ? 'border-pink-500/30 text-pink-400' : q.type === 'mcq' ? 'border-yellow-500/30 text-yellow-400' : 'border-cyan-500/30 text-cyan-400'}`}>{q.type}</span>
                                                    {q.marks && <span className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">{q.marks}M</span>}
                                                </div>
                                                <div className="text-sm sm:text-base text-gray-200 leading-relaxed overflow-x-auto">
                                                    {q.image && (
                                                        <div className="mb-3">
                                                            <img src={q.image} alt="Q" className="max-h-40 rounded-lg border border-white/10" />
                                                        </div>
                                                    )}
                                                    <Latex>{q.text}</Latex>
                                                </div>
                                                {q.type === 'mcq' && q.options && q.options.length > 0 && (
                                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {q.options.map((opt: string, j: number) => (
                                                            <div key={j} className="text-xs sm:text-sm px-3 py-2 rounded-lg border border-white/5 bg-black/20 flex items-start gap-2">
                                                                <span className="font-bold text-gray-500">{String.fromCharCode(65 + j)}.</span>
                                                                <span className="text-gray-300 overflow-x-auto"><Latex>{opt}</Latex></span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* View Questions Modal */}
            {isViewQModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[45] flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-[#1a1f2e] w-full max-w-5xl h-[95vh] sm:h-[85vh] rounded-2xl border border-white/10 flex flex-col shadow-2xl">
                        <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
                            <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-purple-400" /> Assignment View</h2>
                            <button onClick={() => setIsViewQModalOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {assignmentQuestions.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">No questions loaded for this assignment.</div>
                            ) : (
                                assignmentQuestions.map((q, i) => (
                                    <div key={q._id || q.id || i} className="bg-black/20 border border-white/5 rounded-xl p-4 sm:p-5">
                                        <div className="flex items-start gap-4">
                                            <span className="text-gray-500 font-mono text-sm sm:text-base font-bold flex-shrink-0 pt-0.5">{i + 1}.</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-bold uppercase">{q.topic}</span>
                                                    {q.subtopic && <span className="text-[10px] bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-bold uppercase">{q.subtopic}</span>}
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${q.type === 'broad' ? 'border-pink-500/30 text-pink-400' : q.type === 'mcq' ? 'border-yellow-500/30 text-yellow-400' : 'border-cyan-500/30 text-cyan-400'}`}>{q.type}</span>
                                                    {q.marks && <span className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">{q.marks}M</span>}
                                                </div>
                                                <div className="text-sm sm:text-base text-gray-200 leading-relaxed overflow-x-auto">
                                                    {q.image && (
                                                        <div className="mb-3">
                                                            <img src={q.image} alt="Q" className="max-h-40 rounded-lg border border-white/10" />
                                                        </div>
                                                    )}
                                                    <Latex>{q.text}</Latex>
                                                </div>
                                                {q.type === 'mcq' && q.options && q.options.length > 0 && (
                                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {q.options.map((opt: string, j: number) => (
                                                            <div key={j} className="text-xs sm:text-sm px-3 py-2 rounded-lg border border-white/5 bg-black/20 flex items-start gap-2">
                                                                <span className="font-bold text-gray-500">{String.fromCharCode(65 + j)}.</span>
                                                                <span className="text-gray-300 overflow-x-auto"><Latex>{opt}</Latex></span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
