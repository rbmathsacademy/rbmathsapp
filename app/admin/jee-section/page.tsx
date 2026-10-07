'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronDown, X, Check, ArrowLeft, ArrowRight, Home, Loader2, Maximize2, Minimize2, Timer, RotateCcw, Clock, Play, Pause, Plus, Minus } from 'lucide-react';
import Latex from 'react-latex-next';
import LatexWithImages from '../../components/LatexWithImages';
import Scratchpad from '../../../components/Scratchpad';
import 'katex/dist/katex.min.css';

// ─── Inline MultiSelect (dark theme, compact) ───
const MultiSelect = ({ options, selected, onChange, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        let newSelected = selected.includes(value)
            ? selected.filter((item: string) => item !== value)
            : [...selected, value];
        if (value !== "No Topic" && !selected.includes(value)) {
            newSelected = newSelected.filter((item: string) => item !== "No Topic");
        }
        if (selected.includes(value) && newSelected.length === 0) {
            newSelected = ["No Topic"];
        }
        onChange(newSelected);
    };

    const filteredOptions = options.filter((opt: string) =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative flex-1 min-w-[160px]" ref={containerRef}>
            <div
                className="w-full bg-gray-900 border border-gray-700 text-gray-300 rounded-lg p-2 text-xs min-h-[38px] flex items-center justify-between cursor-pointer hover:border-gray-500 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex flex-wrap gap-1 overflow-hidden">
                    {selected.length === 0 || (selected.length === 1 && selected[0] === "No Topic") ? (
                        <span className="text-gray-500">{placeholder}</span>
                    ) : selected.length > 2 ? (
                        <span className="text-white">{selected.filter((s: string) => s !== "No Topic").length} selected</span>
                    ) : (
                        selected.filter((s: string) => s !== "No Topic").map((s: string) => (
                            <span key={s} className="bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[120px]">{s}</span>
                        ))
                    )}
                </div>
                <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0 ml-1" />
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-h-72 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-gray-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    {selected.filter((s: string) => s !== "No Topic").length > 0 && (
                        <div
                            className="px-3 py-2 hover:bg-red-900/30 cursor-pointer flex items-center gap-2 text-xs text-red-400 border-b border-gray-700"
                            onClick={() => onChange(["No Topic"])}
                        >
                            <X className="h-3 w-3" /> Clear
                        </div>
                    )}
                    <div className="overflow-y-auto max-h-56">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500 italic">No matches</div>
                        ) : (
                            filteredOptions.map((opt: string) => (
                                <div
                                    key={opt}
                                    className="px-3 py-2 hover:bg-gray-700 cursor-pointer flex items-center gap-2 text-xs text-gray-300"
                                    onClick={() => toggleOption(opt)}
                                >
                                    <div className={`w-3 h-3 rounded border border-gray-500 flex items-center justify-center flex-shrink-0 ${selected.includes(opt) ? 'bg-blue-600 border-blue-600' : ''}`}>
                                        {selected.includes(opt) && <Check className="h-2 w-2 text-white" />}
                                    </div>
                                    <span className="truncate">{opt}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Page ───
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
    examName?: string;
    marks?: number;
    options?: string[];
    batches?: string[];
}

const LiveTimersSide = ({ isRunning, resetKey }: { isRunning: boolean, resetKey: number }) => {
    // Stopwatch state
    const [swSeconds, setSwSeconds] = useState(0);
    const [isSwActive, setIsSwActive] = useState(false);

    // Countdown state
    const [initialCountdown, setInitialCountdown] = useState(120);
    const [cdSeconds, setCdSeconds] = useState(120);
    const [isCdActive, setIsCdActive] = useState(false);

    useEffect(() => {
        setSwSeconds(0);
        setIsSwActive(false);

        setCdSeconds(initialCountdown);
        setIsCdActive(false);
    }, [resetKey, initialCountdown]);

    useEffect(() => {
        if (!isRunning) return;
        let swInterval: NodeJS.Timeout;
        if (isSwActive) {
            swInterval = setInterval(() => setSwSeconds(prev => prev + 1), 1000);
        }
        return () => clearInterval(swInterval);
    }, [isRunning, isSwActive]);

    useEffect(() => {
        if (!isRunning) return;
        let cdInterval: NodeJS.Timeout;
        if (isCdActive) {
            cdInterval = setInterval(() => setCdSeconds(prev => (prev > 0 ? prev - 1 : 0)), 1000);
        }
        return () => clearInterval(cdInterval);
    }, [isRunning, isCdActive]);

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (!isRunning) return null;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in zoom-in duration-500 w-full shrink-0">
            {/* Stopwatch */}
            <div className="flex flex-col items-center p-4 bg-gray-950/80 backdrop-blur-md border border-gray-800 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Time Taken</span>
                </div>
                <div className="text-4xl font-mono font-bold text-blue-400 tracking-widest drop-shadow-[0_0_12px_rgba(59,130,246,0.6)] mb-4">
                    {formatTime(swSeconds)}
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsSwActive(!isSwActive)} className={`p-2.5 rounded-full transition-colors ${isSwActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                        {isSwActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <button onClick={() => { setIsSwActive(false); setSwSeconds(0); }} className="p-2.5 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Countdown */}
            <div className="flex flex-col items-center p-4 bg-gray-950/80 backdrop-blur-md border border-gray-800 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                    <Timer className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Time Left</span>
                </div>
                
                <div className={`text-4xl font-mono font-bold tracking-widest mb-4 ${cdSeconds <= 10 && cdSeconds > 0 ? 'text-red-500 animate-pulse drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]' : cdSeconds === 0 ? 'text-red-600 drop-shadow-[0_0_12px_rgba(220,38,38,0.8)]' : 'text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.6)]'}`}>
                    {formatTime(cdSeconds)}
                </div>

                <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsCdActive(!isCdActive)} className={`p-2.5 rounded-full transition-colors ${isCdActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                            {isCdActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <button onClick={() => { setIsCdActive(false); setCdSeconds(initialCountdown); }} className="p-2.5 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="w-full h-px bg-gray-800 my-1"></div>

                    <div className="flex items-center justify-between w-full px-2">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Set:</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setInitialCountdown(p => Math.max(60, p - 60))} className="p-1 text-gray-400 hover:text-white"><Minus className="w-3 h-3" /></button>
                            <span className="text-xs font-mono font-bold text-gray-300 w-6 text-center">{initialCountdown / 60}m</span>
                            <button onClick={() => setInitialCountdown(p => p + 60)} className="p-1 text-gray-400 hover:text-white"><Plus className="w-3 h-3" /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function JEESection() {
    // Auth
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Data
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedExams, setSelectedExams] = useState<string[]>([]);
    const [serverFilters, setServerFilters] = useState<{ topics: string[]; subtopics: string[]; examNames: string[]; batches: string[] }>({ topics: [], subtopics: [], examNames: [], batches: [] });
    const [filtersLoading, setFiltersLoading] = useState(true);

    // Question viewer
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);

    // Fullscreen
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }, []);

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    // ─── Auth ───
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserEmail(user.email);
            fetchFilters(user.email);
        }
    }, []);

    // ─── Fetch Filters ───
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
            console.error('[JEE FILTERS] Error:', error);
        } finally {
            setFiltersLoading(false);
        }
    };

    // ─── Fetch Questions ───
    const fetchQuestions = async (email: string, filters?: { topics?: string[]; exams?: string[] }) => {
        setLoading(true);
        try {
            const headers: any = { 'X-User-Email': email };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }
            const params = new URLSearchParams();
            if (filters?.topics && filters.topics.length > 0) params.set('topic', filters.topics.join('|||'));
            if (filters?.exams && filters.exams.length > 0) params.set('exam', filters.exams.join('|||'));
            const url = `/api/admin/questions${params.toString() ? '?' + params.toString() : ''}`;
            const res = await fetch(url, { headers, cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const sorted = data.sort((a: any, b: any) => {
                    if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
                    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                });
                setQuestions(sorted);
            }
        } catch (error) {
            console.error('[JEE] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    // ─── Trigger fetch on filter change ───
    useEffect(() => {
        if (!userEmail) return;
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        if (actualTopics.length > 0) {
            // Fetch all questions for the topic so client-side filters (like Exam) don't shrink
            fetchQuestions(userEmail, { topics: actualTopics });
        } else if (selectedExams.length > 0) {
            // If no topic selected, fetch by exam
            fetchQuestions(userEmail, { exams: selectedExams });
        } else {
            setQuestions([]);
        }
    }, [selectedTopics, selectedExams, userEmail]);

    // ─── Reset viewer on filter change ───
    useEffect(() => {
        setCurrentIndex(0);
        setSelectedOption(null);
        setShowExplanation(false);
        setShowAnswer(false);
    }, [selectedTopics, selectedSubtopics, selectedTypes, selectedExams]);

    // ─── Helper: filter by types ───
    const filterByTypes = (qs: Question[]) => {
        if (selectedTypes.length === 0) return qs;
        return qs.filter(q => selectedTypes.includes(q.type || 'mcq'));
    };

    const isDataFetched = useMemo(() => {
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        return actualTopics.length > 0 || selectedExams.length > 0;
    }, [selectedTopics, selectedExams]);

    // ─── Cascading Filter Options ───
    const topics = useMemo(() => {
        if (!isDataFetched && serverFilters.topics.length > 0) {
            return ["No Topic", ...serverFilters.topics];
        }
        const set = new Set<string>();
        let filtered = filterByTypes(questions);
        if (selectedSubtopics.length > 0) filtered = filtered.filter(q => selectedSubtopics.includes(q.subtopic));
        if (selectedExams.length > 0) {
            filtered = filtered.filter(q => {
                const qExams = q.examNames || (q.examName ? [q.examName] : []);
                return qExams.some((e: string) => selectedExams.includes(e));
            });
        }
        filtered.forEach(q => set.add(q.topic));
        
        // Always include currently selected topics so they can be deselected
        selectedTopics.filter(t => t !== "No Topic").forEach(t => set.add(t));
        
        return ["No Topic", ...Array.from(set).filter(Boolean).sort()];
    }, [isDataFetched, questions, selectedSubtopics, selectedExams, selectedTypes, serverFilters, selectedTopics]);

    const subtopics = useMemo(() => {
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        let filtered = filterByTypes(questions);
        if (actualTopics.length > 0) filtered = filtered.filter(q => actualTopics.includes(q.topic));
        if (selectedExams.length > 0) {
            filtered = filtered.filter(q => {
                const qExams = q.examNames || (q.examName ? [q.examName] : []);
                return qExams.some((e: string) => selectedExams.includes(e));
            });
        }
        const set = new Set(filtered.map(q => q.subtopic));
        
        selectedSubtopics.forEach(s => set.add(s));
        return Array.from(set).filter(Boolean).sort();
    }, [questions, selectedTopics, selectedExams, selectedTypes, selectedSubtopics]);

    const examNames = useMemo(() => {
        if (!isDataFetched && serverFilters.examNames.length > 0) {
            return serverFilters.examNames;
        }
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        const set = new Set<string>();
        let filtered = filterByTypes(questions);
        if (actualTopics.length > 0) filtered = filtered.filter(q => actualTopics.includes(q.topic));
        if (selectedSubtopics.length > 0) filtered = filtered.filter(q => selectedSubtopics.includes(q.subtopic));
        filtered.forEach(q => {
            if (q.examNames && Array.isArray(q.examNames)) q.examNames.forEach(e => set.add(e));
            else if (q.examName) set.add(q.examName);
        });
        
        selectedExams.forEach(e => set.add(e));
        return Array.from(set).filter(Boolean).sort();
    }, [isDataFetched, questions, selectedTopics, selectedSubtopics, selectedTypes, serverFilters, selectedExams]);

    const availableTypes = useMemo(() => {
        if (!isDataFetched) {
            return ['mcq', 'broad', 'short', 'fill_in_the_blanks'];
        }
        
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        let filtered = questions;
        if (actualTopics.length > 0) filtered = filtered.filter(q => actualTopics.includes(q.topic));
        if (selectedSubtopics.length > 0) filtered = filtered.filter(q => selectedSubtopics.includes(q.subtopic));
        if (selectedExams.length > 0) {
            filtered = filtered.filter(q => {
                const qExams = q.examNames || (q.examName ? [q.examName] : []);
                return qExams.some((e: string) => selectedExams.includes(e));
            });
        }
        
        const set = new Set(filtered.map(q => q.type || 'mcq'));
        
        selectedTypes.forEach(t => set.add(t));
        return Array.from(set).filter(Boolean).sort();
    }, [isDataFetched, questions, selectedTopics, selectedSubtopics, selectedExams, selectedTypes]);

    // ─── Filtered Questions for Display ───
    const displayQuestions = useMemo(() => {
        if (selectedTopics.includes("No Topic") && selectedExams.length === 0 && selectedTypes.length === 0) return [];
        const actualTopics = selectedTopics.filter(t => t !== "No Topic");
        return questions.filter(q => {
            if (actualTopics.length > 0 && !actualTopics.includes(q.topic)) return false;
            if (selectedSubtopics.length > 0 && !selectedSubtopics.includes(q.subtopic)) return false;
            if (selectedExams.length > 0) {
                const qExams = q.examNames || (q.examName ? [q.examName] : []);
                if (!qExams.some((e: string) => selectedExams.includes(e))) return false;
            }
            if (selectedTypes.length > 0 && !selectedTypes.includes(q.type || 'mcq')) return false;
            return true;
        });
    }, [questions, selectedTopics, selectedSubtopics, selectedExams, selectedTypes]);

    const totalQuestions = displayQuestions.length;
    const currentQuestion = displayQuestions[currentIndex] || null;

    // ─── Answer Matching ───
    const getCorrectOptionIndex = useCallback((q: Question): number => {
        if (!q || !q.options || !q.answer) return -1;
        const answer = q.answer.trim().toLowerCase();

        // Try direct text match first
        for (let i = 0; i < q.options.length; i++) {
            const optText = q.options[i].trim().toLowerCase();
            if (optText === answer) return i;
        }

        // Try if answer contains LaTeX and option contains same LaTeX (with normalization)
        const normalizeLatex = (s: string) => {
            return s.toLowerCase()
                .replace(/\\text\s*\{([^}]+)\}/g, '$1') // Extract text from \text{...}
                .replace(/\$/g, '') // Remove all $ signs
                .replace(/\s+/g, '') // Remove spaces
                .trim();
        };

        const ansNormalized = normalizeLatex(answer);
        for (let i = 0; i < q.options.length; i++) {
            if (normalizeLatex(q.options[i]) === ansNormalized) return i;
        }

        // Try matching by option letter: "(a)", "(b)", "(c)", "(d)" or "a)", "b)", etc.
        const letterMatch = answer.match(/^\(?([a-d])\)?\.?\s*/i);
        if (letterMatch) {
            const idx = letterMatch[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
            if (idx >= 0 && idx < q.options.length) return idx;
        }

        // Try if answer is contained in an option or option contained in answer
        for (let i = 0; i < q.options.length; i++) {
            const optText = q.options[i].trim().toLowerCase();
            if (answer.includes(optText) || optText.includes(answer)) return i;
        }

        // Try numeric match (strip $ signs for LaTeX numbers)
        const stripMath = (s: string) => s.replace(/\$/g, '').replace(/\\,/g, '').replace(/\s+/g, '').trim();
        const ansNum = stripMath(answer);
        for (let i = 0; i < q.options.length; i++) {
            if (stripMath(q.options[i]) === ansNum) return i;
        }

        return -1;
    }, []);

    // ─── Option Click ───
    const handleOptionClick = (idx: number) => {
        if (selectedOption !== null) return; // Already answered
        setSelectedOption(idx);
        setShowExplanation(true);
    };

    // ─── Navigation ───
    const goNext = () => {
        if (currentIndex < totalQuestions - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedOption(null);
            setShowExplanation(false);
            setShowAnswer(false);
        }
    };

    const goBack = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setSelectedOption(null);
            setShowExplanation(false);
            setShowAnswer(false);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'n') goNext();
            if (e.key === 'ArrowLeft' || e.key === 'p') goBack();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [currentIndex, totalQuestions]);

    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    const correctIdx = currentQuestion ? getCorrectOptionIndex(currentQuestion) : -1;

    const getOptionStyle = (idx: number) => {
        if (selectedOption === null) {
            return 'bg-gray-900 border-gray-600 hover:border-blue-500 hover:bg-gray-800 cursor-pointer';
        }
        // After selection
        if (idx === correctIdx) {
            return 'bg-green-900/60 border-green-500 shadow-lg shadow-green-500/20';
        }
        if (idx === selectedOption && idx !== correctIdx) {
            return 'bg-red-900/60 border-red-500 shadow-lg shadow-red-500/20';
        }
        return 'bg-gray-900/50 border-gray-700 opacity-50';
    };

    // Scroll to top of question panel on question change
    const questionPanelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        questionPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentIndex]);

    return (
        <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden">
            {/* ─── Top Bar: Filters ─── */}
            <div className="flex-shrink-0 bg-gray-950 border-b border-gray-800 px-4 py-3">
                <div className="flex items-center gap-3">
                    {/* Back button */}
                    <a
                        href="/admin/dashboard"
                        className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm flex-shrink-0"
                    >
                        <Home className="h-4 w-4" />
                    </a>

                    <div className="h-6 w-px bg-gray-700 flex-shrink-0" />

                    {/* Filters */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <MultiSelect
                            options={topics}
                            selected={selectedTopics}
                            onChange={setSelectedTopics}
                            placeholder="Topic"
                        />
                        <MultiSelect
                            options={subtopics}
                            selected={selectedSubtopics}
                            onChange={setSelectedSubtopics}
                            placeholder="Sub Topic"
                        />
                        <MultiSelect
                            options={availableTypes}
                            selected={selectedTypes}
                            onChange={setSelectedTypes}
                            placeholder="Type"
                        />
                        <MultiSelect
                            options={examNames}
                            selected={selectedExams}
                            onChange={setSelectedExams}
                            placeholder="Exam"
                        />
                    </div>

                    {/* Question counter */}
                    {totalQuestions > 0 && (
                        <div className="flex-shrink-0 text-sm text-gray-400 font-mono flex items-center mr-2">
                            Q {currentIndex + 1} / {totalQuestions}
                        </div>
                    )}

                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 mr-2 bg-gray-900 rounded-lg p-0.5 border border-gray-800">
                        <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="p-1 text-gray-400 hover:text-white" title="Zoom Out"><Minus className="w-4 h-4" /></button>
                        <span className="text-xs text-gray-400 font-mono w-9 text-center">{Math.round(zoomLevel * 100)}%</span>
                        <button onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.1))} className="p-1 text-gray-400 hover:text-white" title="Zoom In"><Plus className="w-4 h-4" /></button>
                    </div>

                    {/* Fullscreen toggle */}
                    <button
                        onClick={toggleFullscreen}
                        className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {/* ─── Main Content: Split View ─── */}
            <div className="flex-1 flex min-h-0 relative">
                
                {/* ─── FULL-SCREEN SCRATCHPAD OVERLAY ─── */}
                <Scratchpad resetKey={currentIndex} />

                {/* ─── Left Panel: Background for Scratchpad ─── */}
                <div className="w-1/2 bg-black relative border-r border-gray-800">
                    {/* Watermark */}
                    <div className="absolute bottom-8 right-8 text-right select-none pointer-events-none opacity-20">
                        <p className="text-3xl font-bold font-serif italic text-gray-400 tracking-wide">© RB Maths Academy</p>
                        <p className="text-2xl font-semibold font-serif italic text-gray-500 mt-1">Dr. Ritwick Banerjee</p>
                    </div>
                </div>

                {/* ─── Right Panel: Questions ─── */}
                <div className="w-1/2 flex flex-col">
                    <div ref={questionPanelRef} className="flex-1 overflow-y-auto p-6 pb-24">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                <span className="ml-3 text-gray-400">Loading questions...</span>
                            </div>
                        ) : totalQuestions === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <p className="text-2xl text-gray-500 mb-2">📋</p>
                                    <p className="text-gray-400 text-lg">Select filters to load MCQ questions</p>
                                    <p className="text-gray-600 text-sm mt-1">Only MCQ-type questions will appear here</p>
                                </div>
                            </div>
                        ) : currentQuestion ? (
                            <div style={{ zoom: zoomLevel }}>
                                {/* Question Number + Topic */}
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="bg-blue-600 text-white text-lg font-bold px-3 py-1 rounded-lg">
                                        Q{currentIndex + 1}
                                    </span>
                                    <span className="text-gray-500 text-lg">{currentQuestion.topic}</span>
                                    {(currentQuestion.examNames && currentQuestion.examNames.length > 0) && (
                                        <span className="bg-teal-900/60 text-teal-300 text-base font-semibold px-2 py-0.5 rounded-md border border-teal-700/50">
                                            {currentQuestion.examNames.join(', ')}
                                        </span>
                                    )}
                                    {(currentQuestion.marks || 0) > 0 && (
                                        <span className="text-yellow-500 text-base ml-auto">[{currentQuestion.marks} mark{currentQuestion.marks! > 1 ? 's' : ''}]</span>
                                    )}
                                </div>

                                {/* Question Text */}
                                <div className="text-xl leading-relaxed mb-8 text-gray-100">
                                    <LatexWithImages>{currentQuestion.text}</LatexWithImages>
                                </div>

                                {/* Question Image */}
                                {currentQuestion.image && (
                                    <div className="mb-6">
                                        <img
                                            src={currentQuestion.image}
                                            alt="Question"
                                            className="max-w-full h-auto rounded-lg border border-gray-700"
                                            style={{ maxHeight: '300px' }}
                                        />
                                    </div>
                                )}

                                {/* Options and Timer */}
                                <div className="flex gap-6 mb-8">
                                    {/* Options column */}
                                    <div className="w-2/3">
                                        {(currentQuestion.type === 'mcq' || !currentQuestion.type) ? (
                                            <div className="space-y-3">
                                                {currentQuestion.options?.map((opt: any, idx: number) => {
                                                    const isObj = typeof opt === 'object' && opt !== null;
                                                    const optText = isObj ? (opt.text ?? '') : (opt ?? '');
                                                    const optImage = isObj ? (opt.image ?? '') : '';
                                                    return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleOptionClick(idx)}
                                                        disabled={selectedOption !== null}
                                                        className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-300 ${getOptionStyle(idx)} break-words whitespace-normal`}
                                                    >
                                                        <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-all duration-300 mt-0.5 ${
                                                            selectedOption === null
                                                                ? 'border-gray-500 text-gray-400'
                                                                : idx === correctIdx
                                                                    ? 'border-green-400 text-green-400 bg-green-900/40'
                                                                    : idx === selectedOption
                                                                        ? 'border-red-400 text-red-400 bg-red-900/40'
                                                                        : 'border-gray-700 text-gray-600'
                                                        }`}>
                                                            {selectedOption !== null && idx === correctIdx ? (
                                                                <Check className="h-6 w-6" />
                                                            ) : selectedOption !== null && idx === selectedOption && idx !== correctIdx ? (
                                                                <X className="h-6 w-6" />
                                                            ) : (
                                                                optionLabels[idx]
                                                            )}
                                                        </span>
                                                        <div className="flex flex-col gap-2 flex-1 overflow-hidden">
                                                            {optText && <span className="text-lg leading-relaxed pt-1.5 break-words">
                                                                <LatexWithImages>{optText}</LatexWithImages>
                                                            </span>}
                                                            {optImage && <img src={optImage} alt={`Option ${optionLabels[idx]}`} className="max-h-32 object-contain rounded-lg ring-1 ring-white/10" />}
                                                        </div>
                                                    </button>
                                                )})}
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center gap-4">
                                                <div className="flex gap-4">
                                                    {!showAnswer && (
                                                        <button 
                                                            onClick={() => setShowAnswer(true)}
                                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95"
                                                        >
                                                            Show Answer
                                                        </button>
                                                    )}
                                                    {!showExplanation && (
                                                        <button 
                                                            onClick={() => setShowExplanation(true)}
                                                            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95"
                                                        >
                                                            Show Explanation
                                                        </button>
                                                    )}
                                                </div>
                                                {(showAnswer || showExplanation) && (
                                                    <div className="text-gray-400 italic">Timers stopped. Check below.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Timer column */}
                                    <div className="w-1/3 flex justify-end items-start">
                                        <LiveTimersSide isRunning={(currentQuestion.type === 'mcq' || !currentQuestion.type) ? selectedOption === null : !(showAnswer || showExplanation)} resetKey={currentIndex} />
                                    </div>
                                </div>
                                
                                {/* Answer */}
                                {showAnswer && currentQuestion.answer && (
                                    <div className="mb-4 p-4 rounded-xl bg-blue-950/40 border border-blue-800">
                                        <p className="text-lg font-bold text-blue-400 mb-2">Answer</p>
                                        <div className="text-xl text-gray-200">
                                            <LatexWithImages>{currentQuestion.answer}</LatexWithImages>
                                        </div>
                                    </div>
                                )}

                                {/* Explanation */}
                                {showExplanation && currentQuestion.explanation && (
                                    <div className="p-4 rounded-xl bg-gray-900 border border-gray-700">
                                        <p className="text-lg font-bold text-yellow-400 mb-3">Explanation</p>
                                        <div className="text-xl text-gray-300 leading-relaxed">
                                            <LatexWithImages>{currentQuestion.explanation}</LatexWithImages>
                                        </div>
                                    </div>
                                )}

                                {/* Hint (if no explanation) */}
                                {(showExplanation || showAnswer) && !currentQuestion.explanation && currentQuestion.hint && (
                                    <div className="p-4 rounded-xl bg-gray-900 border border-gray-700">
                                        <p className="text-lg font-bold text-purple-400 mb-2">Hint</p>
                                        <div className="text-xl text-gray-300">
                                            <LatexWithImages>{currentQuestion.hint}</LatexWithImages>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {/* ─── Navigation Bar ─── */}
                    {totalQuestions > 0 && (
                        <div className="flex-shrink-0 bg-gray-950 border-t border-gray-800 px-6 py-3 flex items-center justify-between">
                            <button
                                onClick={goBack}
                                disabled={currentIndex === 0}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all ${
                                    currentIndex === 0
                                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                        : 'bg-gray-800 text-white hover:bg-gray-700 active:scale-95'
                                }`}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </button>

                            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto touch-pan-x px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {Array.from({ length: totalQuestions }, (_, qIdx) => (
                                    <button
                                        key={qIdx}
                                        onClick={() => { setCurrentIndex(qIdx); setSelectedOption(null); setShowExplanation(false); setShowAnswer(false); }}
                                        className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm transition-all ${
                                            currentIndex === qIdx
                                                ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-900/50'
                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                        }`}
                                    >
                                        {qIdx + 1}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={goNext}
                                disabled={currentIndex >= totalQuestions - 1}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all ${
                                    currentIndex >= totalQuestions - 1
                                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95'
                                }`}
                            >
                                Next
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
