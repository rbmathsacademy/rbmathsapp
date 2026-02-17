'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, FileText, List, Save, X, CheckCircle, Shuffle } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface Question {
    _id: string;
    id: string;
    text: string;
    type: string;
    topic: string;
    subtopic: string;
    image?: string;
    marks?: number;
}

export default function CreateAssignmentPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [batch, setBatch] = useState('');
    const [deadline, setDeadline] = useState('');
    const [cooldown, setCooldown] = useState(60);
    const [type, setType] = useState<'PDF' | 'QUESTIONS'>('PDF');

    // PDF Content
    const [pdfFile, setPdfFile] = useState<string | null>(null);
    const [pdfName, setPdfName] = useState('');

    // Question Bank
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [questionsLoading, setQuestionsLoading] = useState(false);

    // Filters
    const [topicFilter, setTopicFilter] = useState('');
    const [subtopicFilter, setSubtopicFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // Random Deploy — admin selects a pool, sets N, each student gets N random Qs from pool
    const [randomDeploy, setRandomDeploy] = useState(false);
    const [randomCount, setRandomCount] = useState(5);

    // Batches from DB
    const [batches, setBatches] = useState<string[]>([]);

    useEffect(() => {
        // Fetch batches from courses API (returns string array of unique batch names)
        fetch('/api/admin/courses')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setBatches(data);
            })
            .catch(() => toast.error('Failed to load batches'));
    }, []);

    // Load questions when modal opens
    const loadQuestions = async () => {
        if (allQuestions.length > 0) {
            setIsModalOpen(true);
            return;
        }
        setQuestionsLoading(true);
        try {
            const res = await fetch('/api/admin/questions', {
                headers: { 'X-Global-Admin-Key': 'globaladmin_25' }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setAllQuestions(data);
            } else if (data.questions) {
                setAllQuestions(data.questions);
            }
        } catch (err) {
            toast.error('Failed to load questions');
        } finally {
            setQuestionsLoading(false);
            setIsModalOpen(true);
        }
    };

    // Apply filters
    useEffect(() => {
        let res = allQuestions;
        if (topicFilter) res = res.filter(q => q.topic === topicFilter);
        if (subtopicFilter) res = res.filter(q => q.subtopic === subtopicFilter);
        if (typeFilter) res = res.filter(q => q.type === typeFilter);
        setFilteredQuestions(res);
    }, [allQuestions, topicFilter, subtopicFilter, typeFilter]);

    // Unique values for filter dropdowns
    const topics = [...new Set(allQuestions.map(q => q.topic))].sort();
    const subtopics = [...new Set(
        allQuestions
            .filter(q => !topicFilter || q.topic === topicFilter)
            .map(q => q.subtopic)
    )].sort();
    const types = [...new Set(allQuestions.map(q => q.type))];

    const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
            toast.error(
                'File too large! Max 3MB. Compress your PDF at:\nhttps://www.ilovepdf.com/compress_pdf',
                { duration: 6000 }
            );
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            setPdfFile(base64);
            setPdfName(file.name);
            toast.success('PDF uploaded');
        };
        reader.readAsDataURL(file);
    };

    const handleCreate = async () => {
        if (!title.trim()) { toast.error('Please enter a title'); return; }
        if (!batch) { toast.error('Please select a batch'); return; }
        if (!deadline) { toast.error('Please set a deadline'); return; }
        if (type === 'PDF' && !pdfFile) { toast.error('Please upload a PDF'); return; }
        if (type === 'QUESTIONS' && selectedIds.size === 0) {
            toast.error('Please select at least one question');
            return;
        }
        if (type === 'QUESTIONS' && randomDeploy) {
            if (randomCount <= 0 || randomCount > selectedIds.size) {
                toast.error(`Random count must be between 1 and ${selectedIds.size}`);
                return;
            }
        }

        setLoading(true);
        setLoading(true);
        try {
            let contentStringOrArray: string | string[] = '';

            if (type === 'PDF' && pdfFile) {
                const toastId = toast.loading('Uploading PDF to Drive...');
                try {
                    const uploadRes = await fetch('/api/admin/assignments/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            batchName: batch,
                            assignmentTitle: title.trim(),
                            studentName: 'Admin',
                            phoneNumber: 'Uploads',
                            fileData: pdfFile,
                            mimeType: 'application/pdf',
                            fileName: pdfName || 'Assignment.pdf'
                        })
                    });

                    if (!uploadRes.ok) throw new Error('Upload failed');

                    const uploadData = await uploadRes.json();
                    if (uploadData.status === 'success') {
                        contentStringOrArray = uploadData.fileUrl || uploadData.downloadUrl;
                        toast.success('PDF Uploaded to Drive!', { id: toastId });
                    } else {
                        throw new Error(uploadData.message || 'Drive upload failed');
                    }
                } catch (err: any) {
                    toast.error(err.message || 'Failed to upload PDF', { id: toastId });
                    setLoading(false);
                    return;
                }
            } else {
                contentStringOrArray = Array.from(selectedIds);
            }

            const res = await fetch('/api/admin/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    batch,
                    deadline: new Date(deadline).toISOString(),
                    cooldownDuration: Number(cooldown) || 0,
                    type,
                    content: contentStringOrArray,
                    randomCount: (type === 'QUESTIONS' && randomDeploy) ? randomCount : 0
                })
            });

            if (res.ok) {
                toast.success('Assignment published!');
                router.push('/admin/assignments');
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to create');
            }
        } catch (error) {
            toast.error('Error creating assignment');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const s = new Set(selectedIds);
        if (s.has(id)) s.delete(id); else s.add(id);
        setSelectedIds(s);
    };

    const selectAllFiltered = () => {
        const s = new Set(selectedIds);
        filteredQuestions.forEach(q => s.add(q._id));
        setSelectedIds(s);
    };

    const deselectAll = () => setSelectedIds(new Set());

    const selectedQuestionsList = allQuestions.filter(q => selectedIds.has(q._id));

    return (
        <div className="p-3 sm:p-6 max-w-5xl mx-auto text-gray-200 min-h-screen pb-20">
            <Toaster />

            {/* Header */}
            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <h1 className="text-xl sm:text-2xl font-bold">Create New Assignment</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Settings */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-blue-400 mb-4">Settings</h2>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                placeholder="e.g. Linear Algebra Assignment 1"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Batch *</label>
                            <select
                                value={batch}
                                onChange={(e) => setBatch(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                            >
                                <option value="">Select Batch</option>
                                {batches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Submission Deadline *</label>
                            <input
                                type="datetime-local"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Cooldown Period (Minutes)</label>
                            <input
                                type="number"
                                value={cooldown}
                                onChange={(e) => setCooldown(Number(e.target.value))}
                                min={0}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Extra time after deadline for late submissions (marked as late).
                            </p>
                        </div>

                        {/* Random Deploy — only for QUESTIONS type */}
                        {type === 'QUESTIONS' && (
                            <div className="border-t border-white/5 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-gray-400 flex items-center gap-2">
                                        <Shuffle className="w-4 h-4 text-amber-400" />
                                        Random Deploy
                                    </label>
                                    <button
                                        onClick={() => setRandomDeploy(!randomDeploy)}
                                        className={`w-11 h-6 rounded-full transition-colors relative ${randomDeploy ? 'bg-amber-500' : 'bg-gray-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${randomDeploy ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                                {randomDeploy && (
                                    <div className="mt-2">
                                        <label className="block text-xs text-gray-500 mb-1">Questions per student</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={randomCount}
                                            onChange={(e) => setRandomCount(Number(e.target.value))}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                        />
                                        <p className="text-xs text-amber-400/70 mt-1">
                                            Each student gets {randomCount} random questions from the selected pool. Questions stay fixed once generated.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-blue-400 mb-4">Assignment Type</h2>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setType('PDF')}
                                className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'PDF'
                                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                    : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                    }`}
                            >
                                <FileText className="w-6 h-6" />
                                <span className="text-sm font-medium">PDF Upload</span>
                            </button>
                            <button
                                onClick={() => setType('QUESTIONS')}
                                className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'QUESTIONS'
                                    ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                    : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                    }`}
                            >
                                <List className="w-6 h-6" />
                                <span className="text-sm font-medium">Question Bank</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Content */}
                <div className="lg:col-span-2">
                    <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-6 min-h-[500px]">
                        <h2 className="text-lg font-semibold text-white mb-6">Content</h2>

                        {type === 'PDF' ? (
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl p-12 hover:border-blue-500/50 transition-colors">
                                <Upload className="w-12 h-12 text-gray-500 mb-4" />
                                <p className="text-gray-300 font-medium mb-2">Upload Assignment PDF</p>
                                <p className="text-gray-500 text-sm mb-1">Max size: 3MB</p>
                                <p className="text-gray-600 text-xs mb-4">If larger, compress at <a href="https://www.ilovepdf.com/compress_pdf" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">ilovepdf.com</a></p>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handlePdfUpload}
                                    className="hidden"
                                    id="pdf-upload"
                                />
                                <label
                                    htmlFor="pdf-upload"
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer transition-colors"
                                >
                                    Select PDF
                                </label>
                                {pdfFile && (
                                    <div className="mt-4 flex items-center gap-2 text-green-400 bg-green-500/10 px-4 py-2 rounded-lg">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>{pdfName || 'PDF Ready'}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="text-gray-400">
                                        <span className="text-white font-bold text-xl">{selectedIds.size}</span> Questions Selected
                                    </div>
                                    <button
                                        onClick={loadQuestions}
                                        disabled={questionsLoading}
                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {questionsLoading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                                        )}
                                        Import Questions
                                    </button>
                                </div>

                                {selectedIds.size === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        No questions selected. Click &quot;Import Questions&quot; to pick from your Question Bank.
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                        {selectedQuestionsList.map((q, i) => (
                                            <div key={q._id} className="bg-black/20 p-4 rounded-lg border border-white/5 relative group">
                                                <button
                                                    onClick={() => toggleSelection(q._id)}
                                                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <div className="flex gap-3">
                                                    <span className="text-gray-500 font-mono text-sm">{i + 1}.</span>
                                                    <div className="flex-1">
                                                        <div className="flex gap-2 mb-1">
                                                            <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-400">{q.topic}</span>
                                                            <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-400">{q.type}</span>
                                                            {q.marks && <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-400">{q.marks}M</span>}
                                                        </div>
                                                        <Latex>{q.text}</Latex>
                                                        {q.image && (
                                                            <img src={`data:image/png;base64,${q.image}`} alt="Q" className="mt-2 max-h-32 rounded border border-white/10" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleCreate}
                            disabled={loading}
                            className={`flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-medium text-lg shadow-lg shadow-green-900/20 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Publishing...' : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Publish Assignment
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Question Selection Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-[#1a1f2e] w-full max-w-5xl h-[95vh] sm:h-[85vh] rounded-2xl border border-white/10 flex flex-col shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Import from Question Bank</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="p-3 sm:p-4 border-b border-white/5 bg-black/20 space-y-3">
                            <div className="flex gap-2 sm:gap-3 flex-wrap">
                                <select
                                    value={topicFilter}
                                    onChange={(e) => { setTopicFilter(e.target.value); setSubtopicFilter(''); }}
                                    className="bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none min-w-[150px]"
                                >
                                    <option value="">All Topics</option>
                                    {topics.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select
                                    value={subtopicFilter}
                                    onChange={(e) => setSubtopicFilter(e.target.value)}
                                    className="bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none min-w-[150px]"
                                >
                                    <option value="">All Sub-Topics</option>
                                    {subtopics.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none min-w-[120px]"
                                >
                                    <option value="">All Types</option>
                                    {types.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2 sm:gap-3 items-center flex-wrap">
                                <button onClick={selectAllFiltered} className="px-4 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-sm border border-blue-500/30">
                                    Select All ({filteredQuestions.length})
                                </button>
                                <button onClick={deselectAll} className="px-4 py-1.5 bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded-lg text-sm border border-red-500/20">
                                    Deselect All
                                </button>
                                <span className="ml-auto text-xs sm:text-sm text-gray-400">
                                    {filteredQuestions.length} of {allQuestions.length} &bull; {selectedIds.size} selected
                                </span>
                            </div>
                        </div>

                        {/* Questions List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {filteredQuestions.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">No questions match your filters.</div>
                            ) : (
                                filteredQuestions.map(q => (
                                    <div
                                        key={q._id}
                                        onClick={() => toggleSelection(q._id)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedIds.has(q._id)
                                            ? 'bg-blue-500/10 border-blue-500/50'
                                            : 'bg-black/20 border-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex gap-4">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${selectedIds.has(q._id) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
                                                }`}>
                                                {selectedIds.has(q._id) && (
                                                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex gap-2 mb-1.5 flex-wrap">
                                                    <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-400">{q.topic}</span>
                                                    <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-400">{q.subtopic}</span>
                                                    <span className="text-xs bg-purple-500/10 px-2 py-0.5 rounded text-purple-400">{q.type}</span>
                                                </div>
                                                <div className="text-sm text-gray-200"><Latex>{q.text}</Latex></div>
                                                {q.image && (
                                                    <img src={`data:image/png;base64,${q.image}`} alt="Q" className="mt-2 max-h-24 rounded border border-white/10" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 sm:p-4 border-t border-white/10 flex justify-between items-center bg-black/20">
                            <span className="text-gray-400 font-medium">{selectedIds.size} questions selected</span>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
