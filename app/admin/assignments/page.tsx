
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye, Trash2, FileText, List, Clock, AlertTriangle, CheckCircle, File, Folder, FolderPlus, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

interface Assignment {
    _id: string;
    title: string;
    type: 'PDF' | 'QUESTIONS';
    batch: string;
    deadline: string;
    submissionCount: number;
    lateCount: number;
    createdAt: string;
    folderId?: string;
}

interface AssignmentFolder {
    _id: string;
    name: string;
    createdAt: string;
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

    useEffect(() => {
        fetchData();
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
                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
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
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                            {displayedFolders.map(folder => (
                                <div
                                    key={folder._id}
                                    onClick={() => setCurrentFolder(folder)}
                                    className="bg-[#1a1f2e] border border-white/5 p-4 rounded-xl cursor-pointer hover:border-blue-500/30 hover:bg-white/5 transition-all group flex items-center gap-3"
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
                                                        <span>{assignment.submissionCount} Submitted</span>
                                                    </div>
                                                    {assignment.lateCount > 0 && (
                                                        <div className="flex items-center gap-1.5 text-orange-400">
                                                            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                            <span>{assignment.lateCount} Late</span>
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
        </div>
    );
}
