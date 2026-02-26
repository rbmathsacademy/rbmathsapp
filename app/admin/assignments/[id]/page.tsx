
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Clock, FileText, ExternalLink, CheckCircle, AlertTriangle, User, Pen, X, Save } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

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
}

interface Assignment {
    _id: string;
    title: string;
    type: 'PDF' | 'QUESTIONS';
    batch: string;
    deadline: string;
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

    useEffect(() => {
        if (params.id) fetchDetails();
    }, [params.id]);

    const fetchDetails = async () => {
        try {
            const res = await fetch(`/api/admin/assignments/${params.id}`);
            const data = await res.json();
            if (data.assignment) {
                setAssignment(data.assignment);
                setStudents(data.studentList || []);

                // Init edit state
                setEditTitle(data.assignment.title);
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

    const toggleStatus = async (submissionId: string | null, currentStatus: string) => {
        if (!submissionId) return; // Cannot toggle status if not submitted

        const newStatus = currentStatus === 'CORRECTED' ? 'PENDING' : 'CORRECTED';

        // Optimistic update
        setStudents(prev => prev.map(s =>
            s._id === submissionId ? { ...s, status: newStatus as any } : s
        ));

        try {
            const res = await fetch('/api/admin/assignments/submission/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, status: newStatus })
            });

            if (!res.ok) throw new Error('Failed to update');
            toast.success(`Marked as ${newStatus}`);
        } catch (error) {
            toast.error('Failed to update status');
            // Revert
            setStudents(prev => prev.map(s =>
                s._id === submissionId ? { ...s, status: currentStatus as any } : s
            ));
        }
    };

    const handleUpdateAssignment = async () => {
        if (!assignment) return;
        try {
            const res = await fetch(`/api/admin/assignments/${assignment._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editTitle,
                    deadline: new Date(editDeadline).toISOString()
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

    if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;
    if (!assignment) return <div className="p-12 text-center text-gray-400">Assignment not found</div>;

    const deadline = new Date(assignment.deadline);
    const isExpired = new Date() > deadline;

    // Counts
    const submittedCount = students.filter(s => s.submissionStatus === 'SUBMITTED' || s.submissionStatus === 'LATE_SUBMITTED').length;
    const lateCount = students.filter(s => s.submissionStatus === 'LATE_SUBMITTED').length;
    const missedCount = students.filter(s => s.submissionStatus === 'MISSED').length;
    const pendingCount = students.filter(s => s.submissionStatus === 'PENDING').length;

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto text-gray-200">
            <Toaster />

            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 sm:mb-6 transition-colors text-sm sm:text-base"
            >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                Back
            </button>

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
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-gray-400 mt-3 sm:mt-4 text-sm">
                        <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${isExpired ? 'text-red-400' : 'text-green-400'}`} />
                            <span>Due: {deadline.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })} {deadline.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
                        </div>
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
                            Submitted: {submittedCount - lateCount}
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
                            {students.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-500">
                                        No students in this batch.
                                    </td>
                                </tr>
                            ) : (
                                students.map(student => (
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
                                                <button
                                                    onClick={() => toggleStatus(student._id, student.status)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${student.status === 'CORRECTED'
                                                        ? 'bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(74,222,128,0.2)]'
                                                        : 'bg-gray-700/50 text-gray-400 border-gray-600 hover:bg-gray-700'
                                                        }`}
                                                >
                                                    {student.status === 'CORRECTED' ? 'CORRECTED' : 'PENDING'}
                                                </button>
                                            ) : (
                                                <span className="text-gray-600 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            {student.link ? (
                                                <a
                                                    href={student.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors text-white"
                                                >
                                                    View <ExternalLink className="w-3 h-3" />
                                                </a>
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
                    {students.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No students in this batch.</div>
                    ) : (
                        students.map(student => (
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
                                            <button
                                                onClick={() => toggleStatus(student._id, student.status)}
                                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all border ${student.status === 'CORRECTED'
                                                    ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                                    : 'bg-gray-700/50 text-gray-400 border-gray-600'
                                                    }`}
                                            >
                                                {student.status === 'CORRECTED' ? 'CORRECTED' : 'PENDING'}
                                            </button>
                                        )}
                                    </div>
                                    {student.link ? (
                                        <a
                                            href={student.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-medium text-white flex-shrink-0"
                                        >
                                            View <ExternalLink className="w-3 h-3" />
                                        </a>
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
        </div>
    );
}
