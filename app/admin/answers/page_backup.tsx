'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Copy, Save, Database, Filter, Upload, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import MultiSelect from '../components/MultiSelect';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface Question {
    id: string;
    text: string;
    type: string;
    topic: string;
    subtopic: string;
    answer?: string;
    hint?: string;
    explanation?: string;
    image?: string;
}

export default function AnswerBank() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

    // Filters
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);

    // Bulk Import Modal
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importJson, setImportJson] = useState('');

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        try {
            const storedUser = localStorage.getItem('user');
            const user = storedUser ? JSON.parse(storedUser) : null;
            const headers: any = {};
            if (user && user.email) {
                headers['X-User-Email'] = user.email;
            }

            const res = await fetch('/api/admin/questions', { headers });
            const data = await res.json();
            if (Array.isArray(data)) {
                setQuestions(data);
            }
        } catch (error) {
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const topics = useMemo(() => Array.from(new Set(questions.map(q => q.topic))).filter(Boolean).sort(), [questions]);
    const subtopics = useMemo(() => {
        let filtered = questions;
        if (selectedTopics.length > 0) {
            filtered = filtered.filter(q => selectedTopics.includes(q.topic));
        }
        return Array.from(new Set(filtered.map(q => q.subtopic))).filter(Boolean).sort();
    }, [questions, selectedTopics]);

    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            if (selectedTopics.length > 0 && !selectedTopics.includes(q.topic)) return false;
            if (selectedSubtopics.length > 0 && !selectedSubtopics.includes(q.subtopic)) return false;
            return true;
        });
    }, [questions, selectedTopics, selectedSubtopics]);

    // Selection Logic
    const toggleSelection = (id: string) => {
        const next = new Set(selectedQuestionIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedQuestionIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedQuestionIds.size === filteredQuestions.length) {
            setSelectedQuestionIds(new Set());
        } else {
            setSelectedQuestionIds(new Set(filteredQuestions.map(q => q.id)));
        }
    };

    // Handlers
    const handleFieldChange = (index: number, field: keyof Question, value: string) => {
        const updated = [...questions];
        // Find the index in global state that matches the filtered item
        const qId = filteredQuestions[index].id;
        const globalIndex = updated.findIndex(q => q.id === qId);

        if (globalIndex !== -1) {
            updated[globalIndex] = { ...updated[globalIndex], [field]: value };
            setQuestions(updated);
        }
    };

    const saveChanges = async (q: Question) => {
        try {
            const res = await fetch('/api/admin/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions: [q] }) // Re-using existing route which accepts array
            });
            if (!res.ok) throw new Error('Failed to save');
            toast.success('Saved!');
        } catch (error) {
            toast.error('Save failed');
        }
    };

    const copyForAI = () => {
        const selected = questions.filter(q => selectedQuestionIds.has(q.id));
        if (selected.length === 0) {
            toast.error('No questions selected');
            return;
        }

        const prompt = {
            instruction: "Provide 'answer', 'hint', and 'explanation' for these questions. Return valid JSON array preserving 'id'.",
            questions: selected.map(q => ({
                id: q.id,
                text: q.text,
                topic: q.topic,
                subtopic: q.subtopic
            }))
        };

        navigator.clipboard.writeText(JSON.stringify(prompt, null, 2));
        toast.success(`Copied ${selected.length} questions for AI!`);
    };

    const handleImport = async () => {
        try {
            const parsed = JSON.parse(importJson);
            if (!Array.isArray(parsed)) throw new Error('Invalid JSON Array');

            // Merge logic
            const updatedQuestions = [...questions];
            let updateCount = 0;

            parsed.forEach((imported: any) => {
                const idx = updatedQuestions.findIndex(q => q.id === imported.id);
                if (idx !== -1) {
                    if (imported.answer) updatedQuestions[idx].answer = imported.answer;
                    if (imported.hint) updatedQuestions[idx].hint = imported.hint;
                    if (imported.explanation) updatedQuestions[idx].explanation = imported.explanation;
                    updateCount++;
                }
            });

            setQuestions(updatedQuestions);

            // Save to DB in bulk
            const res = await fetch('/api/admin/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions: updatedQuestions.filter(q => parsed.find((p: any) => p.id === q.id)) })
            });

            if (!res.ok) throw new Error('Failed to save to database');

            toast.success(`Imported and saved ${updateCount} updates!`);
            setIsImportModalOpen(false);
            setImportJson('');
            setSelectedQuestionIds(new Set()); // Clear selection
        } catch (error: any) {
            toast.error(error.message || 'Import failed');
        }
    };

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-950 text-white font-sans selection:bg-purple-500/30">
            {/* Header */}
            <header className="flex justify-between items-center px-6 py-4 bg-gray-900 border-b border-gray-800 shadow-sm relative z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-500/20">
                        <Database className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            Answer Bank
                        </h1>
                        <p className="text-xs text-gray-500 font-medium">Manage Answers, Hints & Explanations</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={copyForAI}
                        disabled={selectedQuestionIds.size === 0}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        <Copy className="h-4 w-4" /> Copy for AI ({selectedQuestionIds.size})
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                    >
                        <Upload className="h-4 w-4" /> Import Answers
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div className="bg-gray-900 border-b border-gray-800 p-4 flex gap-4 items-center overflow-x-auto">
                <div className="flex items-center gap-2 text-gray-400">
                    <Filter className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Filters:</span>
                </div>
                <div className="w-64">
                    <MultiSelect
                        options={topics}
                        selected={selectedTopics}
                        onChange={setSelectedTopics}
                        placeholder="Filter by Topic"
                    />
                </div>
                <div className="w-64">
                    <MultiSelect
                        options={subtopics}
                        selected={selectedSubtopics}
                        onChange={setSelectedSubtopics}
                        placeholder="Filter by Subtopic"
                    />
                </div>
            </div>

            {/* Bulk Actions Bar */}
            <div className="bg-gray-800 border-b border-gray-700 px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={filteredQuestions.length > 0 && selectedQuestionIds.size === filteredQuestions.length}
                        onChange={toggleSelectAll}
                        className="w-5 h-5 rounded border-gray-600 text-purple-600 bg-gray-900 focus:ring-purple-500 cursor-pointer"
                        title="Select All"
                    />
                    <span className="text-sm text-gray-400 font-medium">Select All ({filteredQuestions.length})</span>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                    Showing {filteredQuestions.length} questions
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    </div>
                ) : filteredQuestions.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        No questions found matching your filters.
                    </div>
                ) : (
                    filteredQuestions.map((q, i) => (
                        <div key={q.id} className={`bg-gray-900 rounded-lg border transition-all duration-200 ${selectedQuestionIds.has(q.id) ? 'border-purple-500/50 shadow-purple-500/10 shadow-lg' : 'border-gray-800 hover:border-gray-700'}`}>
                            {/* Question Header */}
                            <div className="p-4 border-b border-gray-800 flex gap-4">
                                <input
                                    type="checkbox"
                                    checked={selectedQuestionIds.has(q.id)}
                                    onChange={() => toggleSelection(q.id)}
                                    className="mt-1 w-5 h-5 rounded border-gray-600 text-purple-600 bg-gray-800 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <div className="flex gap-2 mb-2">
                                        <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{q.topic}</span>
                                        <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{q.subtopic}</span>
                                    </div>
                                    <div className="text-sm text-gray-200 prose prose-invert max-w-none">
                                        <Latex>{q.text}</Latex>
                                    </div>
                                </div>
                            </div>

                            {/* Edit Fields */}
                            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-950/50">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Answer Key / Text</label>
                                    <textarea
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-green-400 font-mono min-h-[80px] focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-all placeholder-gray-700"
                                        placeholder="Enter correct answer..."
                                        value={q.answer || ''}
                                        onChange={(e) => handleFieldChange(i, 'answer', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Hint</label>
                                    <textarea
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-yellow-400 min-h-[80px] focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50 transition-all placeholder-gray-700"
                                        placeholder="Enter hint for students..."
                                        value={q.hint || ''}
                                        onChange={(e) => handleFieldChange(i, 'hint', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1 relative group">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Explanation (Detailed)</label>
                                        <button
                                            onClick={() => saveChanges(q)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] flex items-center gap-1"
                                        >
                                            <Save className="h-3 w-3" /> Save
                                        </button>
                                    </div>
                                    <textarea
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-blue-200 min-h-[80px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-gray-700"
                                        placeholder="Detailed solution..."
                                        value={q.explanation || ''}
                                        onChange={(e) => handleFieldChange(i, 'explanation', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Upload className="h-5 w-5 text-blue-500" /> Import AI Answers
                            </h2>
                            <button onClick={() => setIsImportModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 flex flex-col gap-4">
                            <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-lg text-sm text-blue-200">
                                <p className="font-bold mb-1">Instructions:</p>
                                <ol className="list-decimal pl-4 space-y-1 text-xs opacity-80">
                                    <li>Provide the AI prompt with the Question IDs (use the "Copy for AI" button).</li>
                                    <li>Ask the AI to return a JSON array with objects containing <code>id</code>, <code>answer</code>, <code>hint</code>, and <code>explanation</code>.</li>
                                    <li>Paste the JSON response below.</li>
                                </ol>
                            </div>
                            <textarea
                                className="flex-1 w-full bg-gray-950 border border-gray-700 rounded-lg p-4 text-xs font-mono text-green-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder={`[\n  {\n    "id": "...",\n    "answer": "42",\n    "hint": "Check the limits...",\n    "explanation": "Because..."\n  }\n]`}
                                value={importJson}
                                onChange={(e) => setImportJson(e.target.value)}
                            />
                        </div>
                        <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
                            <button
                                onClick={() => setIsImportModalOpen(false)}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!importJson.trim()}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Process & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
