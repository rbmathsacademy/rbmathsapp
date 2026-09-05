'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, Plus, FileJson, FileText, Trash2, Download, Save, X, Printer, Edit, Upload, Copy, ExternalLink, RefreshCw, Check, ChevronDown, ToggleLeft, ToggleRight, GraduationCap, ArrowLeft, ArrowRightCircle, Search, BarChart2, Pencil } from 'lucide-react';
import { toast } from 'react-hot-toast';
import 'katex/dist/katex.min.css';
import 'katex/dist/katex.min.css';
import Link from 'next/link';
import QuestionRow from './components/QuestionRow';
import Latex from 'react-latex-next';
import LineNumberTextarea from '../components/LineNumberTextarea';
import TokenUsageIndicator from './components/TokenUsageIndicator';
import FileUploadZone from './components/FileUploadZone';
import ExtractionProgress from './components/ExtractionProgress';
import AutoDebugger from './components/AutoDebugger';
import { AlertCircle } from 'lucide-react';

// --- MultiSelect Component ---
const MultiSelect = ({ options, selected, onChange, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(''); // Reset search when closing
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        let newSelected = selected.includes(value)
            ? selected.filter((item: string) => item !== value)
            : [...selected, value];

        // If selecting something other than "No Topic", remove "No Topic"
        if (value !== "No Topic" && !selected.includes(value)) {
            newSelected = newSelected.filter((item: string) => item !== "No Topic");
        }

        // If deselecting the last real topic, add "No Topic" back
        if (selected.includes(value) && newSelected.length === 0) {
            newSelected = ["No Topic"];
        }

        onChange(newSelected);
    };

    // Filter options based on search term
    const filteredOptions = options.filter((opt: string) =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-96 overflow-hidden flex flex-col">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                        <input
                            type="text"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-gray-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {/* Clear Selection Option */}
                    {selected.length > 0 && (
                        <div
                            className="px-3 py-2 hover:bg-red-900/30 cursor-pointer flex items-center gap-2 text-xs text-red-400 border-b border-gray-700 sticky top-[42px] bg-gray-800 z-10"
                            onClick={() => onChange([])}
                        >
                            <X className="h-3 w-3" /> Clear Selection
                        </div>
                    )}

                    {/* Options List */}
                    <div className="overflow-y-auto max-h-80">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500 italic">No matches found</div>
                        ) : (
                            filteredOptions.map((opt: string) => (
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
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const AI_PROMPT = `📋 SYSTEM PROMPT: Math QA Extraction & Formatting Expert

Role & Objective:
You are an expert Mathematics Content Extractor and Formatter. Your task is to extract mathematics questions from provided documents/images, solve them with 100% accuracy, and format them into a strict JSON array.

You must strictly adhere to the structural, syntactical, and mathematical guidelines below. Do not deviate from these rules under any circumstances.
1. JSON Structure & Data Fields

Your output must be a valid JSON array containing objects with the following keys:

    id: Generate a truly random, unique alphanumeric string of at least 8 characters, prefixed by the topic (e.g., "q_quad_a8x9v2m4"). Do NOT use sequential patterns (like a1b2c3).

    examNames: An array of strings. Follow the user's specific instruction for the batch (e.g., ["Practice"], ["WBCHSE 2019"], or ["School Name | Exam | Year"]).

    marks: Extract from the source. If not provided, assign 1 for MCQs.

    options: An array of strings. For MCQs, extract the options here and remove all labels (e.g., "a)", "1.", "(i)"). If the question is not an MCQ, this MUST be an empty array []. Do not put options inside the text field.

    subtopic: A suitable subtopic string based on the question content.

    topic: The main topic string (e.g., "Quadratic Equations", "Relation & Functions").

    type: Must be strictly one of: "mcq", "short", "broad", or "blanks". (Proofs/long multi-step questions are "broad", 1-2 step questions are "short").

    text: The clean question text. Remove question numbers (e.g., "Q1.", "12)").

    answer: The highly concise final answer. If it's an equation, just output the equation (e.g., "$x^2 - 4x + 13 = 0$"). If it's a proof, output exactly "Proved."

    hint: 1 to 3 sentences guiding the student on how to approach the problem (e.g., what formula to use). Never give away the final calculation or answer here.

    explanation: The full, step-by-step mathematical solution following the exact style guide below.

2. Strict LaTeX & JSON Escaping (CRITICAL)

Because your output is JSON, every single LaTeX backslash must be double-escaped to prevent JSON parsing errors.

    Write: \\\\frac{a}{b}, \\\\sqrt{x}, \\\\mathbb{R}, \\\\pm, \\\\{, \\\\}.

    Do NOT write: \\frac{a}{b}, \\sqrt{x}, \\mathbb{R}, \\{.

    Math Delimiters: Enclose all mathematical expressions, variables, and numbers in single dollar signs $ ... $. Do NOT use block math $$...$$ or \\\\[ \\\\]. Keep everything inline.

    No Unicode Math: Never use raw Unicode characters for mathematical operations or Greek letters.

        Bad: a ≤ b, x × y, π, θ, →, ±

        Good: a \\\\le b, x \\\\times y, \\\\pi, \\\\theta, \\\\rightarrow, \\\\pm

3. The "Signature" Explanation Style (MANDATORY)

The explanation string must be visually structured using specific LaTeX tricks to simulate line breaks and bold headings within a single JSON string.

    Step Headings: Every step must begin with an underlined text block using this exact syntax:
    $\\\\underline{\\\\text{Step X: [Brief Title]}}$

    Line Breaks: You must NOT use standard newline characters (\\n) or HTML tags (<br>). Instead, use a double-escaped LaTeX newline enclosed in math delimiters, preceded and followed by a space: $\\\\\\\\$

    Flow: <Step Heading> $\\\\\\\\$ <Math/Text> $\\\\\\\\$ <Step Heading> $\\\\\\\\$ <Math/Text>

Example of a Perfect Explanation String:

    "$\\\\underline{\\\\text{Step 1: Set up the equation}}$ $\\\\\\\\$ Let $y = f(x)$. So, $y = \\\\frac{5}{3x+1}$. $\\\\\\\\$ $\\\\underline{\\\\text{Step 2: Swap variables}}$ $\\\\\\\\$ To find the inverse, interchange $x$ and $y$: $\\\\\\\\$ $x = \\\\frac{5}{3y+1}$. $\\\\\\\\$ $\\\\underline{\\\\text{Step 3: Solve for y}}$ $\\\\\\\\$ Multiply both sides by $(3y+1)$ to get $x(3y+1) = 5$."

4. Mathematical Accuracy & Approach

    Always double-check calculations. If a source document has a wrong answer, provide the mathematically correct answer and explanation.

    Use traditional and rigorous mathematical approaches (e.g., using Vieta's formulas/relation between roots and coefficients for quadratic equations, Principle of Inclusion-Exclusion for sets, etc.).

Output ONLY the valid JSON array starting with [ and ending with ].`;

const PREDEFINED_BATCHES = [
    '1st/3rd Sem Major/Minor',
    '2nd/4th Sem Major/Minor',
    '3rd Sem Major',
    '4th Sem Major',
    '5th Sem Major',
    '5th Sem Minor',
    '6th Sem Major',
    'Class XI',
    'Class XI JEE',
    'Class XII',
    'Class XII JEE',
    'Class XI Applied Maths',
    'Class XII Applied Maths',
    'BCA',
    '1st Sem Engg',
    '2nd Sem Engg',
    '3rd Sem Engg',
    '4th Sem Engg',
    '1st/3rd Sem Statistics',
    '2nd/4th Sem Statistics',
    '5th Sem Statistics',
];

type EditorMode = 'manual' | 'json' | 'image' | 'pdf' | 'latex';

export default function QuestionBank() {
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<EditorMode>('manual');
    const [manualData, setManualData] = useState({ id: '', type: 'broad', topic: '', subtopic: '', text: '', examNames: [] as string[], examName: '', marks: '' as number | string });
    const [jsonContent, setJsonContent] = useState('');
    const [previewContent, setPreviewContent] = useState<any[]>([]);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [editScrollPosition, setEditScrollPosition] = useState<number>(0);

    const [errorLine, setErrorLine] = useState<number | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const lastEditedId = useRef<string | null>(null);

    // AI Extraction State
    const [quotaExhausted, setQuotaExhausted] = useState(false);
    const [isAiExtracting, setIsAiExtracting] = useState(false);
    const [extractionStage, setExtractionStage] = useState<'idle' | 'initializing' | 'processing' | 'analyzing' | 'extracting' | 'parsing' | 'validating' | 'complete' | 'error'>('idle');
    const [extractionProgress, setExtractionProgress] = useState(0);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [validationIssues, setValidationIssues] = useState<any[]>([]);
    const [usageRefreshTrigger, setUsageRefreshTrigger] = useState(0);



    // Duplicate Detection State (text-based)
    const [duplicateQuestions, setDuplicateQuestions] = useState<any[]>([]);
    const [newQuestions, setNewQuestions] = useState<any[]>([]);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // ID Clash Detection State
    const [idClashQuestions, setIdClashQuestions] = useState<Array<{ incoming: any; existing: any }>>([]);
    const [isIdClashModalOpen, setIsIdClashModalOpen] = useState(false);
    const [pendingSaveQuestions, setPendingSaveQuestions] = useState<any[]>([]);

    // Trash Modal State
    const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
    const [trashQuestions, setTrashQuestions] = useState<any[]>([]);
    const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());
    const [trashLoading, setTrashLoading] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');

    // Filter State
    const [selectedTopics, setSelectedTopics] = useState<string[]>(["No Topic"]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [selectedExams, setSelectedExams] = useState<string[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [selectedUploadedBy, setSelectedUploadedBy] = useState<string[]>([]);
    const [availableBatches, setAvailableBatches] = useState<string[]>([]);
    // Singular Selection for Modal
    const [selectedTopic, setSelectedTopic] = useState('');
    const [selectedSubtopic, setSelectedSubtopic] = useState('');

    const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Server-loaded filter metadata (for instant filter loading)
    const [serverFilters, setServerFilters] = useState<{ topics: string[]; subtopics: string[]; examNames: string[]; batches: string[]; uploadedBys: string[] }>({ topics: [], subtopics: [], examNames: [], batches: [], uploadedBys: [] });
    const [filtersLoading, setFiltersLoading] = useState(true);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [isGlobalSearching, setIsGlobalSearching] = useState(false);


    // Batch Tagging Modal State
    const [isBatchTagModalOpen, setIsBatchTagModalOpen] = useState(false);
    const [batchTagTarget, setBatchTagTarget] = useState<string>(''); // single batch (always set/replace)
    const [batchTagLoading, setBatchTagLoading] = useState(false);

    // Merge Modal State
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [mergeIdsInput, setMergeIdsInput] = useState('');
    const [mergeQuestions, setMergeQuestions] = useState<any[]>([]);
    const [mergePrimaryId, setMergePrimaryId] = useState<string>('');
    const [mergeLoading, setMergeLoading] = useState(false);
    const [mergeFetchError, setMergeFetchError] = useState<string | null>(null);

    // Analytics Modal State
    const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
    const [analyticsData, setAnalyticsData] = useState<{ total: number; untagged: number; perBatch: Record<string, number> } | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // Bulk Rename Modal State
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameField, setRenameField] = useState<'topic' | 'subtopic' | 'examName'>('topic');
    const [renameOldValue, setRenameOldValue] = useState('');
    const [renameNewValue, setRenameNewValue] = useState('');
    const [renameLoading, setRenameLoading] = useState(false);

    // Helper: filter questions by selected batches
    const filterByBatches = (qs: any[]) => {
        if (selectedBatches.length === 0) return qs;
        return qs.filter(q => {
            const qBatches = q.batches || [];
            const wantUntagged = selectedBatches.includes('Untagged');
            const realBatches = selectedBatches.filter((b: string) => b !== 'Untagged');
            return (wantUntagged && qBatches.length === 0) ||
                (realBatches.length > 0 && realBatches.some((b: string) => qBatches.includes(b)));
        });
    };

    // Derived Lists - Cascading Topics based on selected batches, exams, and subtopics
    const topics = useMemo(() => {
        const hasNarrowing = selectedExams.length > 0 || selectedBatches.length > 0 || selectedSubtopics.length > 0;
        
        // When no narrowing filters are selected and no questions loaded, show ALL topics from server
        if (!hasNarrowing && questions.length === 0 && serverFilters.topics.length > 0) {
            return ["No Topic", ...serverFilters.topics];
        }

        const set = new Set<string>();
        let filtered = filterByBatches(questions);
        if (selectedSubtopics.length > 0) {
            filtered = filtered.filter(q => selectedSubtopics.includes(q.subtopic));
        }
        if (selectedExams.length > 0) {
            filtered = filtered.filter(q => {
                const qExams = q.examNames || (q.examName ? [q.examName] : []);
                return qExams.some((e: string) => selectedExams.includes(e));
            });
        }
        filtered.forEach(q => set.add(q.topic));
        
        // Also merge serverFilters when no narrowing is active
        if (!hasNarrowing && serverFilters.topics.length > 0) {
            serverFilters.topics.forEach((t: string) => set.add(t));
        }
        const actualTopics = Array.from(set).filter(Boolean).sort();
        return ["No Topic", ...actualTopics];
    }, [questions, selectedSubtopics, selectedExams, selectedBatches, serverFilters]);

    // Cascading Subtopics: Filter based on selected topics and exams
    const subtopics = useMemo(() => {
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        let filtered = filterByBatches(questions);
        if (actualTopics.length > 0) {
            filtered = filtered.filter(q => actualTopics.includes(q.topic));
        }
        if (selectedExams.length > 0) {
            filtered = filtered.filter(q => {
                const qExams = q.examNames || (q.examName ? [q.examName] : []);
                return qExams.some((e: string) => selectedExams.includes(e));
            });
        }
        return Array.from(new Set(filtered.map(q => q.subtopic))).filter(Boolean).sort();
    }, [questions, selectedTopics, selectedExams, selectedBatches]);

    // Cascading Exam Names: use serverFilters when no topic selected (allows independent exam filtering)
    const examNames = useMemo(() => {
        // When no topic selected and no questions loaded, show ALL exam names from server
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        if (actualTopics.length === 0 && questions.length === 0 && serverFilters.examNames.length > 0) {
            return serverFilters.examNames;
        }
        const set = new Set<string>();
        let filtered = filterByBatches(questions);
        if (actualTopics.length > 0) {
            filtered = filtered.filter(q => actualTopics.includes(q.topic));
        }
        if (selectedSubtopics.length > 0) {
            filtered = filtered.filter(q => selectedSubtopics.includes(q.subtopic));
        }
        filtered.forEach(q => {
            if (q.examNames && Array.isArray(q.examNames)) q.examNames.forEach((e: string) => set.add(e));
            else if (q.examName) set.add(q.examName);
        });
        // Also merge serverFilters when no topic narrowing is active
        if (actualTopics.length === 0 && serverFilters.examNames.length > 0) {
            serverFilters.examNames.forEach((e: string) => set.add(e));
        }
        return Array.from(set).filter(Boolean).sort();
    }, [questions, selectedTopics, selectedSubtopics, selectedBatches, serverFilters]);

    // Derived batch names from questions only — union of all batches stored on question documents
    const availableBatchNames = useMemo(() => {
        const set = new Set<string>();
        // Seed with all batches from the questions filters API (covers all questions, not just loaded ones)
        serverFilters.batches.forEach(b => { if (b) set.add(b); });
        // Also add batches visible in the currently loaded + filtered questions
        let filtered = questions;
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        if (actualTopics.length > 0) filtered = filtered.filter(q => actualTopics.includes(q.topic));
        if (selectedSubtopics.length > 0) filtered = filtered.filter(q => selectedSubtopics.includes(q.subtopic));
        if (selectedExams.length > 0) {
            filtered = filtered.filter(q => {
                const qExams = q.examNames || (q.examName ? [q.examName] : []);
                return qExams.some((e: string) => selectedExams.includes(e));
            });
        }
        filtered.forEach(q => {
            if (q.batches && Array.isArray(q.batches)) q.batches.forEach((b: string) => set.add(b));
        });
        const batchNames = Array.from(set).filter(Boolean).sort();
        return ['Untagged', ...batchNames];
    }, [questions, selectedTopics, selectedSubtopics, selectedExams, serverFilters.batches]);



    // Compute filtered questions based on selected topics and subtopics
    const filteredQuestions = useMemo(() => {
        // If "No Topic" is selected and no search/batch, return empty
        if (selectedTopics.includes("No Topic") && !searchQuery && !isGlobalSearching && selectedBatches.length === 0) {
            return [];
        }
        // If global search results are loaded, show all
        if (isGlobalSearching || (globalSearchQuery && questions.length > 0 && selectedTopics.includes("No Topic"))) {
            return questions;
        }

        // Filter out "No Topic" for actual filtering
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");

        return questions.filter(q => {
            const topicMatch = actualTopics.length === 0 || actualTopics.includes(q.topic);
            const subtopicMatch = selectedSubtopics.length === 0 || selectedSubtopics.includes(q.subtopic);

            const qExams = q.examNames || (q.examName ? [q.examName] : []);
            const examMatch = selectedExams.length === 0 || selectedExams.some(e => qExams.includes(e));

            // Batch filter
            let batchMatch = true;
            if (selectedBatches.length > 0) {
                const qBatches = q.batches || [];
                const wantUntagged = selectedBatches.includes('Untagged');
                const realBatches = selectedBatches.filter(b => b !== 'Untagged');
                batchMatch = (wantUntagged && qBatches.length === 0) ||
                    (realBatches.length > 0 && realBatches.some(b => qBatches.includes(b)));
            }

            const searchLower = searchQuery.toLowerCase();
            const searchMatch = !searchQuery ||
                (q.text || '').toLowerCase().includes(searchLower) ||
                (q.topic || '').toLowerCase().includes(searchLower) ||
                (q.subtopic || '').toLowerCase().includes(searchLower) ||
                (q.id || '').toLowerCase().includes(searchLower);

            const uploadedByMatch = selectedUploadedBy.length === 0 || (q.uploadedBy ? selectedUploadedBy.includes(q.uploadedBy) : false);

            return topicMatch && subtopicMatch && examMatch && batchMatch && searchMatch && uploadedByMatch;
        });
    }, [questions, selectedTopics, selectedSubtopics, selectedExams, selectedBatches, selectedUploadedBy, searchQuery]);

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (user) {
            const parsed = JSON.parse(user);
            setUserEmail(parsed.email);
            setUserName(parsed.name);
            fetchFilters(parsed.email);
        }
    }, []);

    // Fetch lightweight filter metadata (instant)
    const fetchFilters = async (email: string) => {
        setFiltersLoading(true);
        try {
            const headers: any = { 'X-User-Email': email };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }
            const res = await fetch('/api/admin/questions/filters', { headers });
            if (res.ok) {
                const data = await res.json();
                setServerFilters(data);
            }
        } catch (error) {
            console.error('[FILTERS] Error:', error);
        } finally {
            setFiltersLoading(false);
        }
    };

    // Fetch questions with server-side filters (on-demand)
    const fetchQuestions = async (email: string, filters?: { topics?: string[]; subtopics?: string[]; exams?: string[]; batches?: string[]; uploadedBys?: string[]; search?: string }) => {
        setLoading(true);
        try {
            const headers: any = { 'X-User-Email': email };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }

            const params = new URLSearchParams();
            if (filters?.topics && filters.topics.length > 0) {
                params.set('topic', filters.topics.join('|||'));
            }
            if (filters?.subtopics && filters.subtopics.length > 0) {
                params.set('subtopic', filters.subtopics.join('|||'));
            }
            if (filters?.exams && filters.exams.length > 0) {
                params.set('exam', filters.exams.join('|||'));
            }
            if (filters?.batches && filters.batches.length > 0) {
                params.set('batch', filters.batches.join('|||'));
            }
            if (filters?.uploadedBys && filters.uploadedBys.length > 0) {
                params.set('uploadedBy', filters.uploadedBys.join('|||'));
            }
            if (filters?.search) {
                params.set('search', filters.search);
            }

            const url = `/api/admin/questions${params.toString() ? '?' + params.toString() : ''}`;
            const questionsRes = await fetch(url, { headers, cache: 'no-store' });

            if (questionsRes.ok) {
                const data = await questionsRes.json();
                const sorted = data.sort((a: any, b: any) => {
                    if (a.order !== b.order) return a.order - b.order;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                });
                setQuestions(sorted);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Trigger fetch when topic filter changes (lazy load)
    useEffect(() => {
        if (!userEmail) return;
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        if (actualTopics.length > 0) {
            fetchQuestions(userEmail, { topics: actualTopics, uploadedBys: selectedUploadedBy });
        } else {
            setQuestions([]); // No topic selected = empty
        }
    }, [selectedTopics, selectedUploadedBy, userEmail]);

    // Clear selection when topic changes to prevent stale cross-topic mass deletes
    useEffect(() => {
        setSelectedQuestionIds(new Set());
    }, [selectedTopics]);

    // When an exam is selected without a topic, fetch questions by exam so topics can cascade
    useEffect(() => {
        if (!userEmail || selectedExams.length === 0) return;
        const actualTopics = selectedTopics.filter(t => t !== 'No Topic');
        if (actualTopics.length === 0 && selectedBatches.length === 0) {
            // No topic and no batch selected — fetch by exam so the question list populates
            fetchQuestions(userEmail, { exams: selectedExams, uploadedBys: selectedUploadedBy });
        }
    }, [selectedExams]);

    // When a batch is selected without a topic, fetch questions by batch so topics can cascade
    useEffect(() => {
        if (!userEmail || selectedBatches.length === 0) return;
        const actualTopics = selectedTopics.filter(t => t !== 'No Topic');
        if (actualTopics.length === 0) {
            // No topic selected — fetch by batch so the question list populates
            fetchQuestions(userEmail, { batches: selectedBatches, exams: selectedExams, uploadedBys: selectedUploadedBy });
        }
    }, [selectedBatches]);

    // Global search handler
    const handleGlobalSearch = async () => {
        if (!userEmail || !globalSearchQuery.trim()) return;
        setIsGlobalSearching(true);
        try {
            const headers: any = { 'X-User-Email': userEmail };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }
            const res = await fetch(`/api/admin/questions?search=${encodeURIComponent(globalSearchQuery)}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setQuestions(data);
                setSelectedTopics(["No Topic"]); // Reset topic filter to show all results
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsGlobalSearching(false);
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
            let text = q.text;
            if (!text && q.content) text = q.content;
            let type = q.type;
            let id = q.id;
            if (!type && ['broad', 'mcq', 'blanks'].includes(q.id)) {
                type = q.id;
                id = null;
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
            // Check if text exists, but exclude the question itself if IDs match
            const exists = questions.find(existing =>
                existing.text.trim() === newQ.text.trim() &&
                existing.id !== newQ.id
            );
            if (exists) duplicates.push({ new: newQ, existing: exists });
            else unique.push(newQ);
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
        setJsonContent(e.target.value);
    };

    // Debounced JSON Parsing
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!jsonContent.trim()) {
                setPreviewContent([]);
                setJsonError(null);
                setErrorLine(null);
                return;
            }

            try {
                const parsed = JSON.parse(jsonContent);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                const normalized = normalizeImportedData(arr);
                // checkForDuplicates causing side effects (modal open), only run if valid
                if (normalized.length > 0) {
                    // For editor typing, we might strictly want to just preview, 
                    // but checkForDuplicates is useful. However, auto-opening modal while typing might be annoying.
                    // Let's keep it for now but user might request change later.
                    // Actually, checkForDuplicates sets previewContent if no dupes.
                    checkForDuplicates(normalized);
                }
                setJsonError(null);
                setErrorLine(null);
            } catch (e: any) {
                setJsonError((e as Error).message);
                const match = e.message.match(/position\s+(\d+)/);
                if (match) {
                    const pos = parseInt(match[1]);
                    const contentUpToError = jsonContent.substring(0, pos);
                    setErrorLine(contentUpToError.split('\n').length);
                }
            }
        }, 800); // 800ms debounce

        return () => clearTimeout(timeoutId);
    }, [jsonContent]);


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
            const updates = duplicateQuestions.map(d => ({
                ...d.new,
                id: d.existing.id
            }));
            finalContent = [...finalContent, ...updates];
        } else {
            const news = duplicateQuestions.map(d => ({
                ...d.new,
                id: null
            }));
            finalContent = [...finalContent, ...news];
        }
        setPreviewContent(finalContent);
        setIsDuplicateModalOpen(false);
        setDuplicateQuestions([]);
        setNewQuestions([]);
    };

    // Cursor sync removed - Row based layout handles this naturally

    const handleRowChange = (index: number, updatedQuestion: any) => {
        const newContent = [...previewContent];
        newContent[index] = updatedQuestion;
        setPreviewContent(newContent);
    };

    const handleRowDelete = (index: number) => {
        const newContent = [...previewContent];
        newContent.splice(index, 1);
        setPreviewContent(newContent);
    };

    const handleAddNewQuestion = () => {
        setPreviewContent([...previewContent, {
            id: `q_${Date.now()}`,
            text: "New Question Text",
            type: "broad",
            topic: "Topic",
            subtopic: "Subtopic"
        }]);
        // Auto-scroll removed
    };


    const copyPrompt = () => {
        navigator.clipboard.writeText(AI_PROMPT);
        alert("Prompt copied to clipboard!");
    };

    const saveToDatabase = async (questionsToSave?: any[]) => {
        try {
            const toSaveRaw = questionsToSave || previewContent;
            console.log('[saveToDatabase] Called. previewContent length:', previewContent.length, 'toSaveRaw length:', toSaveRaw.length);
            if (toSaveRaw.length === 0) {
                if (jsonError) {
                    alert(`Cannot save. Please fix the JSON syntax error:\n${jsonError}`);
                } else {
                    alert('No valid questions found to save. Please check your JSON format.');
                }
                return;
            }
            const invalid = toSaveRaw.find((q: any) => !q.topic || !q.subtopic || !q.text);
            if (invalid) {
                alert('All questions must have a Topic, Subtopic, and Text.');
                return;
            }

            const toSave = toSaveRaw.map((q: any) => ({
                ...q,
                id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                topic: q.topic.charAt(0).toUpperCase() + q.topic.slice(1),
                subtopic: q.subtopic.charAt(0).toUpperCase() + q.subtopic.slice(1),
                type: q.type || 'broad'
            }));

            // ── ID Clash Check ──────────────────────────────────────────────
            // Before saving, check if any incoming IDs already exist in the DB
            // for a DIFFERENT question (different text). This prevents silent overwrites.
            try {
                const incomingIds = toSave.map((q: any) => q.id).filter(Boolean);
                if (incomingIds.length > 0) {
                    const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': userEmail || '' };
                    if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                        headers['X-Global-Admin-Key'] = 'globaladmin_25';
                    }
                    const checkRes = await fetch('/api/admin/questions/check-id-clash', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ ids: incomingIds })
                    });
                    if (checkRes.ok) {
                        const { clashes } = await checkRes.json();
                        if (clashes && clashes.length > 0) {
                            // Build clash pairs: incoming question vs existing DB question
                            const clashPairs = clashes.map((existing: any) => ({
                                incoming: toSave.find((q: any) => q.id === existing.id),
                                existing
                            })).filter((c: any) => {
                                if (!c.incoming) return false;
                                // Exclude if it's the exact question we clicked 'Edit' on
                                if (c.incoming.id === lastEditedId.current) return false;
                                // Exclude if the text is completely identical (harmless overwrite)
                                if (c.incoming.text.trim() === c.existing.text.trim()) return false;
                                return true;
                            });

                            if (clashPairs.length > 0) {
                                setIdClashQuestions(clashPairs);
                                setPendingSaveQuestions(toSave);
                                setIsIdClashModalOpen(true);
                                return; // Stop — wait for admin to decide
                            }
                        }
                    }
                }
            } catch (e) {
                // If clash check fails, proceed with save (fail-open)
                console.warn('ID clash check failed, proceeding with save:', e);
            }
            // ────────────────────────────────────────────────────────────────

            await performSave(toSave);
        } catch (error: any) {
            console.error('[saveToDatabase] UNCAUGHT ERROR:', error);
            alert(`Save failed with an unexpected error:\n${error?.message || error}`);
        }
    };

    // Auto-fix clashing IDs by appending 6 random chars, then save
    const resolveIdClashes = () => {
        const clashingIds = new Set(idClashQuestions.map(c => c.incoming.id));
        const fixed = pendingSaveQuestions.map((q: any) => {
            if (clashingIds.has(q.id)) {
                const suffix = Math.random().toString(36).substr(2, 6);
                return { ...q, id: `${q.id}_${suffix}` };
            }
            return q;
        });
        setIsIdClashModalOpen(false);
        setIdClashQuestions([]);
        setPendingSaveQuestions([]);
        performSave(fixed);
    };

    const performSave = async (toSave: any[]) => {

        setLoading(true);
        try {
            const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': userEmail || '' };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }

            const res = await fetch('/api/admin/questions', {
                method: 'POST',
                headers,
                body: JSON.stringify({ questions: toSave })
            });

            if (res.ok) {
                toast.success('Saved successfully!');
                setIsEditorOpen(false);
                setManualData({ id: '', type: 'broad', topic: '', subtopic: '', text: '', examNames: [], examName: '', marks: '' });
                setJsonContent('');
                setPreviewContent([]);

                // Get the ID of the question we just saved (if editing one)
                // If it was a new question, we might not have the ID unless we return it from API, 
                // but for edits we have manualData.id or lastEditedId
                const targetId = lastEditedId.current;

                if (userEmail) {
                    await fetchFilters(userEmail); // Refresh filters for new topics
                    const actualTopics = selectedTopics.filter(t => t !== "No Topic");
                    if (actualTopics.length > 0) {
                        await fetchQuestions(userEmail, { topics: actualTopics });
                    } else {
                        // Auto-select the topic(s) of newly saved questions so they appear immediately
                        const savedTopics = [...new Set(toSave.map(q => q.topic))];
                        if (savedTopics.length > 0) {
                            setSelectedTopics(savedTopics); // This triggers the useEffect to fetch questions
                        }
                    }
                }

                // Auto-scroll to edited question
                if (targetId) {
                    setTimeout(() => {
                        const element = document.getElementById(`q-${targetId}`);
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Highlight effect
                            element.classList.add('ring-2', 'ring-purple-500');
                            setTimeout(() => element.classList.remove('ring-2', 'ring-purple-500'), 2000);
                        }
                    }, 500); // Wait for list to re-render
                }

                lastEditedId.current = null;
            } else {
                let errMsg = 'Failed to save.';
                try {
                    const errData = await res.json();
                    if (errData.error) errMsg = `API Error: ${errData.error}`;
                } catch (e) {}
                alert(errMsg);
                toast.error('Failed to save.');
            }
        } catch (error) {
            toast.error('Error saving questions.');
        } finally {
            setLoading(false);
        }
    };

    // --- Viewer Logic ---

    const toggleSelectAll = () => {
        if (selectedQuestionIds.size === filteredQuestions.length) {
            setSelectedQuestionIds(new Set());
        } else {
            setSelectedQuestionIds(new Set(filteredQuestions.map(q => q.id)));
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedQuestionIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedQuestionIds(newSet);
    };

    // ── Merge Tool ────────────────────────────────────────────────────────
    const fetchMergeQuestions = async () => {
        const ids = mergeIdsInput.split(',').map(s => s.trim()).filter(Boolean);
        if (ids.length < 2) { setMergeFetchError('Enter at least 2 question IDs separated by commas.'); return; }
        setMergeLoading(true);
        setMergeFetchError(null);
        try {
            const headers: any = { 'X-User-Email': userEmail || '' };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }
            const params = new URLSearchParams();
            // fetch all — we'll filter client-side by ID
            const res = await fetch(`/api/admin/questions?ids=${ids.join('|||')}`, { headers });
            if (!res.ok) throw new Error('Failed to fetch');
            // The API might not support ids param — fallback: use global search per ID
            // We'll use the existing route and filter
            const all = await res.json();
            const matched = Array.isArray(all) ? all.filter((q: any) => ids.includes(q.id)) : [];
            if (matched.length === 0) {
                setMergeFetchError('No questions found for those IDs. Make sure IDs are correct.');
            } else {
                setMergeQuestions(matched);
                setMergePrimaryId(matched[0].id);
            }
        } catch (e: any) {
            setMergeFetchError(e.message || 'Error fetching questions');
        } finally {
            setMergeLoading(false);
        }
    };

    const handleMerge = async () => {
        if (!mergePrimaryId || mergeQuestions.length < 2) return;
        setMergeLoading(true);
        try {
            const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': userEmail || '' };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }
            // Union all examNames
            const allExamNames = Array.from(new Set(
                mergeQuestions.flatMap((q: any) => q.examNames || (q.examName ? [q.examName] : []))
            ));
            const primary = mergeQuestions.find((q: any) => q.id === mergePrimaryId);
            if (!primary) return;
            // Update primary
            await fetch('/api/admin/questions', {
                method: 'POST',
                headers,
                body: JSON.stringify({ questions: [{ ...primary, examNames: allExamNames }] })
            });
            // Soft-delete the others
            const otherIds = mergeQuestions.filter((q: any) => q.id !== mergePrimaryId).map((q: any) => q.id);
            if (otherIds.length > 0) {
                await fetch('/api/admin/questions', {
                    method: 'DELETE',
                    headers,
                    body: JSON.stringify({ ids: otherIds })
                });
            }
            toast.success(`Merged ${mergeQuestions.length} questions. ExamNames combined: ${allExamNames.join(', ')}`);
            setIsMergeModalOpen(false);
            setMergeQuestions([]);
            setMergeIdsInput('');
            setMergePrimaryId('');
            if (userEmail) {
                await fetchFilters(userEmail);
                const actualTopics = selectedTopics.filter(t => t !== 'No Topic');
                if (actualTopics.length > 0) fetchQuestions(userEmail, { topics: actualTopics });
            }
        } catch (e: any) {
            toast.error('Merge failed: ' + e.message);
        } finally {
            setMergeLoading(false);
        }
    };

    // ── Analytics ─────────────────────────────────────────────────────────
    const openAnalytics = async () => {
        setIsAnalyticsModalOpen(true);
        setAnalyticsLoading(true);
        try {
            const headers: any = { 'X-User-Email': userEmail || '' };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }
            const res = await fetch('/api/admin/questions/analytics', { headers });
            if (res.ok) setAnalyticsData(await res.json());
        } catch (e) { console.error(e); }
        finally { setAnalyticsLoading(false); }
    };

    const openTrash = async () => {
        setIsTrashModalOpen(true);
        setTrashLoading(true);
        try {
            const headers: any = { 'X-User-Email': userEmail || '' };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }
            const res = await fetch('/api/admin/questions/trash', { headers });
            if (res.ok) {
                const data = await res.json();
                setTrashQuestions(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setTrashLoading(false);
        }
    };

    const handleTrashAction = async (action: 'restore' | 'purge') => {
        if (selectedTrashIds.size === 0) return;
        setTrashLoading(true);
        try {
            const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': userEmail || '' };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }
            const res = await fetch('/api/admin/questions/trash', {
                method: 'POST',
                headers,
                body: JSON.stringify({ ids: Array.from(selectedTrashIds), action })
            });
            if (res.ok) {
                toast.success(`Questions ${action === 'restore' ? 'restored' : 'permanently deleted'}`);
                setSelectedTrashIds(new Set());
                setDeleteConfirmation('');
                await openTrash(); // Refresh trash list
                
                // Refresh main list if restored
                if (action === 'restore' && userEmail) {
                    await fetchFilters(userEmail);
                    const actualTopics = selectedTopics.filter((t: string) => t !== "No Topic");
                    if (actualTopics.length > 0) {
                        await fetchQuestions(userEmail, { topics: actualTopics, uploadedBys: selectedUploadedBy });
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setTrashLoading(false);
        }
    };

    const deleteSelected = async () => {
        if (selectedQuestionIds.size === 0) return;

        // Hard guard: if deleting more than 3 questions, require typed confirmation
        if (selectedQuestionIds.size > 3) {
            const topics = [...new Set(filteredQuestions
                .filter(q => selectedQuestionIds.has(q.id))
                .map(q => q.topic))].join(', ');
            const typed = window.prompt(
                `⚠️ WARNING: You are about to permanently delete ${selectedQuestionIds.size} questions from topic(s): "${topics}".\n\nThis CANNOT be undone. Type DELETE to confirm.`
            );
            if (typed !== 'DELETE') {
                alert('Cancelled. You must type DELETE exactly to confirm bulk deletion.');
                return;
            }
        } else {
            if (!confirm(`Delete ${selectedQuestionIds.size} question${selectedQuestionIds.size > 1 ? 's' : ''}?`)) return;
        }

        // Capture the IDs NOW before any state changes
        const idsToDelete = new Set(selectedQuestionIds);

        setLoading(true);
        try {
            const res = await fetch('/api/admin/questions', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail || ''
                },
                body: JSON.stringify({ ids: Array.from(idsToDelete) })
            });

            if (res.ok) {
                setSelectedQuestionIds(new Set());
                if (userEmail) {
                    const actualTopics = selectedTopics.filter(t => t !== 'No Topic');
                    if (actualTopics.length > 0) {
                        fetchQuestions(userEmail, { topics: actualTopics });
                    } else {
                        setQuestions(prev => prev.filter(q => !idsToDelete.has(q.id)));
                    }
                }
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

    const handleModeSwitch = (mode: 'manual' | 'json' | 'pdf' | 'latex' | 'image') => {
        setEditorMode(mode);
        setManualData({ id: '', type: 'broad', topic: '', subtopic: '', text: '', examNames: [], examName: '', marks: '' });
        setJsonContent('');
        setJsonError(null);
        setErrorLine(null);
        lastEditedId.current = null;

        if (mode === 'latex' || mode === 'image') {
            // Auto-initialize with one empty question so editor is visible
            setPreviewContent([{
                id: crypto.randomUUID(),
                type: 'broad',
                topic: '',
                subtopic: '',
                text: '',
                image: ''
            }]);
        } else {
            setPreviewContent([]);
        }

        setIsEditorOpen(true);
    };

    const handleEditQuestion = (question: any) => {
        console.log('[DEBUG] handleEditQuestion called for:', question.id);
        try {
            // Capture current scroll position
            setEditScrollPosition(window.scrollY);
            lastEditedId.current = question.id;

            // Load question into JSON editor
            const questionArray = [question];
            setJsonContent(JSON.stringify(questionArray, null, 2));
            setPreviewContent(questionArray);

            // Switch to JSON editor mode
            console.log('[DEBUG] Switching to JSON mode and opening editor');
            setEditorMode('json');
            setIsEditorOpen(true);

            // Scroll to top
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
        } catch (error) {
            console.error('[DEBUG] Error in handleEditQuestion:', error);
            toast.error("Failed to open editor");
        }
    };

    // AI Extraction Handlers
    const handleAiExtraction = async (files: File[]) => {
        if (!userEmail || quotaExhausted) {
            toast.error('Cannot extract: quota exhausted');
            return;
        }

        setIsAiExtracting(true);
        setExtractionStage('initializing');
        setExtractionProgress(0);
        setExtractionError(null);
        setValidationIssues([]);

        const allExtractedQuestions: any[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setExtractionStage('processing');
                setExtractionProgress((i / files.length) * 90);

                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/admin/questions/extract', {
                    method: 'POST',
                    headers: {
                        'X-User-Email': userEmail
                    },
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Extraction failed');
                }

                const data = await response.json();
                allExtractedQuestions.push(...data.questions);
            }

            setExtractionStage('validating');
            const issues: any[] = [];

            allExtractedQuestions.forEach((q, index) => {
                if (!q.text || !q.type || !q.topic || !q.subtopic) {
                    issues.push({ line: index + 1, message: 'Missing required fields' });
                }
            });

            setValidationIssues(issues);

            const jsonString = JSON.stringify(allExtractedQuestions, null, 2);
            setJsonContent(jsonString);

            const normalized = normalizeImportedData(allExtractedQuestions);
            checkForDuplicates(normalized);

            setExtractionProgress(100);
            setExtractionStage('complete');
            setEditorMode('pdf'); // Keep user in PDF/AI Editor mode
            setIsEditorOpen(true);
            setUsageRefreshTrigger(prev => prev + 1);

            toast.success(`Extracted ${allExtractedQuestions.length} questions!`);

        } catch (error: any) {
            console.error('AI Extraction error:', error);
            setExtractionStage('error');
            setExtractionError(error.message || 'Unknown error occurred');
            toast.error(error.message || 'Extraction failed');
        } finally {
            setIsAiExtracting(false);
        }
    };

    const handleAutoFix = (fixedJSON: string) => {
        setJsonContent(fixedJSON);
        handleJsonInput({ target: { value: fixedJSON } } as any);
    };

    const handleRetryExtraction = () => {
        setExtractionStage('idle');
        setExtractionError(null);
        setValidationIssues([]);
    };


    const editQuestion = (q: any) => {
        // Scroll to top so user can see the editor
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
        lastEditedId.current = q.id;

        setManualData({
            id: q.id,
            type: q.type,
            topic: q.topic,
            subtopic: q.subtopic,
            text: q.text,
            examNames: q.examNames || [],
            examName: q.examName || '',
            marks: q.marks || ''
        });
        setPreviewContent([{ ...q, facultyName: userName }]);
        setEditorMode('manual');
        setIsEditorOpen(true);
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


    return (
        <div className="p-4 md:p-8 space-y-6 h-full flex flex-col">
            <datalist id="topics-list">
                {topics.map(t => <option key={t} value={t} />)}
            </datalist>
            <datalist id="subtopics-list">
                {subtopics.map(t => <option key={t} value={t} />)}
            </datalist>
            {/* Question Bank View (Visible when Editor is closed) */}
            {!isEditorOpen && (
                <div className="space-y-6 h-full flex flex-col">
                    {/* Header */}
                    <div className="flex flex-col gap-4 border-b border-gray-800 pb-4 md:pb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-800 rounded-lg transition-colors bg-slate-800/50 md:bg-transparent">
                                    <ArrowLeft className="h-5 w-5 text-slate-400" />
                                </button>
                                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 hidden md:block">
                                    <FileText className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                                        Question Bank
                                    </h1>
                                    <p className="text-xs text-slate-400 font-medium">{questions.length} questions • {selectedQuestionIds.size} selected</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            <button onClick={() => handleModeSwitch('json')} className="col-span-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 px-3 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all">
                                <FileJson className="h-3 w-3 md:h-4 md:w-4" />
                                <span className="hidden sm:inline">Import JSON</span>
                                <span className="sm:hidden">Import</span>
                            </button>
                            <button onClick={() => handleModeSwitch('latex')} className="col-span-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/30 px-3 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all">
                                <Plus className="h-3 w-3 md:h-4 md:w-4" />
                                <span className="hidden sm:inline">Add New</span>
                                <span className="sm:hidden">Add</span>
                            </button>

                        </div>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 ml-1">Topic</label>
                            <MultiSelect options={topics} selected={selectedTopics} onChange={setSelectedTopics} placeholder="All Topics" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 ml-1">Subtopic</label>
                            <MultiSelect options={subtopics} selected={selectedSubtopics} onChange={setSelectedSubtopics} placeholder="All Subtopics" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 ml-1">Exam</label>
                            <MultiSelect options={examNames} selected={selectedExams} onChange={setSelectedExams} placeholder="All Exams" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-medium text-gray-500">Batch</label>
                                <button 
                                    onClick={() => setSelectedBatches(['Untagged'])}
                                    className="text-[10px] text-amber-500 hover:text-amber-400 font-bold transition-colors"
                                    title="Show topics with questions not linked to any batch"
                                >
                                    Untagged Topics
                                </button>
                            </div>
                            <MultiSelect options={availableBatchNames} selected={selectedBatches} onChange={setSelectedBatches} placeholder="All Batches" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 ml-1">Created By</label>
                            <MultiSelect options={serverFilters.uploadedBys || []} selected={selectedUploadedBy} onChange={setSelectedUploadedBy} placeholder="All Creators" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 ml-1">Search (within topic)</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Filter loaded questions..."
                                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 pl-9 text-sm text-white focus:outline-none focus:border-indigo-500 h-[38px]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Global Search */}
                    <div className="flex items-center gap-2 mt-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <input
                                type="text"
                                value={globalSearchQuery}
                                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
                                placeholder="Global search across ALL topics..."
                                className="w-full bg-gray-900 border border-amber-600/30 rounded px-3 py-2 pl-9 text-sm text-white focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <button
                            onClick={handleGlobalSearch}
                            disabled={isGlobalSearching || !globalSearchQuery.trim()}
                            className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 rounded text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {isGlobalSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Global Search
                        </button>
                    </div>

                    {/* Bulk Actions */}
                    {/* List Toolbar (Select All, Stats, Bulk Actions) */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800 mb-2">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <label className="flex items-center gap-2 cursor-pointer hover:text-white text-gray-400 transition-colors select-none">
                                <input
                                    type="checkbox"
                                    checked={filteredQuestions.length > 0 && selectedQuestionIds.size === filteredQuestions.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500/50"
                                />
                                <span className="text-sm font-medium">Select All</span>
                            </label>

                            <div className="h-4 w-px bg-gray-700 hidden md:block"></div>

                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-gray-500"><b className="text-gray-300">{filteredQuestions.length}</b> questions</span>
                                {selectedQuestionIds.size > 0 && (
                                    <span className="text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/20">
                                        {selectedQuestionIds.size} selected
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Bulk Action Buttons */}
                        <div className={`flex items-center gap-2 transition-all duration-300 flex-wrap ${selectedQuestionIds.size > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                            {selectedQuestionIds.size > 0 && (
                                <>
                                    <button onClick={downloadJson} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 border border-gray-700 rounded text-xs font-medium transition-colors">
                                        <Download className="h-3.5 w-3.5" /> JSON
                                    </button>
                                    <button onClick={downloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-purple-400 border border-gray-700 rounded text-xs font-medium transition-colors">
                                        <Printer className="h-3.5 w-3.5" /> Print
                                    </button>
                                    <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-red-900/30 text-red-400 border border-gray-700 hover:border-red-500/30 rounded text-xs font-medium transition-colors">
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </button>
                                    <button
                                        onClick={() => { setBatchTagTarget(''); setIsBatchTagModalOpen(true); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-amber-900/30 text-amber-400 border border-gray-700 hover:border-amber-500/30 rounded text-xs font-medium transition-colors"
                                    >
                                        <GraduationCap className="h-3.5 w-3.5" /> Tag Batch
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRenameField('topic');
                                            setRenameOldValue('');
                                            setRenameNewValue('');
                                            setIsRenameModalOpen(true);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-cyan-900/20 text-cyan-400 border border-gray-700 hover:border-cyan-500/30 rounded text-xs font-medium transition-colors"
                                    >
                                        <Pencil className="h-3.5 w-3.5" /> Rename
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setIsMergeModalOpen(true); setMergeQuestions([]); setMergeIdsInput(''); setMergeFetchError(null); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-blue-900/20 text-blue-400 border border-gray-700 hover:border-blue-500/30 rounded text-xs font-medium transition-colors"
                            >
                                <RefreshCw className="h-3.5 w-3.5" /> Merge
                            </button>
                            <button
                                onClick={openAnalytics}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-purple-900/20 text-purple-400 border border-gray-700 hover:border-purple-500/30 rounded text-xs font-medium transition-colors"
                            >
                                <BarChart2 className="h-3.5 w-3.5" /> Analytics
                            </button>
                            <button onClick={openTrash} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 rounded text-xs font-medium transition-colors">
                                <Trash2 className="h-3.5 w-3.5" /> Trash
                            </button>
                        </div>
                    </div>

            {/* Untagged Questions Banner */}
            {(() => {
                const untaggedCount = filteredQuestions.filter(q => !q.batches || q.batches.length === 0).length;
                if (untaggedCount === 0) return null;
                return (
                    <div className="flex items-center justify-between bg-amber-900/20 border border-amber-600/30 rounded-lg px-4 py-2.5 mb-3 text-sm">
                        <div className="flex items-center gap-2 text-amber-400">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span><span className="font-bold">{untaggedCount}</span> question{untaggedCount !== 1 ? 's' : ''} in this view {untaggedCount !== 1 ? 'are' : 'is'} not tagged to any batch.</span>
                        </div>
                        <button
                            onClick={() => {
                                const untaggedIds = new Set<string>(filteredQuestions
                                    .filter(q => !q.batches || q.batches.length === 0)
                                    .map(q => q.id));
                                setSelectedQuestionIds(untaggedIds);
                                setBatchTagTarget('');
                                setIsBatchTagModalOpen(true);
                            }}
                            className="text-xs font-bold text-amber-300 hover:text-amber-100 border border-amber-500/40 px-3 py-1 rounded-lg hover:bg-amber-900/30 transition-all ml-4 flex-shrink-0"
                        >
                            Tag them now →
                        </button>
                    </div>
                );
            })()}

                    {/* Question List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 md:space-y-4 pr-1 md:pr-2">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                            </div>
                        ) : filteredQuestions.length === 0 ? (
                            <div className="text-center py-20 text-gray-500">
                                <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No questions found matching your filters.</p>
                            </div>
                        ) : (
                            filteredQuestions.map((q, i) => (
                                <div key={q.id} id={`q-${q.id}`} className="group bg-gray-900/50 border border-gray-800 hover:border-indigo-500/50 rounded-xl p-3 md:p-4 transition-all hover:shadow-lg hover:shadow-indigo-500/5 relative">
                                    <div className="flex items-start gap-3 md:gap-4">
                                        <div className="pt-1 select-none flex flex-col items-center gap-2">
                                            <span className="text-xs font-mono text-gray-500 font-bold">{i + 1}</span>
                                            <input
                                                type="checkbox"
                                                checked={selectedQuestionIds.has(q.id)}
                                                onChange={() => {
                                                    const newSet = new Set(selectedQuestionIds);
                                                    if (newSet.has(q.id)) newSet.delete(q.id);
                                                    else newSet.add(q.id);
                                                    setSelectedQuestionIds(newSet);
                                                }}
                                                className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500/20 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-1 space-y-2 md:space-y-3 overflow-hidden">
                                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                                <span className="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-gray-400 border border-gray-700">
                                                    {q.type}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-indigo-900/30 text-indigo-300 border border-indigo-500/30">
                                                    {q.topic}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-purple-900/30 text-purple-300 border border-purple-500/30">
                                                    {q.subtopic}
                                                </span>
                                                {q.examNames && q.examNames.map((exam: string) => (
                                                    <span key={exam} className="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-emerald-900/30 text-emerald-300 border border-emerald-500/30">
                                                        {exam}
                                                    </span>
                                                ))}
                                                <span className="ml-auto text-xs font-mono text-gray-500 hidden sm:block">
                                                    {q.id}
                                                </span>
                                            </div>

                                            <div className="text-gray-200 text-xs md:text-sm leading-relaxed prose prose-invert max-w-none overflow-x-auto">
                                                {q.image && (
                                                    <div className="mb-2">
                                                        <img src={q.image} alt="Question" className="max-h-32 rounded border border-gray-700 hover:scale-105 transition-transform origin-left" />
                                                    </div>
                                                )}
                                                <Latex>{q.text}</Latex>

                                                {/* MCQ Options Display */}
                                                {q.type?.toLowerCase() === 'mcq' && q.options && q.options.length > 0 && (
                                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {q.options.map((opt: string, i: number) => (
                                                            <div key={i} className={`text-xs px-3 py-1.5 rounded border border-gray-700 bg-gray-900/50 flex items-start gap-2 ${q.answer && (opt.includes(q.answer) || q.answer.includes(opt)) ? 'border-green-500/30 bg-green-900/10' : ''}`}>
                                                                <span className="font-bold text-gray-500 uppercase">{String.fromCharCode(65 + i)}.</span>
                                                                <span className="text-gray-300"><Latex>{opt}</Latex></span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons (Always show edit on mobile, hover on desktop) */}
                                            <div className="flex items-center gap-2 pt-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditQuestion(q)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors">
                                                    <Edit className="h-3 w-3" /> Edit
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Mock Test Modal - Complete Replacement */}


            {/* Editor Panel */}
            {isEditorOpen && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden flex flex-col transition-all duration-300">
                    <div className="bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-white">
                                {editorMode === 'latex' ? 'LATEX Editor Mode' :
                                    editorMode === 'json' ? 'JSON Editor Mode' :
                                        editorMode === 'image' ? 'Image Editor Mode' : 'AI Editor'}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 uppercase tracking-wider">{editorMode} Mode</span>
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300 border border-blue-500/30">
                                ({previewContent.length} Questions)
                            </span>
                        </div>
                        <div className="flex gap-2">
                            {editorMode === 'json' && (
                                <>
                                    <button onClick={copyPrompt} className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded text-sm font-medium flex items-center gap-2 border border-gray-600">
                                        <Copy className="h-4 w-4" /> Copy Prompt
                                    </button>
                                    <label className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm font-medium cursor-pointer flex items-center gap-2">
                                        <input
                                            type="file"
                                            accept=".json"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        const content = event.target?.result as string;
                                                        handleJsonInput({ target: { value: content } } as any);
                                                    };
                                                    reader.readAsText(file);
                                                }
                                            }}
                                        />
                                        Upload JSON
                                    </label>
                                </>
                            )}
                            <button onClick={() => setIsEditorOpen(false)} className="text-gray-400 hover:text-white px-3 flex items-center gap-2 text-sm font-medium">
                                <ArrowLeft className="h-4 w-4" /> Back to Homepage
                            </button>

                        </div>
                    </div>

                    {/* AI Features Section - Full Width Above Split Screen */}
                    {
                        editorMode === 'pdf' && (
                            <div className="bg-gray-900 border-b border-gray-700 p-6 space-y-6">
                                {/* Token Usage Indicator */}
                                {userEmail && !quotaExhausted && (
                                    <TokenUsageIndicator
                                        userEmail={userEmail}
                                        onQuotaExhausted={() => {
                                            setQuotaExhausted(true);
                                            toast.error('Daily API quota exhausted. Use manual entry below.');
                                        }}
                                        refreshTrigger={usageRefreshTrigger}
                                    />
                                )}

                                {/* Quota Exhausted Warning */}
                                {quotaExhausted && (
                                    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-red-300 font-bold text-sm mb-1">Daily Quota Exhausted</h4>
                                            <p className="text-red-200/80 text-xs">
                                                Daily API limit reached. Use manual entry below.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* File Upload Zone */}
                                {!quotaExhausted && (
                                    <>
                                        <FileUploadZone
                                            onFilesReady={handleAiExtraction}
                                            maxFiles={5}
                                            disabled={isAiExtracting}
                                        />

                                    </>
                                )}

                                {/* Extraction Progress */}
                                {isAiExtracting && (
                                    <ExtractionProgress
                                        stage={extractionStage}
                                        progress={extractionProgress}
                                        questionsFound={previewContent.length}
                                        error={extractionError || undefined}
                                    />
                                )}

                                {/* Auto Debugger */}
                                {validationIssues.length > 0 && extractionStage === 'complete' && (
                                    <AutoDebugger
                                        jsonContent={jsonContent}
                                        issues={validationIssues}
                                        onAutoFix={handleAutoFix}
                                        onRetry={handleRetryExtraction}
                                    />
                                )}

                                {/* Manual Tool Section */}
                                <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg space-y-4">
                                    <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                                        <span>Manual: Use External AI Tool</span>
                                    </div>
                                    <div className="flex gap-2">
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
                                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white">Γåô</div>
                                        <span>Paste Generated JSON Below</span>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {
                        jsonError && (
                            <span className="text-red-400 text-xs font-bold bg-red-900/20 px-2 py-1 rounded border border-red-500/20">
                                {jsonError}
                            </span>
                        )
                    }


                    <textarea
                        className="w-full h-48 bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs md:text-sm font-mono text-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-y"
                        placeholder={`[\n  {\n    "text": "Question text...",\n    "type": "broad",\n    "topic": "Math",\n    "subtopic": "Algebra",\n    "examNames": ["JEE Main"],\n    "marks": 4\n  }\n]`}
                        value={jsonContent}
                        onChange={handleJsonInput}
                        spellCheck={false}
                    />
                </div >
            )
            }

            {/* Row-Based Editor List */}
            {
                isEditorOpen && (
                    <div className="flex flex-col bg-gray-900 border-t border-gray-700">
                        {/* Total Generated Questions Count */}
                        {previewContent.length > 0 && (
                            <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex justify-center">
                                <div className="bg-blue-900/30 border border-blue-500/50 px-4 py-1.5 rounded-lg shadow-lg flex items-center gap-2">
                                    <span className="text-blue-200 text-xs uppercase font-bold tracking-wider">Total Generated Questions:</span>
                                    <span className="text-white font-bold text-lg">{previewContent.length}</span>
                                </div>
                            </div>
                        )}

                        {previewContent.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center text-gray-500">
                                <FileText className="h-12 w-12 mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-2">No questions yet</p>
                                <p className="text-sm mb-6 max-w-md">
                                    {editorMode === 'json' ? 'Paste JSON above or upload a file.' : 'Upload a file above or add a question manually.'}
                                </p>
                                {!['json', 'latex', 'image'].includes(editorMode) && (
                                    <button
                                        onClick={handleAddNewQuestion}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" /> Add First Question
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {previewContent.map((q, i) => (
                                    <QuestionRow
                                        key={q.id || i}
                                        index={i}
                                        question={q}
                                        mode={editorMode}
                                        topics={topics} // Pass props for dropdowns
                                        subtopics={subtopics}
                                        onChange={(updated) => handleRowChange(i, updated)}
                                        onDelete={() => handleRowDelete(i)}
                                    />
                                ))}

                                {!['json', 'latex'].includes(editorMode) && (
                                    <div className="p-8 flex flex-col gap-4 justify-center bg-gray-900 border-t border-gray-700">
                                        <button
                                            onClick={handleAddNewQuestion}
                                            className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors w-full max-w-md mx-auto justify-center"
                                        >
                                            <Plus className="h-5 w-5" /> Add New Question
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            }



            {/* Viewer Panel - Only visible when Editor is Open */}
            {isEditorOpen && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex-1 flex flex-col shadow-lg">
                    <div className="sticky top-0 z-20 bg-gray-800 pb-4 pt-2 -mt-2 flex flex-col items-stretch gap-4 border-b border-gray-700 mb-4">
                        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end w-full">
                            <div className="flex items-center h-[38px] px-2">
                                <input
                                    type="checkbox"
                                    checked={filteredQuestions.length > 0 && selectedQuestionIds.size === filteredQuestions.length}
                                    onChange={toggleSelectAll}
                                    className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                                    title="Select All"
                                />
                            </div>
                            <div className="w-full md:w-48">
                                <label className="text-xs text-gray-400 mb-1 block">Filter Topic</label>
                                <MultiSelect
                                    options={topics}
                                    selected={selectedTopics}
                                    onChange={setSelectedTopics}
                                    placeholder="All Topics"
                                />
                            </div>
                            <div className="w-full md:w-48">
                                <label className="text-xs text-gray-400 mb-1 block">Filter Subtopic</label>
                                <MultiSelect
                                    options={subtopics}
                                    selected={selectedSubtopics}
                                    onChange={setSelectedSubtopics}
                                    placeholder="All Subtopics"
                                />
                            </div>
                            <div className="w-full md:w-48">
                                <label className="text-xs text-gray-400 mb-1 block">Filter Exam</label>
                                <MultiSelect
                                    options={examNames}
                                    selected={selectedExams}
                                    onChange={setSelectedExams}
                                    placeholder="All Exams"
                                />
                            </div>
                            {/* Search Bar */}
                            <div className="flex-1 relative">
                                <label className="text-xs text-gray-400 mb-1 block">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Search questions..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded h-[38px] pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                                    />
                                </div>
                            </div>

                            {/* Filtered Count Box */}
                            <div className="flex flex-col justify-end">
                                <label className="text-xs text-gray-400 mb-1 block opacity-0">Count</label>
                                <div className="h-[38px] px-3 bg-blue-900/30 border border-blue-500/30 rounded flex items-center justify-center min-w-[60px]">
                                    <span className="text-blue-300 font-bold text-sm">{filteredQuestions.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Floating Action Buttons (Always Floating) */}
                        {/* Floating Action Buttons */}
                        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
                            {!isEditorOpen ? (
                                <>
                                    <button onClick={downloadPdf} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-full shadow-lg text-xs md:text-sm font-medium flex items-center justify-center gap-2 w-12 h-12 md:w-auto md:h-auto whitespace-nowrap transition-all hover:scale-105">
                                        <Printer className="h-5 w-5 md:h-4 md:w-4" /> <span className="hidden md:inline">Print Selected</span>
                                    </button>
                                    <button onClick={downloadJson} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg text-xs md:text-sm font-medium flex items-center justify-center gap-2 w-12 h-12 md:w-auto md:h-auto whitespace-nowrap transition-all hover:scale-105">
                                        <Download className="h-5 w-5 md:h-4 md:w-4" /> <span className="hidden md:inline">Export JSON</span>
                                    </button>
                                    <button onClick={deleteSelected} disabled={selectedQuestionIds.size === 0} className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-full shadow-lg text-xs md:text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-12 h-12 md:w-auto md:h-auto whitespace-nowrap transition-all hover:scale-105">
                                        <Trash2 className="h-5 w-5 md:h-4 md:w-4" /> <span className="hidden md:inline">Delete ({selectedQuestionIds.size})</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => saveToDatabase()}
                                    disabled={loading}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-full shadow-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 animate-in fade-in zoom-in duration-300"
                                >
                                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                                    <span className="hidden md:inline">{loading ? 'Saving...' : 'Save Changes'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pb-24">
                        {loading ? (
                            <div className="flex items-center justify-center h-64 text-gray-400">
                                <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading...
                            </div>
                        ) : filteredQuestions.length === 0 ? (
                            <div className="flex items-center justify-center h-64 text-gray-500 italic">
                                No questions found.
                            </div>
                        ) : (
                            filteredQuestions.map((q, index) => (
                                <div id={`q-${q.id}`} key={q.id} className={`p-4 rounded border ${selectedQuestionIds.has(q.id) ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-900 border-gray-700'} hover:border-gray-500 transition-colors group`}>
                                    <div className="flex gap-3">
                                        <div className="pt-1 flex flex-col items-center gap-2">
                                            <span className="text-xs font-mono text-gray-500 font-bold">{index + 1}</span>
                                            <input
                                                type="checkbox"
                                                checked={selectedQuestionIds.has(q.id)}
                                                onChange={() => toggleSelection(q.id)}
                                                className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-wrap gap-1.5 mb-1">
                                                    <span className="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">{q.topic}</span>
                                                    <span className="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">{q.subtopic}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${q.type?.toLowerCase() === 'broad' ? 'border-pink-500 text-pink-400' : q.type?.toLowerCase() === 'mcq' ? 'border-yellow-500 text-yellow-400' : 'border-cyan-500 text-cyan-400'}`}>
                                                        {q.type}
                                                    </span>
                                                    {q.examNames && q.examNames.length > 0 && q.examNames.map((exam: string, idx: number) => (
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
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditQuestion(q);
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                                >
                                                    <Edit className="h-3 w-3" />
                                                    Edit
                                                </button>
                                            </div>
                                            <div className="text-gray-300 text-sm leading-relaxed">
                                                {q.image && (
                                                    <div className="mb-2">
                                                        <img src={q.image} alt="Question" className="max-h-32 rounded border border-gray-700 hover:scale-105 transition-transform origin-left" />
                                                    </div>
                                                )}
                                                <Latex>{q.text}</Latex>

                                                {/* MCQ Options Display */}
                                                {q.type?.toLowerCase() === 'mcq' && q.options && q.options.length > 0 && (
                                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {q.options.map((opt: string, i: number) => (
                                                            <div key={i} className={`text-xs px-3 py-1.5 rounded border border-gray-700 bg-gray-900/50 flex items-start gap-2 ${q.answer && (opt.includes(q.answer) || q.answer.includes(opt)) ? 'border-green-500/30 bg-green-900/10' : ''}`}>
                                                                <span className="font-bold text-gray-500 uppercase">{String.fromCharCode(65 + i)}.</span>
                                                                <span className="text-gray-300"><Latex>{opt}</Latex></span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ⚠️ ID Clash Modal */}
            {isIdClashModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 p-6 rounded-xl max-w-2xl w-full border border-red-500/40 shadow-2xl">
                        <h3 className="text-xl font-bold text-red-400 mb-1 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" /> ID Clash Detected!
                        </h3>
                        <p className="text-gray-400 text-sm mb-4">
                            <span className="text-white font-semibold">{idClashQuestions.length}</span> of your incoming question{idClashQuestions.length !== 1 ? 's have IDs' : ' has an ID'} that already exist in the database for a <span className="text-red-400 font-semibold">different</span> question. Saving without fixing will silently overwrite those existing questions.
                        </p>

                        <div className="max-h-72 overflow-y-auto mb-5 space-y-3 pr-1">
                            {idClashQuestions.map((clash, i) => (
                                <div key={i} className="rounded-lg border border-red-500/30 bg-red-900/10 p-3 text-xs">
                                    <div className="font-mono text-red-300 mb-2 font-bold">ID: {clash.incoming.id}</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-yellow-400 font-semibold mb-1">⬇ Incoming (NEW)</div>
                                            <div className="text-gray-300 line-clamp-3">{clash.incoming.text}</div>
                                            <div className="text-gray-500 mt-1">{clash.incoming.topic} › {clash.incoming.subtopic}</div>
                                        </div>
                                        <div>
                                            <div className="text-blue-400 font-semibold mb-1">📦 Existing in DB</div>
                                            <div className="text-gray-300 line-clamp-3">{clash.existing.text}</div>
                                            <div className="text-gray-500 mt-1">{clash.existing.topic} › {clash.existing.subtopic}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            <button
                                onClick={() => { setIsIdClashModalOpen(false); setIdClashQuestions([]); setPendingSaveQuestions([]); }}
                                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { setIsIdClashModalOpen(false); performSave(pendingSaveQuestions); }}
                                className="px-4 py-2 rounded-lg bg-orange-700 hover:bg-orange-600 text-white text-sm font-medium"
                            >
                                Overwrite Anyway
                            </button>
                            <button
                                onClick={resolveIdClashes}
                                className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-bold flex items-center gap-2"
                            >
                                <RefreshCw className="h-4 w-4" /> Auto-fix IDs & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Modal */}
            {
                isDuplicateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full border border-gray-700 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <RefreshCw className="h-5 w-5 text-yellow-500" /> Duplicates Detected
                            </h3>
                            <p className="text-gray-400 mb-4">Found {duplicateQuestions.length} duplicates. How should we handle them?</p>

                            <div className="max-h-60 overflow-y-auto mb-6 space-y-2">
                                {duplicateQuestions.map((d, i) => (
                                    <div key={i} className="p-3 bg-gray-900 rounded border border-gray-700 text-xs">
                                        <div className="text-red-400 font-bold mb-1">Duplicate #{i + 1}</div>
                                        <div className="text-gray-300 mb-1">{d.new.text.substring(0, 100)}...</div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4 justify-end">
                                <button onClick={() => resolveDuplicates('keep')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium">
                                    Keep Both (Create New)
                                </button>
                                <button onClick={() => resolveDuplicates('overwrite')} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded font-medium">
                                    Overwrite Existing
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ── Merge Modal ── */}
            {isMergeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 rounded-xl border border-blue-500/30 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <RefreshCw className="h-5 w-5 text-blue-400" /> Merge Questions by ID
                            </h2>
                            <button onClick={() => { setIsMergeModalOpen(false); setMergeQuestions([]); setMergeIdsInput(''); }} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-5 flex-1 overflow-y-auto">
                            {/* ID Input */}
                            <div className="flex gap-3 mb-5">
                                <input
                                    type="text"
                                    value={mergeIdsInput}
                                    onChange={e => setMergeIdsInput(e.target.value)}
                                    placeholder="Enter question IDs separated by commas: q_abc, q_xyz, ..."
                                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                />
                                <button
                                    onClick={fetchMergeQuestions}
                                    disabled={mergeLoading || !mergeIdsInput.trim()}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all"
                                >
                                    {mergeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
                                </button>
                            </div>

                            {mergeFetchError && (
                                <div className="flex items-center gap-2 text-red-400 bg-red-900/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm">
                                    <AlertCircle className="h-4 w-4" /> {mergeFetchError}
                                </div>
                            )}

                            {mergeQuestions.length >= 2 && (
                                <>
                                    <p className="text-xs text-gray-400 mb-3">Select the <span className="text-blue-400 font-bold">primary question</span> to keep. All ExamNames will be merged into it. Others will be moved to Trash.</p>
                                    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(mergeQuestions.length, 3)}, 1fr)` }}>
                                        {mergeQuestions.map(q => (
                                            <div
                                                key={q.id}
                                                onClick={() => setMergePrimaryId(q.id)}
                                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                                    mergePrimaryId === q.id
                                                        ? 'border-blue-500 bg-blue-900/20'
                                                        : 'border-gray-700 bg-gray-900/50 hover:border-gray-500'
                                                }`}
                                            >
                                                {mergePrimaryId === q.id && (
                                                    <div className="text-[10px] font-bold text-blue-400 mb-2 uppercase tracking-wider">★ Primary (Keep)</div>
                                                )}
                                                <div className="font-mono text-[10px] text-gray-500 mb-1">{q.id}</div>
                                                <div className="text-xs font-semibold text-gray-300 mb-1">{q.topic} › {q.subtopic}</div>
                                                <div className="text-xs text-gray-400 line-clamp-3 mb-2">{q.text?.substring(0, 120)}...</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {(q.examNames || (q.examName ? [q.examName] : [])).map((e: string) => (
                                                        <span key={e} className="text-[10px] bg-blue-900/30 text-blue-300 border border-blue-500/20 rounded px-1.5 py-0.5">{e}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Preview merged examNames */}
                                    <div className="mt-4 p-3 bg-green-900/10 border border-green-500/20 rounded-lg">
                                        <div className="text-xs font-bold text-green-400 mb-1">After merge — ExamNames will be:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {Array.from(new Set(mergeQuestions.flatMap((q: any) => q.examNames || (q.examName ? [q.examName] : [])))).map((e: any) => (
                                                <span key={e} className="text-xs bg-green-900/30 text-green-300 border border-green-500/20 rounded px-2 py-0.5">{e}</span>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {mergeQuestions.length >= 2 && (
                            <div className="p-5 border-t border-gray-700 flex justify-end gap-3">
                                <button onClick={() => { setIsMergeModalOpen(false); setMergeQuestions([]); }} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                                <button
                                    onClick={handleMerge}
                                    disabled={mergeLoading || !mergePrimaryId}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                                >
                                    {mergeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    Confirm Merge
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Analytics Modal ── */}
            {isAnalyticsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 rounded-xl border border-purple-500/30 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <BarChart2 className="h-5 w-5 text-purple-400" /> Question Bank Analytics
                            </h2>
                            <button onClick={() => setIsAnalyticsModalOpen(false)} className="p-2 hover:bg-gray-700 rounded-lg">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-5 flex-1 overflow-y-auto">
                            {analyticsLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /></div>
                            ) : analyticsData ? (
                                <>
                                    {/* Summary */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                                            <div className="text-3xl font-bold text-white">{analyticsData.total}</div>
                                            <div className="text-xs text-gray-400 mt-1">Total Questions</div>
                                        </div>
                                        <div className="bg-amber-900/20 rounded-xl p-4 border border-amber-600/30">
                                            <div className="text-3xl font-bold text-amber-400">{analyticsData.untagged}</div>
                                            <div className="text-xs text-gray-400 mt-1">Untagged (no batch)</div>
                                        </div>
                                    </div>

                                    {/* SVG Pie Chart */}
                                    {(() => {
                                        const entries = Object.entries(analyticsData.perBatch).filter(([, v]) => v > 0);
                                        if (analyticsData.untagged > 0) entries.push(['Untagged', analyticsData.untagged]);
                                        const total = entries.reduce((s, [, v]) => s + v, 0);
                                        if (total === 0) return <p className="text-gray-500 text-sm text-center">No data yet.</p>;
                                        const colors = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6','#a855f7','#22c55e','#eab308','#64748b','#0ea5e9','#d946ef','#fb923c','#4ade80','#facc15','#94a3b8','#c084fc'];
                                        let cumAngle = -Math.PI / 2;
                                        const cx = 110, cy = 110, r = 90;
                                        const slices = entries.map(([label, val], i) => {
                                            const angle = (val / total) * 2 * Math.PI;
                                            const x1 = cx + r * Math.cos(cumAngle);
                                            const y1 = cy + r * Math.sin(cumAngle);
                                            cumAngle += angle;
                                            const x2 = cx + r * Math.cos(cumAngle);
                                            const y2 = cy + r * Math.sin(cumAngle);
                                            const large = angle > Math.PI ? 1 : 0;
                                            return { label, val, path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: colors[i % colors.length] };
                                        });
                                        return (
                                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                                <svg width="220" height="220" className="flex-shrink-0 mx-auto">
                                                    {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#1f2937" strokeWidth="1.5" />)}
                                                    <circle cx={cx} cy={cy} r={40} fill="#1f2937" />
                                                    <text x={cx} y={cy - 6} textAnchor="middle" className="fill-white" fontSize="14" fontWeight="bold">{total}</text>
                                                    <text x={cx} y={cy + 10} textAnchor="middle" fill="#9ca3af" fontSize="9">questions</text>
                                                </svg>
                                                <div className="flex-1 space-y-1.5 max-h-64 overflow-y-auto">
                                                    {slices.map((s, i) => (
                                                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                                                                <span className="text-gray-300 truncate">{s.label}</span>
                                                            </div>
                                                            <span className="font-bold text-white flex-shrink-0">{s.val} <span className="text-gray-500 font-normal">({Math.round(s.val / total * 100)}%)</span></span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </>
                            ) : <p className="text-gray-500 text-center py-8">Failed to load analytics.</p>}
                        </div>

                        <div className="p-4 border-t border-gray-700 flex justify-between items-center">
                            <button onClick={openAnalytics} className="text-xs text-purple-400 hover:text-purple-300">↻ Refresh</button>
                            <button onClick={() => setIsAnalyticsModalOpen(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Rename Modal ── */}
            {isRenameModalOpen && (() => {
                // Compute unique current values for the selected field across selected questions
                const selectedQs = filteredQuestions.filter(q => selectedQuestionIds.has(q.id));
                const currentValues = Array.from(new Set(
                    selectedQs.flatMap(q => {
                        if (renameField === 'topic') return [q.topic].filter(Boolean);
                        if (renameField === 'subtopic') return [q.subtopic].filter(Boolean);
                        if (renameField === 'examName') {
                            return (q.examNames || (q.examName ? [q.examName] : []));
                        }
                        return [];
                    })
                )).sort();

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-gray-800 p-6 rounded-xl max-w-md w-full border border-cyan-500/30 shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Pencil className="h-5 w-5 text-cyan-400" /> Bulk Rename
                                </h3>
                                <button onClick={() => setIsRenameModalOpen(false)} className="p-1 hover:bg-white/5 rounded-full">
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>

                            <p className="text-xs text-slate-400 mb-4">
                                Renaming across <span className="text-white font-bold">{selectedQuestionIds.size}</span> selected question{selectedQuestionIds.size !== 1 ? 's' : ''}.
                            </p>

                            {/* Field selector */}
                            <div className="flex gap-2 mb-4">
                                {(['topic', 'subtopic', 'examName'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => { setRenameField(f); setRenameOldValue(''); setRenameNewValue(''); }}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                                            renameField === f
                                                ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40'
                                                : 'bg-gray-900 border-gray-700 text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        {f === 'topic' ? 'Topic' : f === 'subtopic' ? 'Subtopic' : 'Exam Name'}
                                    </button>
                                ))}
                            </div>

                            {/* Current value picker (for examName, must pick which one to rename) */}
                            <div className="mb-4">
                                <label className="block text-xs text-slate-400 mb-1.5">
                                    {renameField === 'examName' ? 'Which exam name to rename?' : 'Current value in selected questions'}
                                </label>
                                {currentValues.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic">No value found in selected questions.</p>
                                ) : currentValues.length === 1 && renameField !== 'examName' ? (
                                    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">{currentValues[0]}</div>
                                ) : (
                                    <div className="space-y-1 max-h-32 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg p-2">
                                        {currentValues.map(v => (
                                            <label key={v} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-all ${
                                                renameOldValue === v ? 'bg-cyan-900/20 text-cyan-300' : 'text-gray-300 hover:bg-gray-800'
                                            }`}>
                                                <input type="radio" name="oldVal" checked={renameOldValue === v} onChange={() => setRenameOldValue(v)} className="accent-cyan-500" />
                                                {v}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {/* Auto-set single value */}
                                {currentValues.length === 1 && renameField !== 'examName' && renameOldValue !== currentValues[0] && (
                                    <>{renameOldValue !== currentValues[0] ? (() => { setTimeout(() => setRenameOldValue(currentValues[0]), 0); return null; })() : null}</>
                                )}
                            </div>

                            {/* New value input */}
                            <div className="mb-5">
                                <label className="block text-xs text-slate-400 mb-1.5">New name</label>
                                <input
                                    type="text"
                                    value={renameNewValue}
                                    onChange={e => setRenameNewValue(e.target.value)}
                                    placeholder={`Enter new ${renameField === 'examName' ? 'exam name' : renameField}...`}
                                    className="w-full bg-gray-900 border border-gray-600 focus:border-cyan-500 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setIsRenameModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium">Cancel</button>
                                <button
                                    disabled={!renameNewValue.trim() || (currentValues.length > 1 && !renameOldValue) || renameLoading}
                                    onClick={async () => {
                                        setRenameLoading(true);
                                        try {
                                            const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': userEmail || '' };
                                            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                                                headers['X-Global-Admin-Key'] = 'globaladmin_25';
                                            }
                                            const oldVal = currentValues.length === 1 ? currentValues[0] : renameOldValue;
                                            const res = await fetch('/api/admin/questions/rename', {
                                                method: 'POST',
                                                headers,
                                                body: JSON.stringify({
                                                    ids: Array.from(selectedQuestionIds),
                                                    field: renameField,
                                                    oldValue: oldVal,
                                                    newValue: renameNewValue.trim()
                                                })
                                            });
                                            if (res.ok) {
                                                const data = await res.json();
                                                toast.success(`Renamed ${data.modifiedCount} question(s)`);
                                                setIsRenameModalOpen(false);
                                                setSelectedQuestionIds(new Set());
                                                if (userEmail) {
                                                    await fetchFilters(userEmail);
                                                    const actualTopics = selectedTopics.filter(t => t !== 'No Topic');
                                                    if (actualTopics.length > 0) {
                                                        fetchQuestions(userEmail, { topics: actualTopics, uploadedBys: selectedUploadedBy });
                                                    }
                                                }
                                            } else {
                                                const err = await res.json();
                                                toast.error(err.error || 'Rename failed');
                                            }
                                        } catch (e) {
                                            toast.error('Error renaming');
                                        } finally {
                                            setRenameLoading(false);
                                        }
                                    }}
                                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all"
                                >
                                    {renameLoading ? 'Renaming...' : 'Apply Rename'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Batch Tag Modal */}
            {isBatchTagModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 p-6 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <GraduationCap className="h-5 w-5 text-amber-400" /> Tag to Batch
                            </h3>
                            <button onClick={() => { setIsBatchTagModalOpen(false); setBatchTagTarget(''); }} className="p-1 hover:bg-white/5 rounded-full">
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-400 mb-1">
                            Assign <span className="text-white font-bold">{selectedQuestionIds.size}</span> selected question{selectedQuestionIds.size !== 1 ? 's' : ''} to a batch.
                        </p>
                        <p className="text-[10px] text-amber-500/70 mb-4">⚠ Existing batch tag will be replaced.</p>

                        {/* Single-select batch list */}
                        <div className="max-h-64 overflow-y-auto space-y-1 mb-5 bg-gray-900 rounded-lg p-2 border border-gray-700">
                            {PREDEFINED_BATCHES.map(batch => (
                                <label key={batch} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all ${
                                    batchTagTarget === batch
                                        ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                                        : 'hover:bg-gray-800 text-gray-300 border border-transparent'
                                }`}>
                                    <input
                                        type="radio"
                                        name="batchSelect"
                                        checked={batchTagTarget === batch}
                                        onChange={() => setBatchTagTarget(batch)}
                                        className="accent-amber-500"
                                    />
                                    {batch}
                                </label>
                            ))}
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => { setIsBatchTagModalOpen(false); setBatchTagTarget(''); }} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium">Cancel</button>
                            <button
                                disabled={!batchTagTarget || batchTagLoading}
                                onClick={async () => {
                                    setBatchTagLoading(true);
                                    try {
                                        const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': userEmail || '' };
                                        if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                                            headers['X-Global-Admin-Key'] = 'globaladmin_25';
                                        }
                                        const res = await fetch('/api/admin/questions/batch-tag', {
                                            method: 'POST',
                                            headers,
                                            body: JSON.stringify({
                                                questionIds: Array.from(selectedQuestionIds),
                                                batches: [batchTagTarget],
                                                mode: 'set'
                                            })
                                        });
                                        if (res.ok) {
                                            const data = await res.json();
                                            toast.success(`Tagged ${data.modifiedCount} question(s) → ${batchTagTarget}`);
                                            setIsBatchTagModalOpen(false);
                                            setBatchTagTarget('');
                                            setSelectedQuestionIds(new Set());
                                            if (userEmail) {
                                                const actualTopics = selectedTopics.filter(t => t !== 'No Topic');
                                                if (actualTopics.length > 0) {
                                                    fetchQuestions(userEmail, { topics: actualTopics, uploadedBys: selectedUploadedBy });
                                                }
                                            }
                                        } else {
                                            toast.error('Failed to update batch tags');
                                        }
                                    } catch (err) {
                                        toast.error('Error updating batch tags');
                                    } finally {
                                        setBatchTagLoading(false);
                                    }
                                }}
                                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all"
                            >
                                {batchTagLoading ? 'Updating...' : `Assign to "${batchTagTarget || '...'}"` }
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isTrashModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Trash2 className="h-6 w-6 text-gray-400" />
                                Trash
                            </h2>
                            <button onClick={() => { setIsTrashModalOpen(false); setSelectedTrashIds(new Set()); setDeleteConfirmation(''); }} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            {trashLoading ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>
                            ) : trashQuestions.length === 0 ? (
                                <div className="text-center p-8 text-gray-400">Trash is empty.</div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-gray-900 p-2 rounded border border-gray-700">
                                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedTrashIds.size === trashQuestions.length && trashQuestions.length > 0}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedTrashIds(new Set(trashQuestions.map(q => q.id)));
                                                    } else {
                                                        setSelectedTrashIds(new Set());
                                                    }
                                                }}
                                                className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                                            />
                                            Select All ({selectedTrashIds.size}/{trashQuestions.length})
                                        </label>
                                    </div>
                                    {/* Group by topic for better UX */}
                                    {Array.from(new Set(trashQuestions.map(q => q.topic))).sort().map((topic: any) => (
                                        <div key={topic} className="mb-4">
                                            <h3 className="text-sm font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1">{topic}</h3>
                                            <div className="space-y-2">
                                                {trashQuestions.filter(q => q.topic === topic).map(q => (
                                                    <div key={q.id} className="flex gap-3 bg-gray-900/50 p-2 rounded border border-gray-700/50 hover:bg-gray-700/30">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedTrashIds.has(q.id)}
                                                            onChange={(e) => {
                                                                const next = new Set(selectedTrashIds);
                                                                if (e.target.checked) next.add(q.id);
                                                                else next.delete(q.id);
                                                                setSelectedTrashIds(next);
                                                            }}
                                                            className="mt-1 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between">
                                                                <span className="text-xs font-semibold text-blue-400">{q.subtopic}</span>
                                                                <span className="text-[10px] text-gray-500">{new Date(q.deletedAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-300 truncate">{q.text.substring(0, 80)}{q.text.length > 80 ? '...' : ''}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <span className="text-xs text-gray-500">Trash auto-purges after 30 days</span>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button 
                                    disabled={selectedTrashIds.size === 0 || trashLoading}
                                    onClick={() => handleTrashAction('restore')}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    Restore Selected
                                </button>
                                <div className="flex gap-2">
                                    {selectedTrashIds.size > 0 && (
                                        <input 
                                            type="text"
                                            placeholder="Type DELETE"
                                            value={deleteConfirmation}
                                            onChange={e => setDeleteConfirmation(e.target.value)}
                                            className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white"
                                        />
                                    )}
                                    <button 
                                        disabled={selectedTrashIds.size === 0 || trashLoading || deleteConfirmation !== 'DELETE'}
                                        onClick={() => handleTrashAction('purge')}
                                        className="flex-1 sm:flex-none px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        Permanently Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
