'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, Plus, FileJson, FileText, Trash2, Download, Save, X, Printer, Edit, Upload, Copy, ExternalLink, RefreshCw, Check, ChevronDown, ToggleLeft, ToggleRight, GraduationCap, ArrowLeft, ArrowRightCircle, Search } from 'lucide-react';
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
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-60 overflow-hidden flex flex-col">
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
                    <div className="overflow-y-auto max-h-48">
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

const AI_PROMPT = `You are a Question Bank Assistant. Your task is to extract questions from the provided content and format them into a strict JSON array.

Rules:
1. Output MUST be a valid JSON array of objects.
2. Each question object must have: 
   - "text" (string)
   - "type" (string: "broad", "mcq", "blanks", or "short")
   - "topic" (string)
   - "subtopic" (string)
   - "examNames" (array of strings, e.g. ["JEE Main 2024"]) or [] if empty
   - "marks" (number) or null
   - "options" (array of strings) if MCQ, else []
3. Preserve LaTeX math notation using $ for inline and $$ for display math.
4. **Line Breaks**: To break lines (e.g. for subparts like a, b, c), use "$\\\\\\\\$" instead of "\\n".
5. IF THE CONTENT CONTAINS IMAGES (diagrams, circuits, graphs):
   - Extract the image and convert it to a Base64 string.
   - Add an "image" field to the JSON object with the Base64 string.
   - If no image is present, omit the "image" field.
6. Do NOT add any explanation, markdown formatting, or extra text. Output ONLY the JSON array.
7. Ensure all special characters are properly escaped in JSON strings.

Example Output:
[
  {
    "text": "Find the rank of the matrix $ A = \\\\begin{pmatrix} 1 & 2 \\\\\\\\ 3 & 4 \\\\end{pmatrix} $",
    "type": "broad",
    "topic": "Matrix",
    "subtopic": "Rank",
    "examNames": ["JEE Main 2023"],
    "marks": 4,
    "options": [],
    "image": "data:image/png;base64,..."
  }
]
`;

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



    // Duplicate Detection State
    const [duplicateQuestions, setDuplicateQuestions] = useState<any[]>([]);
    const [newQuestions, setNewQuestions] = useState<any[]>([]);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // Filter State
    const [selectedTopics, setSelectedTopics] = useState<string[]>(["No Topic"]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [selectedExams, setSelectedExams] = useState<string[]>([]);
    // Singular Selection for Modal
    const [selectedTopic, setSelectedTopic] = useState('');
    const [selectedSubtopic, setSelectedSubtopic] = useState('');

    const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Paper Generator State
    const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
    const [paperStep, setPaperStep] = useState(0); // 0: Select, 1: Details, 2: Preview
    const [paperQuestions, setPaperQuestions] = useState<any[]>([]);
    const [paperHtml, setPaperHtml] = useState('');
    const [paperJson, setPaperJson] = useState('');
    const [paperPreviewKey, setPaperPreviewKey] = useState(0);
    const [paperConfig, setPaperConfig] = useState({
        course: 'B. Tech.', sem: '1st', session: '', paperName: '', code: '', date: '', stream: '', time: '', marks: '', exam: ''
    });

    // Mock Test State
    const [isMockTestModalOpen, setIsMockTestModalOpen] = useState(false);
    const [mockTopicConfigs, setMockTopicConfigs] = useState<any[]>([]);
    const [mockConfigLoading, setMockConfigLoading] = useState(false);
    const [currentFacultyName, setCurrentFacultyName] = useState('');
    const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

    // Dropdowns for deployments - dynamically loaded from students
    const [availableDepts, setAvailableDepts] = useState<string[]>([]);
    const [availableYears, setAvailableYears] = useState<string[]>([]);
    const [availableCourses, setAvailableCourses] = useState<string[]>([]);

    // Derived Lists - All with bidirectional cascading
    const topics = useMemo(() => {
        let filtered = questions;
        if (selectedSubtopics.length > 0) {
            filtered = filtered.filter(q => selectedSubtopics.includes(q.subtopic));
        }
        if (selectedExams.length > 0) {
            filtered = filtered.filter(q => {
                const qExams = q.examNames || (q.examName ? [q.examName] : []);
                return qExams.some((e: string) => selectedExams.includes(e));
            });
        }
        const actualTopics = Array.from(new Set(filtered.map(q => q.topic))).sort();
        return ["No Topic", ...actualTopics];
    }, [questions, selectedSubtopics, selectedExams]);

    // Cascading Subtopics: Filter based on selected topics and exams
    const subtopics = useMemo(() => {
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        let filtered = questions;
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
    }, [questions, selectedTopics, selectedExams]);

    // Cascading Exam Names: Filter based on selected topics and subtopics
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
            if (q.examNames && Array.isArray(q.examNames)) q.examNames.forEach((e: string) => set.add(e));
            else if (q.examName) set.add(q.examName);
        });
        return Array.from(set).filter(Boolean).sort();
    }, [questions, selectedTopics, selectedSubtopics]);

    // Paper Modal Subtopics
    const paperSubtopics = useMemo(() => {
        const filteredByTopic = selectedTopic
            ? questions.filter(q => q.topic === selectedTopic)
            : questions;
        return Array.from(new Set(filteredByTopic.map(q => q.subtopic))).filter(Boolean).sort();
    }, [questions, selectedTopic]);

    // Compute filtered questions based on selected topics and subtopics
    const filteredQuestions = useMemo(() => {
        // If "No Topic" is selected, return empty (unless searching)
        if (selectedTopics.includes("No Topic") && !searchQuery) {
            return [];
        }

        // Filter out "No Topic" for actual filtering
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");

        return questions.filter(q => {
            const topicMatch = actualTopics.length === 0 || actualTopics.includes(q.topic);
            const subtopicMatch = selectedSubtopics.length === 0 || selectedSubtopics.includes(q.subtopic);

            const qExams = q.examNames || (q.examName ? [q.examName] : []);
            const examMatch = selectedExams.length === 0 || selectedExams.some(e => qExams.includes(e));

            const searchLower = searchQuery.toLowerCase();
            const searchMatch = !searchQuery ||
                (q.text || '').toLowerCase().includes(searchLower) ||
                (q.topic || '').toLowerCase().includes(searchLower) ||
                (q.subtopic || '').toLowerCase().includes(searchLower) ||
                (q.id || '').toLowerCase().includes(searchLower);

            return topicMatch && subtopicMatch && examMatch && searchMatch;
        });
    }, [questions, selectedTopics, selectedSubtopics, selectedExams, searchQuery]);

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
            // Fetch questions and students in parallel
            const [questionsRes, studentsRes] = await Promise.all([
                fetch('/api/admin/questions', {
                    headers: { 'X-User-Email': email },
                    cache: 'no-store'
                }),
                fetch('/api/admin/students/all').catch(() => null)
            ]);

            if (questionsRes.ok) {
                const data = await questionsRes.json();
                // Sort: Topic -> Subtopic -> ID (Creation)
                const sorted = data.sort((a: any, b: any) => {
                    return a.topic.localeCompare(b.topic) ||
                        a.subtopic.localeCompare(b.subtopic) ||
                        (a.id || '').localeCompare(b.id || '');
                });
                setQuestions(sorted);
                if (sorted.length > 0) setCurrentFacultyName(sorted[0].facultyName);
            }

            // Extract unique departments, years, and courses from students
            if (studentsRes && studentsRes.ok) {
                const students = await studentsRes.json();
                const depts = Array.from(new Set(students.map((s: any) => s.department).filter(Boolean)));
                const years = Array.from(new Set(students.map((s: any) => s.year).filter(Boolean)));
                const courses = Array.from(new Set(students.map((s: any) => s.course_code).filter(Boolean)));

                console.log('[QUESTIONS] Loaded dropdowns - Depts:', depts, 'Years:', years, 'Courses:', courses);

                // Update dropdown state (we need to  add these state variables)
                setAvailableDepts(depts as string[]);
                setAvailableYears(years as string[]);
                setAvailableCourses(courses as string[]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- Mock Test Logic ---
    // --- Mock Test Logic ---
    const openMockTestModal = async () => {
        setIsMockTestModalOpen(true);
        setMockConfigLoading(true);
        try {
            const storedUser = localStorage.getItem('user');
            const user = storedUser ? JSON.parse(storedUser) : null;

            if (!user || !user.email) {
                toast.error('User email not found');
                return;
            }

            const headers: any = { 'X-User-Email': user.email };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }

            const res = await fetch('/api/admin/mock-test-config', { headers });
            let data: any[] = [];
            if (res.ok) {
                const responseData = await res.json();
                console.log('[MOCK TEST LOAD] Loaded config:', responseData);
                // API returns { facultyName, topics: [] }
                // Use default empty array if topics is undefined
                data = responseData.topics || [];
            }

            // Get all unique topics from loaded questions
            const uniqueTopics = Array.from(new Set(questions.map((q: any) => q.topic))).filter(Boolean).sort();

            const allTopicsConfigs = uniqueTopics.map((topicName: any) => {
                const existing = data.find((d: any) => d.topic === topicName);
                if (existing) return existing;
                return {
                    topic: topicName,
                    enabled: false,
                    deployments: []
                };
            });

            setMockTopicConfigs(allTopicsConfigs);
        } catch (error) {
            console.error(error);
            toast.error('Error loading config');
        } finally {
            setMockConfigLoading(false);
        }
    };

    const toggleTopicEnabled = (topic: string) => {
        setMockTopicConfigs(prev => {
            const existing = prev.find(t => t.topic === topic);
            if (existing) {
                const newEnabled = !existing.enabled;
                // Auto-expand when enabling
                if (newEnabled) {
                    setExpandedTopics(prevExpanded => {
                        const next = new Set(prevExpanded);
                        next.add(topic);
                        return next;
                    });
                }
                return prev.map(t =>
                    t.topic === topic ? { ...t, enabled: newEnabled } : t
                );
            } else {
                // New topic, enable and expand
                setExpandedTopics(prevExpanded => {
                    const next = new Set(prevExpanded);
                    next.add(topic);
                    return next;
                });
                return [...prev, { topic, enabled: true, deployments: [] }];
            }
        });
    };

    const addDeployment = (topic: string) => {
        setMockTopicConfigs(prev => prev.map(t =>
            t.topic === topic
                ? { ...t, deployments: [...(t.deployments || []), { department: '', year: '', course: '' }] }
                : t
        ));
    };

    const updateDeployment = (topic: string, index: number, field: string, value: string) => {
        setMockTopicConfigs(prev => prev.map(t =>
            t.topic === topic
                ? {
                    ...t,
                    deployments: t.deployments.map((d: any, i: number) =>
                        i === index ? { ...d, [field]: value } : d
                    )
                }
                : t
        ));
    };

    const removeDeployment = (topic: string, index: number) => {
        setMockTopicConfigs(prev => prev.map(t =>
            t.topic === topic
                ? { ...t, deployments: t.deployments.filter((_: any, i: number) => i !== index) }
                : t
        ));
    };

    const saveMockSettings = async () => {
        // If we don't have facultyName yet, we can't save effectively for the student side unless we guess.
        // We'll use the one we have in state.
        if (!currentFacultyName && userName) setCurrentFacultyName(userName);

        // Validation: Check if any enabled topic has incomplete deployments
        const enabledTopics = mockTopicConfigs.filter(t => t.enabled);
        for (const topicConfig of enabledTopics) {
            if (!topicConfig.deployments || topicConfig.deployments.length === 0) {
                toast.error(`Topic "${topicConfig.topic}" is enabled but has no deployments. Please add at least one deployment.`);
                return;
            }
            // Check if any deployment has missing fields
            for (const dep of topicConfig.deployments) {
                if (!dep.department || !dep.year || !dep.course) {
                    toast.error(`Topic "${topicConfig.topic}" has incomplete deployment details. Please fill all fields (Department, Year, Course).`);
                    return;
                }
            }
        }

        setMockConfigLoading(true);
        try {
            const storedUser = localStorage.getItem('user');
            const user = storedUser ? JSON.parse(storedUser) : null;
            if (!user || !user.email) return;

            const finalFacultyName = currentFacultyName || userName;
            console.log('[MOCK TEST SAVE] Saving with faculty name:', finalFacultyName);
            console.log('[MOCK TEST SAVE] Config to save:', mockTopicConfigs);

            const res = await fetch('/api/admin/mock-test-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': user.email
                },
                body: JSON.stringify({
                    facultyName: finalFacultyName,
                    topics: mockTopicConfigs
                })
            });

            if (res.ok) {
                toast.success('Mock test settings saved!');
                setIsMockTestModalOpen(false);
            } else {
                toast.error('Failed to save settings');
            }
        } catch (error) {
            toast.error('Error saving settings');
        } finally {
            setMockConfigLoading(false);
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

    const saveToDatabase = async () => {
        if (previewContent.length === 0) return;
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
                topic: q.topic.charAt(0).toUpperCase() + q.topic.slice(1),
                subtopic: q.subtopic.charAt(0).toUpperCase() + q.subtopic.slice(1),
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
                toast.success('Saved successfully!');
                setIsEditorOpen(false);
                setManualData({ id: '', type: 'broad', topic: '', subtopic: '', text: '', examNames: [], examName: '', marks: '' });
                setJsonContent('');
                setPreviewContent([]);

                // Get the ID of the question we just saved (if editing one)
                // If it was a new question, we might not have the ID unless we return it from API, 
                // but for edits we have manualData.id or lastEditedId
                const targetId = lastEditedId.current;

                if (userEmail) await fetchQuestions(userEmail);

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
                toast.error('Failed to save.');
            }
        } catch (error) {
            toast.error('Error saving questions.');
        } finally {
            setLoading(false);
        }
    };

    // --- Viewer Logic ---
    // Filter Questions for Paper Modal
    const paperModalFilteredQuestions = questions.filter((q) => {
        if (!q.topic) return false;
        if (selectedTopic && q.topic !== selectedTopic) return false;
        if (selectedSubtopic && q.subtopic !== selectedSubtopic) return false;
        return true;
    });

    // Reset filters when closing modal
    useEffect(() => {
        if (!isPaperModalOpen) {
            setSelectedTopic('');
            setSelectedSubtopic('');
        }
    }, [isPaperModalOpen]);

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
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

    // --- Paper Generator Logic ---
    const generatePreview = () => {
        const selectedQs = questions.filter(q => selectedQuestionIds.has(q.id));
        setPaperQuestions(selectedQs);

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
        setPaperPreviewKey(prev => prev + 1); // Force iframe remount
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
            // Wait a bit to ensure iframe content is fully loaded
            setTimeout(() => {
                if (iframe.contentWindow) {
                    iframe.contentWindow.print();
                } else if (iframe.contentDocument) {
                    iframe.contentDocument.defaultView?.print();
                }
            }, 500);
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
                            <label className="text-xs font-medium text-gray-500 ml-1">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search questions..."
                                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 pl-9 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>
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
                                </>
                            )}
                        </div>
                    </div>

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
                                <div key={q.id} className="group bg-gray-900/50 border border-gray-800 hover:border-indigo-500/50 rounded-xl p-3 md:p-4 transition-all hover:shadow-lg hover:shadow-indigo-500/5 relative">
                                    <div className="flex items-start gap-3 md:gap-4">
                                        <div className="pt-1 select-none">
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
                                                    {q.id.substring(0, 8)}...
                                                </span>
                                            </div>

                                            <div className="text-gray-200 text-xs md:text-sm leading-relaxed prose prose-invert max-w-none overflow-x-auto">
                                                <Latex>{q.text}</Latex>
                                            </div>

                                            {/* Action Buttons (Always show edit on mobile, hover on desktop) */}
                                            <div className="flex items-center gap-2 pt-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => editQuestion(q)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors">
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
                                    onClick={saveToDatabase}
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
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${q.type === 'broad' ? 'border-pink-500 text-pink-400' : q.type === 'mcq' ? 'border-yellow-500 text-yellow-400' : 'border-cyan-500 text-cyan-400'}`}>
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
                                                {q.type === 'mcq' && q.options && q.options.length > 0 && (
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
        </div >
    );
}
