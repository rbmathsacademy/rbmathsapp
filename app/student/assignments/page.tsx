'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertTriangle, Upload, FileText, ExternalLink, XCircle, ArrowLeft } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useStudentProfile } from '../StudentProfileContext';

interface Assignment {
    _id: string;
    title: string;
    type: 'PDF' | 'QUESTIONS';
    batch: string;
    content: any;
    deadline: string;
    cooldownDuration: number;
    cooldownEndDate: string;
    status: 'PENDING' | 'LATE_ALLOWED' | 'SUBMITTED' | 'LATE_SUBMITTED' | 'CLOSED';
    submissionLink?: string;
    correctionStatus: 'PENDING' | 'CORRECTED';
}

type TabType = 'PENDING' | 'COMPLETED' | 'MISSED';


export default function StudentAssignmentsPage() {
    const router = useRouter();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('PENDING');
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const { profile, loading: profileLoading } = useStudentProfile();

    useEffect(() => {
        fetchAssignments();
    }, []);

    const fetchAssignments = async () => {
        try {
            const res = await fetch('/api/student/assignments');
            if (!res.ok) {
                if (res.status === 401) {
                    toast.error('Session expired. Please login again.');
                    return;
                }
                throw new Error('Failed to fetch');
            }
            const data = await res.json();
            if (data.assignments) {
                setAssignments(data.assignments);
            }
        } catch (error) {
            toast.error('Failed to load assignments');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (assignment: Assignment, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error('Only PDF files are allowed');
            e.target.value = '';
            return;
        }

        if (file.size > 3 * 1024 * 1024) {
            toast.error('File too large (Max 3MB). Compress at ilovepdf.com', { duration: 5000 });
            e.target.value = '';
            return;
        }

        setUploadingId(assignment._id);
        const toastId = toast.loading('Uploading to Google Drive...');

        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });

            const payload = {
                batchName: assignment.batch || profile?.courses?.[0] || 'General',
                assignmentTitle: assignment.title,
                studentName: profile?.studentName || 'Unknown',
                phoneNumber: profile?.phoneNumber || 'Unknown',
                fileData: base64,
                mimeType: 'application/pdf',
                fileName: `${profile?.studentName || 'Student'}_${profile?.phoneNumber || 'NA'}.pdf`
            };

            const gasRes = await fetch('/api/student/assignments/upload-to-drive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const gasData = await gasRes.json();

            if (gasData.status === 'success') {
                const driveLink = gasData.fileUrl || gasData.downloadUrl;
                const subRes = await fetch('/api/student/assignments/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assignmentId: assignment._id, driveLink })
                });

                const subData = await subRes.json();
                if (subRes.ok) {
                    toast.success('Assignment submitted successfully!', { id: toastId });
                    fetchAssignments();
                } else {
                    toast.error(subData.error || 'Failed to save submission', { id: toastId });
                }
            } else {
                throw new Error(gasData.message || 'Google Drive upload failed');
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Upload failed. Please try again.', { id: toastId });
        } finally {
            setUploadingId(null);
            e.target.value = '';
        }
    };

    const openAssignment = (assignment: Assignment) => {
        if (assignment.type === 'QUESTIONS') {
            router.push(`/student/assignments/${assignment._id}`);
        } else {
            // Check if content is a URL
            if (typeof assignment.content === 'string' && assignment.content.startsWith('http')) {
                window.open(assignment.content, '_blank', 'noopener,noreferrer');
            } else if (assignment.content && !assignment.content.startsWith('http')) {
                // Backward compatibility for base64 content
                fetchAndOpenPdf(assignment._id);
            } else {
                toast.error('Assignment content not available');
            }
        }
    };

    const fetchAndOpenPdf = async (id: string) => {
        const toastId = toast.loading('Loading PDF...');
        try {
            const res = await fetch(`/api/student/assignments/${id}/pdf`);
            if (!res.ok) throw new Error('Failed to load PDF');
            const data = await res.json();
            if (data.content) {
                const blob = base64ToBlob(data.content, 'application/pdf');
                const url = URL.createObjectURL(blob);
                window.location.href = url;
                toast.dismiss(toastId);
            } else {
                toast.error('PDF content not available', { id: toastId });
            }
        } catch (err) {
            toast.error('Failed to load PDF', { id: toastId });
        }
    };

    const base64ToBlob = (b64: string, type: string) => {
        const bytes = atob(b64);
        const buf = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
        return new Blob([buf], { type });
    };

    // Tab Filters:
    // Pending = PENDING + LATE_ALLOWED (can still submit)
    // Completed = SUBMITTED + LATE_SUBMITTED (has submitted)
    // Missed = CLOSED (deadline + cooldown expired, never submitted)
    const pendingAssignments = assignments.filter(a => ['PENDING', 'LATE_ALLOWED'].includes(a.status));
    const completedAssignments = assignments.filter(a => ['SUBMITTED', 'LATE_SUBMITTED'].includes(a.status));
    const missedAssignments = assignments.filter(a => a.status === 'CLOSED');

    const getDisplayed = () => {
        if (activeTab === 'PENDING') return pendingAssignments;
        if (activeTab === 'COMPLETED') return completedAssignments;
        return missedAssignments;
    };
    const displayedAssignments = getDisplayed();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 pb-24 max-w-4xl mx-auto min-h-screen text-gray-200">
            <Toaster position="top-center" />

            {/* Back Button */}
            <button
                onClick={() => router.push('/student')}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
            </button>

            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
                My Assignments
            </h1>

            {/* 3 Tabs */}
            <div className="flex bg-[#1a1f2e] p-1 rounded-xl mb-6 border border-white/5">
                <button
                    onClick={() => setActiveTab('PENDING')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'PENDING'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Pending ({pendingAssignments.length})
                </button>
                <button
                    onClick={() => setActiveTab('COMPLETED')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'COMPLETED'
                        ? 'bg-green-600 text-white shadow-lg shadow-green-900/20'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Completed ({completedAssignments.length})
                </button>
                <button
                    onClick={() => setActiveTab('MISSED')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'MISSED'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Missed ({missedAssignments.length})
                </button>
            </div>

            {/* Assignment List */}
            <div className="space-y-4">
                {displayedAssignments.map(assignment => (
                    <AssignmentCard
                        key={assignment._id}
                        assignment={assignment}
                        uploadingId={uploadingId}
                        onUpload={handleFileUpload}
                        onOpen={() => openAssignment(assignment)}
                    />
                ))}

                {displayedAssignments.length === 0 && (
                    <div className="text-center py-12 text-gray-500 bg-[#1a1f2e] rounded-xl border border-white/5">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>
                            {activeTab === 'PENDING' && 'No pending assignments'}
                            {activeTab === 'COMPLETED' && 'No completed assignments yet'}
                            {activeTab === 'MISSED' && 'No missed assignments — great!'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function AssignmentCard({
    assignment,
    uploadingId,
    onUpload,
    onOpen
}: {
    assignment: Assignment;
    uploadingId: string | null;
    onUpload: (a: Assignment, e: React.ChangeEvent<HTMLInputElement>) => void;
    onOpen: () => void;
}) {
    const isLateAllowed = assignment.status === 'LATE_ALLOWED';
    const isClosed = assignment.status === 'CLOSED';
    const isSubmitted = assignment.status === 'SUBMITTED' || assignment.status === 'LATE_SUBMITTED';
    const isLateSubmitted = assignment.status === 'LATE_SUBMITTED';

    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (isSubmitted || isClosed) return;

        const target = isLateAllowed ? new Date(assignment.cooldownEndDate) : new Date(assignment.deadline);
        let timerId: ReturnType<typeof setInterval>;
        const tick = () => {
            const now = new Date();
            const diff = target.getTime() - now.getTime();
            if (diff <= 0) {
                setTimeLeft('Time\'s Up');
                clearInterval(timerId);
            } else {
                const d = Math.floor(diff / 86400000);
                const h = Math.floor((diff % 86400000) / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
                else setTimeLeft(`${h}h ${m}m ${s}s`);
            }
        };
        tick();
        timerId = setInterval(tick, 1000);
        return () => clearInterval(timerId);
    }, [assignment.deadline, assignment.cooldownEndDate, isLateAllowed, isSubmitted, isClosed]);

    const deadlineDate = new Date(assignment.deadline);

    return (
        <div className={`bg-[#1a1f2e] border rounded-xl overflow-hidden transition-all ${isLateAllowed ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' :
            isSubmitted ? 'border-green-500/20' :
                isClosed ? 'border-red-500/10 opacity-70' :
                    'border-white/5 hover:border-blue-500/30'
            }`}>
            <div className="p-5">
                {/* Top Row */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${assignment.type === 'PDF' ? 'bg-red-500/10' : 'bg-purple-500/10'
                            }`}>
                            <FileText className={`w-5 h-5 ${assignment.type === 'PDF' ? 'text-red-400' : 'text-purple-400'
                                }`} />
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-gray-400">
                            {assignment.batch}
                        </span>
                    </div>


                    {/* Status Badge */}
                    {isSubmitted && (
                        <div className="flex flex-col items-end gap-1">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${isLateSubmitted
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                }`}>
                                <CheckCircle className="w-3.5 h-3.5" />
                                {isLateSubmitted ? 'Late Submitted' : 'Completed'}
                            </span>
                            <span className={`text-[10px] font-bold px-1 ${assignment.correctionStatus === 'CORRECTED'
                                ? 'text-green-400 animate-pulse'
                                : 'text-gray-500'
                                }`}>
                                Status: {assignment.correctionStatus === 'CORRECTED' ? 'Corrected' : 'Not Corrected'}
                            </span>
                        </div>
                    )}
                    {isClosed && (
                        <span className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold flex items-center gap-1.5 border border-red-500/20">
                            <XCircle className="w-3.5 h-3.5" />
                            Missed
                        </span>
                    )}
                    {!isSubmitted && !isClosed && (
                        <div className="text-right">
                            <p className="text-[10px] text-gray-500 mb-0.5">
                                {isLateAllowed ? 'Cooldown Remaining' : 'Time Remaining'}
                            </p>
                            <div className={`font-mono text-sm font-bold tracking-wide ${isLateAllowed ? 'text-red-400' : 'text-white'
                                }`}>
                                {timeLeft || '...'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Title & Deadline */}
                <h3 className="text-lg font-bold text-white mb-1">{assignment.title}</h3>
                <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Due: {deadlineDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {deadlineDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* Late Warning */}
                {isLateAllowed && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-xs text-red-200">
                            Deadline passed! You are in the cooldown period.
                            Submit now — your assignment will be marked as <b>LATE</b>.
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    {/* View Button */}
                    <button
                        onClick={onOpen}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors border border-white/5"
                    >
                        View Assignment
                    </button>

                    {/* Upload / View Submission / Missed */}
                    {isSubmitted ? (
                        <a
                            href={assignment.submissionLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg text-sm font-medium transition-colors border border-green-500/30 flex items-center justify-center gap-2"
                        >
                            View Submission <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    ) : isClosed ? (
                        <button disabled className="flex-1 py-2.5 bg-red-900/20 text-red-400/60 rounded-lg text-sm font-medium cursor-not-allowed border border-red-500/10">
                            Missed
                        </button>
                    ) : (
                        <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors shadow-lg ${isLateAllowed
                            ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/20'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                            } ${uploadingId === assignment._id ? 'opacity-70 pointer-events-none' : ''}`}>
                            {uploadingId === assignment._id ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            {uploadingId === assignment._id ? 'Uploading...' : 'Upload PDF'}
                            <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={(e) => onUpload(assignment, e)}
                                disabled={!!uploadingId}
                            />
                        </label>
                    )}
                </div>
            </div>
        </div>
    );
}
