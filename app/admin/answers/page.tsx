'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Copy, Save, Database, Filter, Upload, X, Search, Edit, FileText, Download, Trash2, RefreshCw, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import MultiSelect from '../components/MultiSelect';
import Latex from 'react-latex-next';
import LatexWithImages from '../../components/LatexWithImages';
import ImageUploadButton from './components/ImageUploadButton';
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
    examNames?: string[];
    examName?: string; // Legacy field for backwards compatibility
    marks?: number;
    // Critical fields for persistence
    options?: string[];
    deployments?: any[];
    uploadedBy?: string;
    facultyName?: string;
    createdAt?: string;
}

const AI_PROMPT = `You are an Answer Bank Assistant. Your task is to generate answers, hints, and explanations for the provided questions and format them into a strict JSON array.

Rules:
1. Output MUST be a valid JSON array of objects.
2. Each object must have:
   - "id" (string): The exact Question ID provided in the input.
   - "answer" (string): The final answer key or short answer. Use LaTeX for math.
   - "hint" (string): A helpful hint for standard difficulty.
   - "explanation" (string): A detailed step-by-step solution.
3. Preserve "topic" and "subtopic" if helpful, but "id" is critical for mapping.
4. **Line Breaks**: To break lines (e.g. for solution steps), use "$\\\\\\\\\\\\\\\\$" (literal string with 8 backslashes) instead of "\\n".
5. **LaTeX Escaping**: You MUST double-escape all LaTeX backslashes. For example, use "\\\\frac" output matching "\\frac", and "\\\\alpha" for "\\alpha".
   - WRONG: "x = \frac{1}{2}" (Invalid JSON)
   - CORRECT: "x = \\frac{1}{2}" (Valid JSON)
6. Ensure all special characters are properly escaped in JSON strings.
7. Do NOT add markdown formatting (like \`\`\`json). Output raw JSON only.
8. **Images**: You can include images in explanations using base64 strings in the format: data:image/png;base64,... or administrators can upload images directly.
9. If the question implies a diagram or image that you cannot generate, describe it in text within the explanation.
10. **Wrong Data**: If the question seems to have incorrect data or is unsolvable, set "answer", "hint", and "explanation" to: "question may have wrong data, please inform your teacher".

Example Input:
[
  { "id": "q123", "text": "Solve x + 2 = 5" }
]

Example Output:
[
  {
    "id": "q123",
    "answer": "x = 3",
    "hint": "Subtract 2 from both sides.",
    "explanation": "Given $ x + 2 = 5 $\\\\\\\\\\\\\\\\$ Subtract 2 from both sides: $ x = 5 - 2 $\\\\\\\\\\\\\\\\$ $ x = 3 $"
  }
]
`;

export default function AnswerBank() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // View State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'json'>('json'); // Currently only JSON needed for answers, maybe manual later

    // Editor Content
    const [jsonContent, setJsonContent] = useState('');
    const [previewContent, setPreviewContent] = useState<any[]>([]); // For previewing import
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [editScrollPosition, setEditScrollPosition] = useState(0);
    const lastEditedId = useRef<string | null>(null);
    const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Selection & Filtering
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
    const [selectedTopics, setSelectedTopics] = useState<string[]>(["No Topic"]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [selectedExams, setSelectedExams] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserEmail(user.email);
            fetchQuestions(user.email);
        }
    }, []);

    const fetchQuestions = async (email: string) => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/questions', {
                headers: { 'X-User-Email': email },
                cache: 'no-store'
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                // Sort: Topic -> Subtopic -> ID (Creation)
                const sorted = data.sort((a: Question, b: Question) => {
                    return a.topic.localeCompare(b.topic) ||
                        a.subtopic.localeCompare(b.subtopic) ||
                        (a.id || '').localeCompare(b.id || '');
                });
                setQuestions(sorted);
            }
        } catch (error) {
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    };

    // --- Filter Logic ---
    const topics = useMemo(() => {
        let filtered = questions;
        if (selectedSubtopics.length > 0) {
            filtered = filtered.filter(q => selectedSubtopics.includes(q.subtopic));
        }
        if (selectedExams.length > 0) {
            filtered = filtered.filter(q => {
                const qExams = q.examNames || [];
                return qExams.some((e: string) => selectedExams.includes(e));
            });
        }
        const actualTopics = Array.from(new Set(filtered.map(q => q.topic))).filter(Boolean).sort();
        return ["No Topic", ...actualTopics];
    }, [questions, selectedSubtopics, selectedExams]);

    const subtopics = useMemo(() => {
        let filtered = questions;
        if (selectedTopics.length > 0) {
            const actualTopics = selectedTopics.filter(t => t !== "No Topic");
            if (actualTopics.length > 0) {
                filtered = filtered.filter(q => actualTopics.includes(q.topic));
            }
        }
        if (selectedExams.length > 0) {
            filtered = filtered.filter(q => {
                const qExams = q.examNames || [];
                return qExams.some((e: string) => selectedExams.includes(e));
            });
        }
        return Array.from(new Set(filtered.map(q => q.subtopic))).filter(Boolean).sort();
    }, [questions, selectedTopics, selectedExams]);

    const examNames = useMemo(() => {
        const set = new Set<string>();
        let filtered = questions;

        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        if (actualTopics.length > 0) {
            filtered = filtered.filter(q => actualTopics.includes(q.topic));
        }
        if (selectedSubtopics.length > 0) {
            filtered = filtered.filter(q => selectedSubtopics.includes(q.subtopic));
        }

        filtered.forEach(q => {
            if (q.examNames && Array.isArray(q.examNames)) q.examNames.forEach(e => set.add(e));
            else if (q.examNames && typeof q.examNames === 'string') set.add(q.examNames);
            else if (q.examName) set.add(q.examName);
        });
        return Array.from(set).filter(Boolean).sort();
    }, [questions, selectedTopics, selectedSubtopics]);

    const filteredQuestions = useMemo(() => {
        // If "No Topic" is selected, return empty (unless searching)
        if (selectedTopics.includes("No Topic") && !searchQuery) {
            return [];
        }

        const actualTopics = selectedTopics.filter(t => t !== "No Topic");

        return questions.filter(q => {
            if (actualTopics.length > 0 && !actualTopics.includes(q.topic)) return false;
            if (selectedSubtopics.length > 0 && !selectedSubtopics.includes(q.subtopic)) return false;

            const qExams = q.examNames || [];
            if (selectedExams.length > 0) {
                const hasExam = selectedExams.some(e => qExams.includes(e));
                if (!hasExam) return false;
            }

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    q.text.toLowerCase().includes(query) ||
                    (q.answer && q.answer.toLowerCase().includes(query)) ||
                    q.topic.toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [questions, selectedTopics, selectedSubtopics, selectedExams, searchQuery]);

    // --- Selection Logic ---
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

    const deleteSelected = async () => {
        if (selectedQuestionIds.size === 0) return;
        if (!confirm(`Permanently delete ${selectedQuestionIds.size} questions and their answers?`)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/questions', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail || ''
                },
                body: JSON.stringify({ ids: Array.from(selectedQuestionIds) })
            });

            if (res.ok) {
                toast.success('Deleted successfully');
                setSelectedQuestionIds(new Set());
                if (userEmail) fetchQuestions(userEmail);
            } else {
                toast.error('Failed to delete');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error deleting questions');
        } finally {
            setLoading(false);
        }
    };

    // --- Editor Logic ---
    const handleEditAnswers = (id?: string) => {
        setEditScrollPosition(window.scrollY);

        let questionsToEdit: Question[] = [];
        if (id) {
            const q = questions.find(q => q.id === id);
            if (q) {
                questionsToEdit = [q];
                lastEditedId.current = id;
            }
        } else if (selectedQuestionIds.size > 0) {
            questionsToEdit = questions.filter(q => selectedQuestionIds.has(q.id));
        }

        // If nothing selected, we open in "Bulk Import" mode (empty editor)
        // This supports the flow: Copy Prompt -> Get AI Response -> Paste here

        let editorData: any[] = [];

        if (questionsToEdit.length > 0) {
            editorData = questionsToEdit.map(q => ({
                id: q.id,
                text: q.text,
                answer: q.answer || "",
                hint: q.hint || "",
                explanation: q.explanation || ""
            }));
            setJsonContent(JSON.stringify(editorData, null, 2));
        } else {
            // Empty state for pure import
            setJsonContent('');
        }

        setPreviewContent(editorData);
        setIsEditorOpen(true);
    };

    const handleJsonInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setJsonContent(e.target.value);
    };

    const insertImageIntoJson = (base64: string, field: 'answer' | 'hint' | 'explanation') => {
        try {
            const parsed = JSON.parse(jsonContent || '[]');
            const arr = Array.isArray(parsed) ? parsed : [parsed];

            // Add image to all items in the array or the first item
            arr.forEach((item: any) => {
                if (!item[field]) {
                    item[field] = base64;
                } else {
                    // Append to existing content with a space separator
                    item[field] = item[field] + ' ' + base64;
                }
            });

            setJsonContent(JSON.stringify(arr, null, 2));
            toast.success(`Image added to ${field}`);
        } catch (e) {
            toast.error('Fix JSON before adding images');
        }
    };

    const handleAutoFix = () => {
        // Fix common JSON syntax errors caused by unescaped LaTeX
        // Replace \ (that is not part of a valid escape) with \\
        let fixed = jsonContent.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');
        setJsonContent(fixed);
        toast.success("Applied auto-fix for escapes");
    };

    // Debounce Parse
    useEffect(() => {
        if (!isEditorOpen) return;
        const timer = setTimeout(() => {
            if (!jsonContent.trim()) {
                setPreviewContent([]);
                setJsonError(null);
                return;
            }
            try {
                const parsed = JSON.parse(jsonContent);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                setPreviewContent(arr);
                setJsonError(null);
            } catch (e: any) {
                setJsonError(e.message);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [jsonContent, isEditorOpen]);

    const saveChanges = async () => {
        if (previewContent.length === 0) return;
        setLoading(true);
        try {
            // Merge logic
            const updatedQuestions = [...questions];
            let updateCount = 0;
            const updatesToSave: any[] = [];

            previewContent.forEach((imported: any) => {
                // Must have ID
                if (!imported.id) return;

                const idx = updatedQuestions.findIndex(q => q.id === imported.id);

                if (idx !== -1) {
                    const original = updatedQuestions[idx];
                    // MERGE: Use original as base, override with imported answer/hint/explanation
                    // IMPORTANT: We must explicitly ensure we don't return a new object with missing keys if spread fails
                    // But ...original works fine.
                    // The issue might be that updatedQuestions[idx] came from state which came from FETCH.
                    // And if Fetch didn't have fields because of Interface, spread would miss them.
                    // But runtime JS objects have them even if TS interface hides them.

                    updatedQuestions[idx] = {
                        ...original,
                        ...imported,
                        // Ensure arrays are preserved if they are undefined in imported
                        // (Note: ...imported will overwrite original.options with undefined if imported.options is undefined? 
                        // No, spread only copies OWN properties. If imported comes from JSON.parse, missing keys are not there.
                        // BUT if imported has explicit null/undefined, it overrides.
                        // Safest to explicitly handle arrays if we think they might be lost.)
                        options: imported.options || original.options || [],
                        deployments: imported.deployments || original.deployments || [],
                        examNames: imported.examNames || original.examNames || []
                    };

                    updatesToSave.push(updatedQuestions[idx]);
                    updateCount++;
                }
            });

            if (updateCount === 0) {
                toast("No matching questions found to update.");
                setLoading(false);
                return;
            }

            // Save to DB
            const res = await fetch('/api/admin/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': userEmail || '' },
                body: JSON.stringify({ questions: updatesToSave })
            });

            if (!res.ok) throw new Error('Failed to save');

            setQuestions(updatedQuestions);
            toast.success(`Saved ${updateCount} answer sets!`);
            setIsEditorOpen(false);
            setJsonContent('');
            setPreviewContent([]);
            setSelectedQuestionIds(new Set()); // Clear selection after bulk edit/save? Maybe keep it? Let's clear to avoid confusion.

            // Restore Scroll
            setTimeout(() => {
                const targetId = lastEditedId.current;

                if (editScrollPosition > 0 && !targetId) {
                    // Bulk edit or no specific target, just restore position
                    window.scrollTo({ top: editScrollPosition, behavior: 'smooth' });
                    setEditScrollPosition(0);
                } else if (targetId) {
                    // Scroll to specific edited item
                    const element = document.getElementById(`q-${targetId}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.classList.add('ring-2', 'ring-purple-500');
                        setTimeout(() => element.classList.remove('ring-2', 'ring-purple-500'), 2000);
                    }
                    lastEditedId.current = null;
                }
            }, 500);

        } catch (error: any) {
            toast.error(error.message || 'Save failed');
        } finally {
            setLoading(false);
        }
    };

    const copyPrompt = () => {
        if (!isEditorOpen && selectedQuestionIds.size === 0) {
            toast.error("Select questions first to generate prompt.");
            return;
        }

        // If editor is open, use previewContent (what's visible). 
        // If editor closed, use selection.
        let questionsToPrompt: Question[] = [];

        if (isEditorOpen) {
            // In editor mode, we might want to prompt for the ones currently being edited
            // But usually we prompt first, then paste.
            // If user is inside editor, maybe they want to Re-prompt?
            // Let's assume they want to prompt for the items currently loaded in editor (previewContent)
            // But previewContent might be partial.
            // Safest: Use the IDs from previewContent to find full question data if needed, or just use previewContent if it has text.
            questionsToPrompt = questions.filter(q => previewContent.some(p => p.id === q.id));
        } else {
            questionsToPrompt = questions.filter(q => selectedQuestionIds.has(q.id));
        }

        if (questionsToPrompt.length === 0) {
            toast.error("No questions selected.");
            return;
        }

        const dataForPrompt = questionsToPrompt.map(q => ({
            id: q.id,
            text: q.text
        }));

        const promptText = `${AI_PROMPT}\n\nINPUT DATA:\n${JSON.stringify(dataForPrompt, null, 2)}`;

        navigator.clipboard.writeText(promptText);
        toast.success("Prompt copied to clipboard!");
    };


    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-950 text-white font-sans selection:bg-purple-500/30">
            {/* Header */}
            <header className="flex flex-col gap-4 px-4 py-4 md:px-6 bg-gray-900 border-b border-gray-800 shadow-sm relative z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.history.back()}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors bg-slate-800/50 md:bg-transparent"
                        >
                            <ArrowLeft className="h-5 w-5 text-slate-400" />
                        </button>
                        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-500/20 hidden md:block">
                            <Database className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Answer Bank
                            </h1>
                            <p className="text-xs text-gray-500 font-medium">Manage Answers, Hints & Explanations</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {!isEditorOpen && selectedQuestionIds.size > 0 && (
                        <button
                            onClick={deleteSelected}
                            className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 animate-in fade-in"
                        >
                            <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span> ({selectedQuestionIds.size})
                        </button>
                    )}
                    {!isEditorOpen && (
                        <>
                            <button
                                onClick={copyPrompt}
                                disabled={selectedQuestionIds.size === 0}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex-1 justify-center sm:flex-none"
                            >
                                <Copy className="h-4 w-4" /> <span className="hidden sm:inline">Copy Prompt</span><span className="sm:hidden">Prompt</span> ({selectedQuestionIds.size})
                            </button>
                            <button
                                onClick={() => handleEditAnswers()}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 flex-1 justify-center sm:flex-none"
                            >
                                <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Bulk Import Answers</span><span className="sm:hidden">Import</span>
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Editor Mode */}
            {isEditorOpen ? (
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
                    <div className="flex-1 flex overflow-hidden">
                        {/* JSON Input */}
                        <div className="flex-1 flex flex-col border-r border-gray-800">
                            <div className="p-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-400 flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> JSON Answer Editor
                                </span>
                                <div className="flex items-center gap-2">
                                    <ImageUploadButton
                                        label="+ Answer Image"
                                        onImageUploaded={(base64) => insertImageIntoJson(base64, 'answer')}
                                    />
                                    <ImageUploadButton
                                        label="+ Hint Image"
                                        onImageUploaded={(base64) => insertImageIntoJson(base64, 'hint')}
                                    />
                                    <ImageUploadButton
                                        label="+ Explanation Image"
                                        onImageUploaded={(base64) => insertImageIntoJson(base64, 'explanation')}
                                    />
                                    <button
                                        onClick={copyPrompt}
                                        className="text-xs bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1"
                                    >
                                        <Copy className="h-3 w-3" /> Copy Prompt
                                    </button>
                                </div>
                            </div>
                            <div className="relative flex-1">
                                <textarea
                                    ref={jsonTextareaRef}
                                    className="absolute inset-0 w-full h-full bg-[#0d1117] text-gray-300 font-mono text-xs p-4 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    value={jsonContent}
                                    onChange={handleJsonInput}
                                    spellCheck={false}
                                    placeholder="// Paste AI generated JSON array here..."
                                />
                                {jsonError && (
                                    <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 text-red-100 p-3 rounded border border-red-500/50 text-xs font-mono shadow-xl backdrop-blur-md flex justify-between items-start gap-4">
                                        <div>
                                            <div className="font-bold mb-1">JSON Syntax Error:</div>
                                            {jsonError}
                                        </div>
                                        <button
                                            onClick={handleAutoFix}
                                            className="bg-red-800 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-bold border border-red-500/50 flex flex-col items-center gap-1 min-w-[80px]"
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                            Auto Fix
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex-1 flex flex-col bg-gray-900/50">
                            <div className="p-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-400">Preview Updates</span>
                                <span className="text-xs text-gray-500">{previewContent.length} questions loaded</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {previewContent.map((item, i) => (
                                    <div key={i} className="bg-gray-800 rounded border border-gray-700 p-3 text-sm">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-mono text-xs text-gray-500">{item.id}</span>
                                        </div>
                                        {item.text && (
                                            <div className="mb-3 p-2 bg-gray-900/50 rounded text-gray-400 prose prose-invert prose-sm max-w-none">
                                                <Latex>{item.text}</Latex>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-2">
                                            {item.answer && (
                                                <div className="bg-green-900/10 border border-green-500/20 p-2 rounded">
                                                    <span className="text-[10px] uppercase font-bold text-green-500 block mb-1">Answer</span>
                                                    <Latex>{item.answer}</Latex>
                                                </div>
                                            )}
                                            {item.hint && (
                                                <div className="bg-yellow-900/10 border border-yellow-500/20 p-2 rounded">
                                                    <span className="text-[10px] uppercase font-bold text-yellow-500 block mb-1">Hint</span>
                                                    <Latex>{item.hint}</Latex>
                                                </div>
                                            )}
                                            {item.explanation && (
                                                <div className="bg-blue-900/10 border border-blue-500/20 p-2 rounded">
                                                    <span className="text-[10px] uppercase font-bold text-blue-500 block mb-1">Explanation</span>
                                                    <LatexWithImages>{item.explanation}</LatexWithImages>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setIsEditorOpen(false);
                                setJsonContent('');
                                setPreviewContent([]);
                            }}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveChanges}
                            disabled={loading || !!jsonError || previewContent.length === 0}
                            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                            Save Answers
                        </button>
                    </div>
                </div>

            ) : (
                <>
                    {/* Viewer Mode */}
                    {/* Filters & Actions */}
                    <div className="bg-gray-900 border-b border-gray-800 p-3 md:p-4">
                        <div className="flex flex-col gap-4">
                            {/* Mobile Stacked Filters */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                <div className="flex items-center h-[38px] px-2 bg-gray-800 rounded border border-gray-700 w-fit">
                                    <input
                                        type="checkbox"
                                        checked={filteredQuestions.length > 0 && selectedQuestionIds.size === filteredQuestions.length}
                                        onChange={toggleSelectAll}
                                        className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                                        title="Select All"
                                    />
                                    <span className="ml-2 text-xs text-gray-400 font-medium sm:hidden">Select All</span>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 ml-1 block">Topic</label>
                                    <MultiSelect
                                        options={topics}
                                        selected={selectedTopics}
                                        onChange={setSelectedTopics}
                                        placeholder="All Topics"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 ml-1 block">Subtopic</label>
                                    <MultiSelect
                                        options={subtopics}
                                        selected={selectedSubtopics}
                                        onChange={setSelectedSubtopics}
                                        placeholder="All Subtopics"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 ml-1 block">Exam</label>
                                    <MultiSelect
                                        options={examNames}
                                        selected={selectedExams}
                                        onChange={setSelectedExams}
                                        placeholder="All Exams"
                                    />
                                </div>
                                <div className="space-y-1 relative">
                                    <label className="text-xs text-gray-400 ml-1 block">Search</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                        <input
                                            type="text"
                                            placeholder="Search questions..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded h-[40px] pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Question List */}
                    <div className="flex-1 overflow-y-auto p-2 md:p-6 space-y-3 md:space-y-4 bg-gray-950 pb-20">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            </div>
                        ) : filteredQuestions.length === 0 ? (
                            <div className="text-center py-20 text-gray-500">
                                No questions found matching your filters.
                            </div>
                        ) : (
                            filteredQuestions.map((q, index) => (
                                <div id={`q-${q.id}`} key={q.id} className={`bg-gray-900 rounded-lg border transition-all duration-200 group ${selectedQuestionIds.has(q.id) ? 'border-purple-500/50 shadow-purple-500/10 shadow-lg' : 'border-gray-800 hover:border-gray-700'}`}>
                                    <div className="p-3 md:p-4 flex gap-3 md:gap-4">
                                        <div className="pt-1 flex flex-col items-center gap-2">
                                            <span className="text-xs font-mono text-gray-500 font-bold">{index + 1}</span>
                                            <input
                                                type="checkbox"
                                                checked={selectedQuestionIds.has(q.id)}
                                                onChange={() => toggleSelection(q.id)}
                                                className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            {/* Header Tags - Wrap correctly on mobile */}
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                                                <div className="flex flex-wrap gap-1.5 md:gap-2">
                                                    <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wider border border-gray-700">{q.topic}</span>
                                                    <span className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wider border border-gray-700">{q.subtopic}</span>
                                                    <span className={`text-[9px] md:text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${q.type === 'broad' ? 'border-pink-500 text-pink-400' : q.type === 'mcq' ? 'border-yellow-500 text-yellow-400' : 'border-cyan-500 text-cyan-400'}`}>
                                                        {q.type}
                                                    </span>
                                                    {q.examNames && q.examNames.length > 0 && q.examNames.map((exam, idx) => (
                                                        <span key={idx} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] md:text-[10px] px-2 py-0.5 rounded font-bold shadow-sm">
                                                            {exam}
                                                        </span>
                                                    ))}
                                                    {Number(q.marks) > 0 && (
                                                        <span className="bg-gradient-to-r from-emerald-600 to-green-600 text-white text-[9px] md:text-[10px] px-2 py-0.5 rounded font-bold shadow-sm">
                                                            {q.marks} m
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleEditAnswers(q.id)}
                                                    className="self-end sm:self-auto flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                >
                                                    <Edit className="h-3 w-3" />
                                                    <span className="sm:inline">Edit</span>
                                                </button>
                                            </div>

                                            {/* Question Text */}
                                            <div className="mb-4 text-xs md:text-sm text-gray-200 prose prose-invert max-w-none w-full overflow-x-auto">
                                                {q.image && (
                                                    <div className="mb-2">
                                                        <img src={q.image} alt="Q" className="max-h-24 rounded border border-gray-700" />
                                                    </div>
                                                )}
                                                <Latex>{q.text}</Latex>

                                                {/* MCQ Options Display */}
                                                {q.type === 'mcq' && q.options && q.options.length > 0 && (
                                                    <div className="mt-2 grid grid-cols-1 gap-1.5">
                                                        {q.options.map((opt: string, i: number) => (
                                                            <div key={i} className={`text-xs px-2 py-1.5 rounded border border-gray-700 bg-gray-900/50 flex items-start gap-2 ${q.answer && (opt.includes(q.answer) || q.answer.includes(opt)) ? 'border-green-500/30 bg-green-900/10' : ''}`}>
                                                                <span className="font-bold text-gray-500 uppercase flex-shrink-0">{String.fromCharCode(65 + i)}.</span>
                                                                <span className="text-gray-300 break-words w-full"><Latex>{opt}</Latex></span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Answer Section for Editors */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-4 pt-4 border-t border-gray-800 bg-gray-950/30 -mx-3 md:-mx-4 -mb-3 md:-mb-4 px-3 md:px-4 py-3 rounded-b-lg">
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-1">
                                                        Answer
                                                        {!q.answer && <span className="text-red-500 ml-auto text-[9px] lowercase italic">(missing)</span>}
                                                    </div>
                                                    <div className="text-xs text-green-300/90 font-mono break-words overflow-x-auto">
                                                        {q.answer ? <Latex>{q.answer}</Latex> : <span className="text-gray-600 italic">No answer provided</span>}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-bold text-yellow-500 uppercase">Hint</div>
                                                    <div className="text-xs text-yellow-300/80 break-words overflow-x-auto">
                                                        {q.hint ? <Latex>{q.hint}</Latex> : <span className="text-gray-600 italic">-</span>}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-bold text-blue-500 uppercase">Explanation</div>
                                                    <div className="text-xs text-blue-300/80 line-clamp-3 hover:line-clamp-none cursor-help transition-all break-words overflow-x-auto">
                                                        {q.explanation ? <LatexWithImages>{q.explanation}</LatexWithImages> : <span className="text-gray-600 italic">-</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
