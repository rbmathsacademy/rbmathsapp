'use client';

import { useState, useEffect } from 'react';
import { Folder as FolderIcon, Plus, FileText, ChevronRight, LayoutGrid, Trash2, ArrowLeft, Filter, CheckSquare, Square } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import MultiSelect from '../components/MultiSelect';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface Course {
    name: string;
}

interface Folder {
    _id: string;
    name: string;
    course: string;
    createdAt: string;
}

interface Question {
    _id: string;
    text: string;
    type: string;
    topic: string;
    subtopic: string;
    examNames?: string[];
    marks?: number;
}

export default function DeployPage() {
    const [courses, setCourses] = useState<string[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [deployedQuestions, setDeployedQuestions] = useState<Question[]>([]);

    const [loadingCourses, setLoadingCourses] = useState(true);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    const [newFolderName, setNewFolderName] = useState('');
    const [showFolderModal, setShowFolderModal] = useState(false);

    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Question Picker State
    const [showQuestionPicker, setShowQuestionPicker] = useState(false);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [loadingPicker, setLoadingPicker] = useState(false);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

    // Filters
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUserEmail(JSON.parse(storedUser).email);
        }
        fetchCourses();
    }, []);

    useEffect(() => {
        if (selectedCourse) {
            fetchFolders(selectedCourse);
            setSelectedFolder(null);
        }
    }, [selectedCourse]);

    useEffect(() => {
        if (selectedFolder) {
            fetchDeployedQuestions(selectedFolder._id);
        }
    }, [selectedFolder]);

    const fetchCourses = async () => {
        try {
            const res = await fetch('/api/admin/courses');
            const data = await res.json();
            setCourses(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error('Failed to load courses');
        } finally {
            setLoadingCourses(false);
        }
    };

    const fetchFolders = async (course: string) => {
        setLoadingFolders(true);
        try {
            const res = await fetch(`/api/admin/folders?course=${encodeURIComponent(course)}`);
            const data = await res.json();
            setFolders(data);
        } catch (e) {
            toast.error('Failed to load folders');
        } finally {
            setLoadingFolders(false);
        }
    };

    const createFolder = async () => {
        if (!process.env.NEXT_PUBLIC_API_URL && !newFolderName.trim()) return;
        try {
            const res = await fetch('/api/admin/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newFolderName, course: selectedCourse })
            });
            if (res.ok) {
                toast.success('Folder created');
                setNewFolderName('');
                setShowFolderModal(false);
                fetchFolders(selectedCourse!);
            } else {
                toast.error('Failed to create folder');
            }
        } catch (e) {
            toast.error('Error creating folder');
        }
    };

    const deleteFolder = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this folder?')) return;
        try {
            const res = await fetch(`/api/admin/folders?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Folder deleted');
                fetchFolders(selectedCourse!);
            }
        } catch (e) { toast.error('Error deleting folder'); }
    };

    const fetchDeployedQuestions = async (folderId: string) => {
        setLoadingQuestions(true);
        try {
            const res = await fetch(`/api/admin/deploy?folderId=${folderId}`);
            const data = await res.json();
            setDeployedQuestions(data as Question[]);
        } catch (e) {
            toast.error('Failed to load questions');
        } finally {
            setLoadingQuestions(false);
        }
    };

    const openQuestionPicker = async () => {
        if (!userEmail) {
            toast.error("User not found. Please login again.");
            return;
        }

        setShowQuestionPicker(true);
        setLoadingPicker(true);

        try {
            const res = await fetch('/api/admin/questions', {
                headers: { 'X-User-Email': userEmail }
            });

            const data = await res.json();
            if (Array.isArray(data)) setAllQuestions(data);
            else if (data.questions) setAllQuestions(data.questions);
            else setAllQuestions([]);
        } catch (e) {
            toast.error('Failed to load question bank');
        } finally {
            setLoadingPicker(false);
        }
    };

    const deployQuestions = async () => {
        try {
            const res = await fetch('/api/admin/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionIds: selectedQuestionIds,
                    courseId: selectedCourse,
                    folderId: selectedFolder?._id
                })
            });
            if (res.ok) {
                toast.success('Questions deployed');
                setShowQuestionPicker(false);
                setSelectedQuestionIds([]);
                fetchDeployedQuestions(selectedFolder!._id);
            } else {
                toast.error('Failed to deploy');
            }
        } catch (e) {
            toast.error('Error deploying');
        }
    };

    const toggleQuestionSelection = (id: string) => {
        setSelectedQuestionIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Filter logic
    const topics = Array.from(new Set(allQuestions.map(q => q.topic))).filter(Boolean).sort();

    const subtopics = Array.from(new Set(
        allQuestions
            .filter(q => selectedTopics.length === 0 || selectedTopics.includes(q.topic))
            .map(q => q.subtopic)
    )).filter(Boolean).sort();

    const filteredQuestions = allQuestions.filter(q => {
        if (selectedTopics.length > 0 && !selectedTopics.includes(q.topic)) return false;
        if (selectedSubtopics.length > 0 && !selectedSubtopics.includes(q.subtopic)) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                q.text.toLowerCase().includes(query) ||
                (q.type && q.type.toLowerCase().includes(query))
            );
        }
        return true;
    });

    const toggleSelectAll = () => {
        const allIds = filteredQuestions.map(q => q._id);
        const allSelected = allIds.every(id => selectedQuestionIds.includes(id));

        if (allSelected) {
            // Deselect all visible
            setSelectedQuestionIds(prev => prev.filter(id => !allIds.includes(id)));
        } else {
            // Select all visible
            const newIds = [...selectedQuestionIds];
            allIds.forEach(id => {
                if (!newIds.includes(id)) newIds.push(id);
            });
            setSelectedQuestionIds(newIds);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto text-slate-200 font-sans">
            <Toaster />
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Deploy Questions</h1>
                    <p className="text-slate-400">Manage course content and distribute questions.</p>
                </div>
            </div>

            {!selectedCourse ? (
                // Course List View
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loadingCourses ? (
                        <div className="text-center col-span-full py-12 text-slate-500">Loading courses...</div>
                    ) : courses.length === 0 ? (
                        <div className="text-center col-span-full py-12 text-slate-500">
                            No courses found in the Google Sheet.
                        </div>
                    ) : (
                        courses.map(course => (
                            <div
                                key={course}
                                onClick={() => setSelectedCourse(course)}
                                className="bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-indigo-500/50 p-6 rounded-2xl cursor-pointer transition-all group"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                        <LayoutGrid className="h-6 w-6" />
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-indigo-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{course}</h3>
                                <p className="text-sm text-slate-500">Click to manage folders</p>
                            </div>
                        ))
                    )}
                </div>
            ) : !selectedFolder ? (
                // Folder View
                <div>
                    <button onClick={() => setSelectedCourse(null)} className="mb-6 flex items-center text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Courses
                    </button>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-white">{selectedCourse} <span className="text-slate-500 text-lg font-normal">/ Folders</span></h2>
                        <button
                            onClick={() => setShowFolderModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium"
                        >
                            <Plus className="h-4 w-4" /> New Folder
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {loadingFolders ? (
                            <div className="text-center col-span-full py-12 text-slate-500">Loading folders...</div>
                        ) : folders.length === 0 ? (
                            <div className="col-span-full bg-slate-800/20 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
                                <FolderIcon className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400 mb-2">No folders yet</p>
                                <p className="text-sm text-slate-500">Create a folder to start organizing questions</p>
                            </div>
                        ) : (
                            folders.map(folder => (
                                <div
                                    key={folder._id}
                                    onClick={() => setSelectedFolder(folder)}
                                    className="bg-slate-800/40 hover:bg-slate-800 border border-white/5 hover:border-indigo-500/50 p-5 rounded-2xl cursor-pointer transition-all group relative"
                                >
                                    <button
                                        onClick={(e) => deleteFolder(folder._id, e)}
                                        className="absolute top-3 right-3 p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    <FolderIcon className="h-10 w-10 text-indigo-400 mb-4 group-hover:scale-110 transition-transform" />
                                    <h3 className="font-bold text-white truncate">{folder.name}</h3>
                                    <p className="text-xs text-slate-500 mt-1">{new Date(folder.createdAt).toLocaleDateString()}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                // Question View (Inside Folder)
                <div>
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={() => setSelectedFolder(null)} className="flex items-center text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Folders
                        </button>
                        <div className="h-4 w-[1px] bg-slate-700"></div>
                        <span className="text-slate-500">{selectedCourse}</span>
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                        <span className="text-white font-medium">{selectedFolder.name}</span>
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-white">Questions</h2>
                        <button
                            onClick={openQuestionPicker}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-lg shadow-indigo-500/20"
                        >
                            <Plus className="h-4 w-4" /> Add Questions
                        </button>
                    </div>

                    <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
                        {loadingQuestions ? (
                            <div className="p-8 text-center text-slate-500">Loading questions...</div>
                        ) : deployedQuestions.length === 0 ? (
                            <div className="p-12 text-center">
                                <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400">This folder is empty</p>
                                <button onClick={openQuestionPicker} className="text-indigo-400 hover:text-indigo-300 text-sm mt-2 font-medium">Browse Question Bank</button>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {deployedQuestions.map((q, i) => (
                                    <div key={i} className="p-4 hover:bg-slate-800/30 transition-colors flex gap-4">
                                        <div className="flex-shrink-0 pt-1">
                                            <div className="h-6 w-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-medium text-slate-400">
                                                {i + 1}
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-slate-300 text-sm mb-1 line-clamp-2 prose prose-invert prose-sm max-w-none">
                                                <Latex>{q.text}</Latex>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${q.type === 'broad' ? 'border-pink-500 text-pink-400' : q.type === 'mcq' ? 'border-yellow-500 text-yellow-400' : 'border-cyan-500 text-cyan-400'}`}>
                                                    {q.type}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400 border border-slate-700">{q.topic}</span>
                                                {q.examNames && q.examNames.length > 0 && q.examNames.map((exam, idx) => (
                                                    <span key={idx} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] px-2 py-0.5 rounded font-bold shadow-sm">
                                                        {exam}
                                                    </span>
                                                ))}
                                                {q.marks && (
                                                    <span className="bg-gradient-to-r from-emerald-600 to-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold shadow-sm">
                                                        {q.marks} marks
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Folder Modal */}
            {showFolderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 rounded-xl border border-white/10 p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Create New Folder</h3>
                        <input
                            type="text"
                            placeholder="Folder Name (e.g., Week 1, Algebra Basics)"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none mb-6"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowFolderModal(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createFolder}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Question Picker Modal */}
            {showQuestionPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 rounded-xl border border-white/10 w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center flex-shrink-0">
                            <h3 className="text-xl font-bold text-white">Select Questions</h3>
                            <button onClick={() => setShowQuestionPicker(false)} className="text-slate-400 hover:text-white">
                                <Plus className="h-6 w-6 rotate-45" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-white/10 bg-slate-900/50 flex flex-col gap-4 flex-shrink-0">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs text-slate-400 mb-1 block">Topics</label>
                                    <MultiSelect
                                        options={topics}
                                        selected={selectedTopics}
                                        onChange={setSelectedTopics}
                                        placeholder="All Topics"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-slate-400 mb-1 block">Subtopics</label>
                                    <MultiSelect
                                        options={subtopics}
                                        selected={selectedSubtopics}
                                        onChange={setSelectedSubtopics}
                                        placeholder="All Subtopics"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 items-center">
                                <input
                                    type="text"
                                    placeholder="Search questions..."
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <button
                                    onClick={toggleSelectAll}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700 flex items-center gap-2"
                                >
                                    {filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestionIds.includes(q._id)) ?
                                        <><CheckSquare className="h-4 w-4" /> Deselect All ({filteredQuestions.length})</> :
                                        <><Square className="h-4 w-4" /> Select All ({filteredQuestions.length})</>
                                    }
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {/* ... list ... */}
                            {loadingPicker ? (
                                <div className="text-center py-10 text-slate-500">Loading questions...</div>
                            ) : filteredQuestions.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">No questions found matching your filter.</div>
                            ) : (
                                filteredQuestions.map(q => (
                                    <div
                                        key={q._id}
                                        onClick={() => toggleQuestionSelection(q._id)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all flex gap-4 ${selectedQuestionIds.includes(q._id)
                                            ? 'bg-indigo-500/10 border-indigo-500/50'
                                            : 'bg-slate-950/50 border-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        <div className={`h-6 w-6 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${selectedQuestionIds.includes(q._id) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-600'
                                            }`}>
                                            {selectedQuestionIds.includes(q._id) && <Plus className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-slate-300 text-sm mb-1 line-clamp-2 prose prose-invert prose-sm max-w-none">
                                                <Latex>{q.text}</Latex>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">{q.topic}</span>
                                                {q.examNames && q.examNames.length > 0 && q.examNames.map((exam, idx) => (
                                                    <span key={idx} className="bg-purple-900/30 text-purple-300 text-[10px] px-1.5 py-0.5 rounded border border-purple-500/20">
                                                        {exam}
                                                    </span>
                                                ))}
                                                {q.marks && (
                                                    <span className="bg-green-900/30 text-green-300 text-[10px] px-1.5 py-0.5 rounded border border-green-500/20">
                                                        {q.marks}m
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-6 border-t border-white/10 flex justify-between items-center bg-slate-900 flex-shrink-0">
                            <span className="text-slate-400 text-sm">{selectedQuestionIds.length} selected</span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowQuestionPicker(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={deployQuestions}
                                    disabled={selectedQuestionIds.length === 0}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add to Folder
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
