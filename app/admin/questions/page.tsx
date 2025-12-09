'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Plus, FileJson, FileText, Trash2, Download, Save, X, Printer, Edit, Upload, Copy, ExternalLink, Search, RefreshCw, Check, ChevronDown } from 'lucide-react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

const AI_PROMPT = `You are a Question Bank Assistant. Your task is to extract questions from the provided content and format them into a strict JSON array.

Rules:
1. Output MUST be a valid JSON array of objects.
2. Each object must have the following fields:
   - "text": The question text. Use LaTeX for math.
     - IMPORTANT: Use ONLY single dollar signs ($...$) for ALL math expressions (inline and display). DO NOT use double dollar signs ($$...$$).
     - IMPORTANT: Escape ALL backslashes. Use double backslash (\\\\) for every single backslash in LaTeX commands. Example: use \\\\frac{a}{b} instead of \\frac{a}{b}.
   - "type": One of "broad", "mcq", "blanks".
   - "topic": Infer the specific topic (e.g., "Matrix", "Thermodynamics"). Avoid generic terms like "Math" or "Physics".
   - "subtopic": Infer the specific subtopic (e.g., "Rank", "Entropy").
3. If images are present, try to describe them using TikZ code within the "text" field, or provide a clear text description.
4. Do NOT wrap the output in markdown code blocks (like \`\`\`json). Return ONLY the raw JSON string.

Example Output:
[
  {
    "text": "Find the rank of the matrix $ A = \\\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\\\end{pmatrix} $",
    "type": "broad",
    "topic": "Matrix",
    "subtopic": "Rank"
  }
]
`;

export default function QuestionBank() {
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'manual' | 'json' | 'pdf'>('manual');
    const [manualData, setManualData] = useState({ id: '', type: 'broad', topic: '', subtopic: '', text: '' });
    const [jsonContent, setJsonContent] = useState('');
    const [previewContent, setPreviewContent] = useState<any[]>([]);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Duplicate Detection State
    const [duplicateQuestions, setDuplicateQuestions] = useState<any[]>([]);
    const [newQuestions, setNewQuestions] = useState<any[]>([]);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // Filter State
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

    // Paper Generator State
    const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
    const [paperConfig, setPaperConfig] = useState({
        course: 'B. Tech.', sem: '1st', session: '', paperName: '', code: '', date: '', stream: '', time: '', marks: '', exam: ''
    });

    // Derived Lists for Autocomplete/Filters
    const topics = Array.from(new Set(questions.map(q => q.topic))).sort();
    const subtopics = Array.from(new Set(questions.map(q => q.subtopic))).sort();

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (user) {
            const parsed = JSON.parse(user);
            setUserEmail(parsed.email);
            setUserName(parsed.name);
            fetchQuestions(parsed.email);
        }
    }, []);

    const fetchQuestions = async (email: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/questions', {
                headers: { 'X-User-Email': email }
            });
            if (res.ok) setQuestions(await res.json());
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- Editor Logic ---

    const handleManualChange = (field: string, value: string) => {
        setManualData(prev => ({ ...prev, [field]: value }));
        setPreviewContent([{
            ...manualData,
            id: manualData.id || 'preview',
            [field]: value,
            facultyName: userName
        }]);
    };

    const normalizeImportedData = (data: any[]) => {
        return data.map((q: any) => {
            // Map 'content' to 'text' if text is missing
            let text = q.text;
            if (!text && q.content) text = q.content;

            // Map 'id' to 'type' if type is missing and id looks like a type
            let type = q.type;
            let id = q.id;
            if (!type && ['broad', 'mcq', 'blanks'].includes(q.id)) {
                type = q.id;
                id = null; // Clear ID so it gets regenerated
            }

            return {
                ...q,
                id: id,
                text: text || '',
                type: type || 'broad',
                facultyName: userName
            };
        });
    };

    const checkForDuplicates = (imported: any[]) => {
        const duplicates: any[] = [];
        const unique: any[] = [];

        imported.forEach(newQ => {
            const exists = questions.find(existing => existing.text.trim() === newQ.text.trim());
            if (exists) {
                duplicates.push({ new: newQ, existing: exists });
            } else {
                unique.push(newQ);
            }
        });

        if (duplicates.length > 0) {
            setDuplicateQuestions(duplicates);
            setNewQuestions(unique);
            setIsDuplicateModalOpen(true);
        } else {
            setPreviewContent(imported);
        }
    };

    const handleJsonInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setJsonContent(val);
        try {
            const parsed = JSON.parse(val);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            const normalized = normalizeImportedData(arr);
            checkForDuplicates(normalized);
            setJsonError(null);
        } catch (e) {
            setJsonError((e as Error).message);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setJsonContent(content);
            try {
                const parsed = JSON.parse(content);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                const normalized = normalizeImportedData(arr);
                checkForDuplicates(normalized);
                setJsonError(null);
            } catch (e) {
                setJsonError("Invalid JSON file");
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };

    const resolveDuplicates = (action: 'overwrite' | 'keep') => {
        let finalContent = [...newQuestions];
        if (action === 'overwrite') {
            // Use the new version, but maybe keep the old ID to update it? 
            // Actually, if we overwrite, we should probably just update the existing record.
            // For simplicity, let's just treat them as new edits to the existing ID.
            const updates = duplicateQuestions.map(d => ({
                ...d.new,
                id: d.existing.id // Keep existing ID to update
            }));
            finalContent = [...finalContent, ...updates];
        } else {
            // Keep both: treat new ones as new (clear ID)
            const news = duplicateQuestions.map(d => ({
                ...d.new,
                id: null // Clear ID to create new
            }));
            finalContent = [...finalContent, ...news];
        }
        setPreviewContent(finalContent);
        setIsDuplicateModalOpen(false);
        setDuplicateQuestions([]);
        setNewQuestions([]);
    };

    const syncEditorCursor = (questionText: string) => {
        if (!textAreaRef.current || !jsonContent || !questionText) return;

        // Simple search for the text snippet in the JSON string
        // We take a substring to avoid issues with long text or escape chars mismatch
        const snippet = questionText.substring(0, 20);
        const index = jsonContent.indexOf(snippet);

        if (index !== -1) {
            textAreaRef.current.focus();
            textAreaRef.current.setSelectionRange(index, index);
            // Scroll to the position
            const lineHeight = 20; // Approx
            const lines = jsonContent.substring(0, index).split('\n').length;
            textAreaRef.current.scrollTop = lines * lineHeight - 100;
        }
    };

    const copyPrompt = () => {
        navigator.clipboard.writeText(AI_PROMPT);
        alert("Prompt copied to clipboard!");
    };

    const saveToDatabase = async () => {
        if (previewContent.length === 0) return;

        // Validation
        const invalid = previewContent.find(q => !q.topic || !q.subtopic || !q.text);
        if (invalid) {
            alert('All questions must have a Topic, Subtopic, and Text.');
            return;
        }

        setLoading(true);
        try {
            const toSave = previewContent.map(q => ({
                ...q,
                id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                topic: q.topic.charAt(0).toUpperCase() + q.topic.slice(1), // Normalize
                subtopic: q.subtopic.charAt(0).toUpperCase() + q.subtopic.slice(1), // Normalize
                type: q.type || 'broad'
            }));

            const res = await fetch('/api/admin/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail || ''
                },
                body: JSON.stringify({ questions: toSave })
            });

            if (res.ok) {
                alert('Saved successfully!');
                setIsEditorOpen(false);
                setManualData({ id: '', type: 'broad', topic: '', subtopic: '', text: '' });
                setJsonContent('');
                setPreviewContent([]);
                if (userEmail) fetchQuestions(userEmail);
            } else {
                alert('Failed to save.');
            }
        } catch (error) {
            console.error(error);
            alert('Error saving questions.');
        } finally {
            setLoading(false);
        }
    };

    // --- Viewer Logic ---

    const filteredQuestions = questions.filter(q => {
        const tMatch = selectedTopics.length === 0 || selectedTopics.includes(q.topic);
        const sMatch = selectedSubtopics.length === 0 || selectedSubtopics.includes(q.subtopic);
        return tMatch && sMatch;
    });

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedQuestionIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedQuestionIds(newSet);
    };

    const deleteSelected = async () => {
        if (selectedQuestionIds.size === 0) return;
        if (!confirm(`Delete ${selectedQuestionIds.size} questions?`)) return;

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
                setSelectedQuestionIds(new Set());
                if (userEmail) fetchQuestions(userEmail);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const downloadJson = () => {
        const data = filteredQuestions.filter(q => selectedQuestionIds.size === 0 || selectedQuestionIds.has(q.id));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'questions.json';
        a.click();
    };

    const handleModeSwitch = (mode: 'manual' | 'json' | 'pdf') => {
        setEditorMode(mode);
        setManualData({ id: '', type: 'broad', topic: '', subtopic: '', text: '' });
        setJsonContent('');
        setPreviewContent([]);
        setJsonError(null);
        setIsEditorOpen(true);
    };

    const editQuestion = (q: any) => {
        setManualData({
            id: q.id,
            type: q.type,
            topic: q.topic,
            subtopic: q.subtopic,
            text: q.text
        });
        setPreviewContent([{ ...q, facultyName: userName }]);
        setEditorMode('manual');
        setIsEditorOpen(true);
    };

    const toggleSelectAll = () => {
        if (selectedQuestionIds.size === filteredQuestions.length) {
            setSelectedQuestionIds(new Set());
        } else {
            setSelectedQuestionIds(new Set(filteredQuestions.map(q => q.id)));
        }
    };

    const downloadPdf = () => {
        const selectedQs = questions.filter(q => selectedQuestionIds.has(q.id));
        if (selectedQs.length === 0) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Selected Questions</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    .q-item { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                    .meta { font-size: 10pt; color: #666; margin-bottom: 5px; font-style: italic; }
                    @media print { 
                        body { padding: 20px; } 
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${selectedQs.map((q, i) => `
                    <div class="q-item">
                        <div class="meta">${q.topic} / ${q.subtopic} (${q.type})</div>
                        <div><b>Q${i + 1}.</b> ${q.text}</div>
                    </div>
                `).join('')}
                
                <!-- Load Scripts -->
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>
                <script>
                    function triggerPrint() {
                        if (window.renderMathInElement) {
                            try {
                                renderMathInElement(document.body, {
                                    delimiters: [
                                        {left: '$$', right: '$$', display: true},
                                        {left: '$', right: '$', display: false},
                                        {left: '\\\\(', right: '\\\\)', display: false},
                                        {left: '\\\\[', right: '\\\\]', display: true}
                                    ],
                                    throwOnError: false
                                });
                            } catch (e) { console.error(e); }
                            setTimeout(() => window.print(), 1000);
                        } else {
                            setTimeout(triggerPrint, 500);
                        }
                    }
                    // Start checking
                    triggerPrint();
                </script>
            </body>
            </html>
        `;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
        }
    };

    // ... (MultiSelect component remains here) ...

    // ... (Paper Generator Logic) ...

    // --- Components ---

    const MultiSelect = ({ options, selected, onChange, placeholder }: any) => {
        const [isOpen, setIsOpen] = useState(false);
        const containerRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        const toggleOption = (value: string) => {
            const newSelected = selected.includes(value)
                ? selected.filter((item: string) => item !== value)
                : [...selected, value];
            onChange(newSelected);
        };

        return (
            <div className="relative" ref={containerRef}>
                <div
                    className="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded p-2 text-xs min-h-[38px] flex items-center justify-between cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex flex-wrap gap-1">
                        {selected.length === 0 ? <span className="text-gray-500">{placeholder}</span> :
                            selected.length > 2 ? <span className="text-white">{selected.length} selected</span> :
                                selected.map((s: string) => (
                                    <span key={s} className="bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded text-[10px]">{s}</span>
                                ))}
                    </div>
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                </div>
                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                        {options.map((opt: string) => (
                            <div
                                key={opt}
                                className="px-3 py-2 hover:bg-gray-700 cursor-pointer flex items-center gap-2 text-xs text-gray-300"
                                onClick={() => toggleOption(opt)}
                            >
                                <div className={`w-3 h-3 rounded border border-gray-500 flex items-center justify-center ${selected.includes(opt) ? 'bg-blue-600 border-blue-600' : ''}`}>
                                    {selected.includes(opt) && <Check className="h-2 w-2 text-white" />}
                                </div>
                                {opt}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // --- Paper Generator Logic ---

    // --- Paper Generator Logic ---

    const [paperStep, setPaperStep] = useState(0); // 0: Select, 1: Details, 2: Preview
    const [paperQuestions, setPaperQuestions] = useState<any[]>([]);
    const [paperHtml, setPaperHtml] = useState('');
    const [paperJson, setPaperJson] = useState('');

    const handlePaperGenOpen = () => {
        setPaperStep(0);
        setPaperQuestions([]);
        setIsPaperModalOpen(true);
    };

    const generatePreview = () => {
        const selectedQs = questions.filter(q => selectedQuestionIds.has(q.id));
        setPaperQuestions(selectedQs);

        // Initial JSON structure for the paper
        const paperStructure = {
            header: paperConfig,
            questions: selectedQs.map((q, i) => ({
                number: i + 1,
                text: q.text,
                marks: q.type === 'mcq' ? 1 : q.type === 'broad' ? 5 : 2,
                type: q.type
            }))
        };
        setPaperJson(JSON.stringify(paperStructure, null, 2));
        updatePaperHtml(paperStructure);
        setPaperStep(2);
    };

    const updatePaperHtml = (structure: any) => {
        const { header, questions } = structure;
        const html = `
            <html>
            <head>
                <title>Question Paper</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; background: white; }
                    .main-title { text-align: center; font-weight: bold; font-size: 20pt; text-transform: uppercase; margin-bottom: 20px; }
                    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; align-items: start; font-size: 12pt; font-weight: bold; }
                    .header-row { display: flex; justify-content: space-between; }
                    .title { text-align: center; font-weight: bold; font-size: 16pt; text-transform: uppercase; margin-top: 10px; margin-bottom: 5px; }
                    .subtitle { text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 20px; }
                    .q-item { margin-bottom: 15px; font-size: 12pt; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="main-title">Heritage Institute of Technology</div>
                
                <div class="header-grid">
                    <div>${header.course} (${header.sem})</div>
                    <div style="text-align:right">Time: ${header.time}</div>
                    
                    <div>Stream: ${header.stream}</div>
                    <div style="text-align:right">Full Marks: ${header.marks}</div>
                    
                    <div>Session: ${header.session}</div>
                    <div style="text-align:right">Exam: ${header.exam} (${header.date})</div>
                </div>

                <div class="title">${header.paperName}</div>
                <div class="subtitle">Paper Code: ${header.code}</div>
                
                <hr style="border-top: 2px solid black; margin-bottom: 30px;" />

                <div>
                    ${questions.map((q: any) => `
                        <div class="q-item">
                            <b>Q${q.number}.</b> ${q.text} 
                            <span style="float:right; font-weight:bold">[${q.marks}]</span>
                        </div>
                    `).join('')}
                </div>

                <script>
                    document.addEventListener("DOMContentLoaded", function() {
                        renderMathInElement(document.body, {
                            delimiters: [
                                {left: '$$', right: '$$', display: true},
                                {left: '$', right: '$', display: false},
                                {left: '\\\\(', right: '\\\\)', display: false},
                                {left: '\\\\[', right: '\\\\]', display: true}
                            ],
                            throwOnError: false
                        });
                    });
                </script>
            </body>
            </html>
        `;
        setPaperHtml(html);
    };

    const handlePaperJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setPaperJson(val);
        try {
            const parsed = JSON.parse(val);
            updatePaperHtml(parsed);
        } catch (e) {
            // Invalid JSON
        }
    };

    const printPaper = () => {
        const iframe = document.getElementById('paper-preview-frame') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.print();
        }
    };


    return (
        <div className="p-4 md:p-8 space-y-6 h-full flex flex-col">
            {/* Datalists for Autocomplete */}
            <datalist id="topics-list">
                {topics.map(t => <option key={t} value={t} />)}
            </datalist>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Question Bank</h1>
                    {userName && <div className="text-sm text-gray-400">Logged in as: <span className="text-blue-400 font-semibold">{userName}</span></div>}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setIsPaperModalOpen(true)} className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Create Question Paper
                    </button>
                    <button onClick={() => handleModeSwitch('manual')} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Manual Latex
                    </button>
                    <button onClick={() => handleModeSwitch('json')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2">
                        <FileJson className="h-4 w-4" /> JSON
                    </button>
                    <button onClick={() => handleModeSwitch('pdf')} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" /> AI PDF
                    </button>
                </div>
            </div>

            {/* Editor Panel */}
            {
                isEditorOpen && (
                    <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden flex flex-col transition-all duration-300">
                        <div className="bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-white capitalize">{editorMode} Editor</h3>
                                <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 uppercase tracking-wider">Mode</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditorOpen(false)} className="text-gray-400 hover:text-white px-3">Cancel</button>
                                <button onClick={saveToDatabase} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1 rounded font-bold flex items-center gap-2">
                                    <Save className="h-4 w-4" /> Save
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px]">
                            <div className="p-4 border-r border-gray-700 flex flex-col gap-4 bg-gray-900">
                                {editorMode === 'manual' && (
                                    <>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-400 block mb-1">Type</label>
                                                <select className="w-full bg-gray-800 border border-gray-600 text-white rounded p-2 text-sm" value={manualData.type} onChange={e => handleManualChange('type', e.target.value)}>
                                                    <option value="broad">Broad</option><option value="mcq">MCQ</option><option value="blanks">Blanks</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 block mb-1">Topic</label>
                                                <input className="w-full bg-gray-800 border border-gray-600 text-white rounded p-2 text-sm" list="topics-list" placeholder="Select or Type" value={manualData.topic} onChange={e => handleManualChange('topic', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 block mb-1">Subtopic</label>
                                                <input className="w-full bg-gray-800 border border-gray-600 text-white rounded p-2 text-sm" list="subtopics-list" placeholder="Select or Type" value={manualData.subtopic} onChange={e => handleManualChange('subtopic', e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Question Text (LaTeX supported)</label>
                                            <textarea
                                                className="w-full h-64 bg-gray-800 border border-gray-600 text-green-400 font-mono p-4 rounded focus:outline-none focus:border-blue-500"
                                                placeholder="Type question here... Use $...$ for inline math."
                                                value={manualData.text}
                                                onChange={e => handleManualChange('text', e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                                {(editorMode === 'json' || editorMode === 'pdf') && (
                                    <div className="flex flex-col h-full gap-4">
                                        {editorMode === 'pdf' && (
                                            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg space-y-4">
                                                <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                                                    <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white">1</div>
                                                    <span>Copy Prompt & Open AI Tool</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={copyPrompt} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2 border border-gray-600">
                                                        <Copy className="h-3 w-3" /> Copy Prompt
                                                    </button>
                                                    <a href="https://gemini.google.com/app" target="_blank" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1">
                                                        Gemini <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                    <a href="https://chatgpt.com/" target="_blank" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1">
                                                        ChatGPT <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                    <a href="https://www.perplexity.ai/" target="_blank" className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black py-2 rounded text-xs font-bold flex items-center justify-center gap-1">
                                                        Perplexity <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                                <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                                                    <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white">2</div>
                                                    <span>Paste Generated JSON Below</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <label className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs cursor-pointer flex items-center gap-2">
                                                <Upload className="h-3 w-3" /> Import JSON File
                                                <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                                            </label>
                                            <span className="text-xs text-gray-500">or paste text below</span>
                                        </div>

                                        <textarea
                                            ref={textAreaRef}
                                            className="flex-1 bg-gray-800 border border-gray-600 text-green-400 font-mono p-4 rounded focus:outline-none focus:border-blue-500 text-sm leading-relaxed"
                                            placeholder={editorMode === 'json' ? "Paste JSON array here..." : "Paste AI-generated JSON here..."}
                                            value={jsonContent}
                                            onChange={handleJsonInput}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col bg-gray-100 h-full">
                                <div className="bg-gray-200 px-4 py-2 border-b border-gray-300 flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-gray-600 uppercase">Live Preview</h4>
                                    <span className="text-xs text-gray-500">Click item to edit source</span>
                                </div>
                                {jsonError && (
                                    <div className="bg-red-100 border-b border-red-200 p-2 text-xs text-red-600 font-mono break-all">
                                        {jsonError}
                                    </div>
                                )}
                                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                                    {previewContent.length === 0 ? (
                                        <div className="text-center text-gray-400 mt-10 italic">Preview will appear here...</div>
                                    ) : (
                                        previewContent.map((q, i) => (
                                            <div
                                                key={i}
                                                onClick={() => syncEditorCursor(q.text)}
                                                className="bg-white p-4 rounded shadow-sm border border-gray-200 hover:border-blue-400 cursor-pointer transition-colors group"
                                            >
                                                <div className="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                                                    <div className="flex gap-2">
                                                        <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{q.topic}</span>
                                                        <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{q.subtopic}</span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-mono uppercase">{q.type}</span>
                                                </div>
                                                <div className="text-gray-800 text-sm">
                                                    {q.text ? <Latex>{q.text}</Latex> : <span className="text-gray-400 italic">(No text content)</span>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Viewer Panel */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex-1 flex flex-col shadow-lg">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-end mb-4">
                    <div className="flex gap-4 w-full md:w-auto items-end">
                        <div className="flex items-center h-[38px] px-2">
                            <input
                                type="checkbox"
                                checked={filteredQuestions.length > 0 && selectedQuestionIds.size === filteredQuestions.length}
                                onChange={toggleSelectAll}
                                className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                                title="Select All"
                            />
                        </div>
                        <div className="w-48">
                            <label className="text-xs text-gray-400 mb-1 block">Filter Topic</label>
                            <MultiSelect
                                options={topics}
                                selected={selectedTopics}
                                onChange={setSelectedTopics}
                                placeholder="All Topics"
                            />
                        </div>
                        <div className="w-48">
                            <label className="text-xs text-gray-400 mb-1 block">Filter Subtopic</label>
                            <MultiSelect
                                options={subtopics}
                                selected={selectedSubtopics}
                                onChange={setSelectedSubtopics}
                                placeholder="All Subtopics"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={downloadPdf} className="text-purple-400 border border-purple-900/50 hover:bg-purple-900/20 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors">
                            <Printer className="h-4 w-4" /> PDF
                        </button>
                        <button onClick={downloadJson} className="text-green-400 border border-green-900/50 hover:bg-green-900/20 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors">
                            <Download className="h-4 w-4" /> JSON
                        </button>
                        <button onClick={deleteSelected} className="text-red-400 border border-red-900/50 hover:bg-red-900/20 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors">
                            <Trash2 className="h-4 w-4" /> Delete
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {loading ? <div className="text-center py-10 text-gray-500 flex flex-col items-center"><Loader2 className="animate-spin h-8 w-8 mb-2" />Loading...</div> :
                        filteredQuestions.length === 0 ? <div className="text-center py-10 text-gray-500">No questions found.</div> :
                            filteredQuestions.map(q => (
                                <div key={q.id} className="bg-gray-700/30 hover:bg-gray-700/50 p-3 rounded border border-gray-700/50 flex gap-3 group transition-colors">
                                    <input type="checkbox" checked={selectedQuestionIds.has(q.id)} onChange={() => toggleSelection(q.id)} className="mt-1 w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800" />
                                    <div className="flex-1">
                                        <div className="flex gap-2 mb-1 items-center">
                                            <span className="bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 text-[10px] px-2 py-0.5 rounded font-medium">{q.topic}</span>
                                            <span className="bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20 text-[10px] px-2 py-0.5 rounded font-medium">{q.subtopic}</span>
                                            <span className="text-gray-500 text-[10px] ml-auto font-mono">ID: {q.id}</span>
                                            <span className="text-emerald-500 text-[10px] font-bold">({q.facultyName})</span>
                                            <button onClick={() => editQuestion(q)} className="ml-2 text-gray-400 hover:text-blue-400">
                                                <Edit className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <div className="text-gray-300 text-sm pl-1">
                                            <Latex>{q.text}</Latex>
                                        </div>
                                    </div>
                                </div>
                            ))}
                </div>
                {/* Paper Modal */}
                {
                    isPaperModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                            <div className="bg-gray-800 rounded-lg w-full max-w-6xl h-[90vh] relative border border-gray-700 shadow-2xl flex flex-col">
                                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Printer className="h-5 w-5 text-orange-500" /> Paper Generator
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <div className="flex gap-1">
                                            <div className={`w-3 h-3 rounded-full ${paperStep >= 0 ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                                            <div className={`w-3 h-3 rounded-full ${paperStep >= 1 ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                                            <div className={`w-3 h-3 rounded-full ${paperStep >= 2 ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                                        </div>
                                        <button onClick={() => setIsPaperModalOpen(false)} className="text-gray-400 hover:text-white"><X className="h-6 w-6" /></button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-hidden flex flex-col p-6">
                                    {paperStep === 0 && (
                                        <div className="flex flex-col h-full gap-4">
                                            <h4 className="text-lg text-white font-bold">Step 1: Select Questions</h4>
                                            <div className="flex gap-4 mb-2">
                                                <div className="w-64">
                                                    <MultiSelect options={topics} selected={selectedTopics} onChange={setSelectedTopics} placeholder="Filter Topics" />
                                                </div>
                                                <div className="w-64">
                                                    <MultiSelect options={subtopics} selected={selectedSubtopics} onChange={setSelectedSubtopics} placeholder="Filter Subtopics" />
                                                </div>
                                                <div className="ml-auto text-gray-400 text-sm flex items-center">
                                                    {selectedQuestionIds.size} questions selected
                                                </div>
                                            </div>
                                            <div className="flex-1 overflow-y-auto border border-gray-700 rounded bg-gray-900/50 p-2 space-y-2">
                                                {filteredQuestions.map(q => (
                                                    <div key={q.id} className={`p-3 rounded border flex gap-3 cursor-pointer ${selectedQuestionIds.has(q.id) ? 'bg-blue-900/30 border-blue-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`} onClick={() => toggleSelection(q.id)}>
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedQuestionIds.has(q.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-500'}`}>
                                                            {selectedQuestionIds.has(q.id) && <Check className="h-3 w-3 text-white" />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex gap-2 mb-1">
                                                                <span className="bg-gray-700 text-gray-300 text-[10px] px-2 rounded">{q.topic}</span>
                                                                <span className="bg-gray-700 text-gray-300 text-[10px] px-2 rounded">{q.type}</span>
                                                            </div>
                                                            <div className="text-gray-300 text-sm"><Latex>{q.text}</Latex></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-end">
                                                <button onClick={() => setPaperStep(1)} disabled={selectedQuestionIds.size === 0} className="bg-blue-600 disabled:bg-gray-700 text-white px-6 py-2 rounded font-bold">Next: Details</button>
                                            </div>
                                        </div>
                                    )}

                                    {paperStep === 1 && (
                                        <div className="flex flex-col h-full gap-4 max-w-2xl mx-auto w-full">
                                            <h4 className="text-lg text-white font-bold">Step 2: Paper Details</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                {Object.keys(paperConfig).map(key => (
                                                    <div key={key}>
                                                        <label className="block text-xs text-gray-400 capitalize mb-1">{key}</label>
                                                        <input
                                                            className="w-full bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                                            value={(paperConfig as any)[key]}
                                                            onChange={e => setPaperConfig({ ...paperConfig, [key]: e.target.value })}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between mt-auto">
                                                <button onClick={() => setPaperStep(0)} className="text-gray-400 hover:text-white px-4">Back</button>
                                                <button onClick={generatePreview} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">Next: Preview</button>
                                            </div>
                                        </div>
                                    )}

                                    {paperStep === 2 && (
                                        <div className="flex flex-col h-full gap-4">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-lg text-white font-bold">Step 3: Preview & Print</h4>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setPaperStep(1)} className="text-gray-400 hover:text-white px-3">Back</button>
                                                    <button onClick={printPaper} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2">
                                                        <Printer className="h-4 w-4" /> Print Paper
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
                                                <div className="flex flex-col gap-2">
                                                    <div className="bg-gray-900 px-3 py-1 text-xs text-gray-400 font-bold uppercase">JSON Source (Editable)</div>
                                                    <textarea
                                                        className="flex-1 bg-gray-900 border border-gray-700 text-green-400 font-mono p-4 rounded text-xs resize-none focus:outline-none focus:border-blue-500"
                                                        value={paperJson}
                                                        onChange={handlePaperJsonChange}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-2 h-full">
                                                    <div className="bg-gray-200 px-3 py-1 text-xs text-gray-600 font-bold uppercase">Live Preview</div>
                                                    <div className="flex-1 bg-white rounded border border-gray-300 h-full overflow-hidden">
                                                        <iframe
                                                            id="paper-preview-frame"
                                                            srcDoc={paperHtml}
                                                            className="w-full h-full"
                                                            style={{ border: 'none' }}
                                                            title="Paper Preview"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Duplicate Resolution Modal */}
                {
                    isDuplicateModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700 shadow-2xl">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <RefreshCw className="h-5 w-5 text-yellow-500" /> Duplicate Questions Found
                                </h3>
                                <p className="text-gray-300 mb-6">
                                    {duplicateQuestions.length} questions already exist in the database with the exact same text. How would you like to proceed?
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button onClick={() => resolveDuplicates('overwrite')} className="bg-red-600 hover:bg-red-500 text-white py-3 rounded font-bold">
                                        Overwrite Existing (Update)
                                    </button>
                                    <button onClick={() => resolveDuplicates('keep')} className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold">
                                        Keep Both (Create New)
                                    </button>
                                    <button onClick={() => setIsDuplicateModalOpen(false)} className="bg-gray-700 hover:bg-gray-600 text-white py-2 rounded">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    );
}
