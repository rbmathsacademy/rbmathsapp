'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Filter, Loader2, Check, Plus } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import MultiSelect from '../../components/MultiSelect';

interface Question {
    id: string;
    text: string;
    image?: string;
    latexContent: boolean;
    type: 'mcq' | 'msq' | 'fillblank' | 'comprehension' | 'broad';
    topic?: string;
    subtopic?: string;
    marks: number;
    negativeMarks: number;
    options?: string[];
    correctIndices?: number[];
    fillBlankAnswer?: string;
    explanation?: string;
    subQuestions?: any[];
}

interface BoardSet {
    boards: string[];
    questions: Question[];
}

interface BoardQuestionImportModalProps {
    sets: BoardSet[];
    onImport: (sets: BoardSet[]) => void;
    onCancel: () => void;
}

function BoardPane({ 
    boardSet, 
    filterData, 
    onUpdateQuestions 
}: { 
    boardSet: BoardSet, 
    filterData: any,
    onUpdateQuestions: (questions: Question[]) => void 
}) {
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [selectedExams, setSelectedExams] = useState<string[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(boardSet.questions.map(q => q.id)));

    // Fetch questions when topics are selected
    const fetchQuestionsByFilter = async (topicsList: string[]) => {
        if (topicsList.length === 0) { setQuestions([]); return; }
        setLoading(true);
        try {
            const user = localStorage.getItem('user');
            const email = user ? JSON.parse(user).email : '';
            const params = new URLSearchParams();
            params.set('topic', topicsList.join('|||'));
            const res = await fetch(`/api/admin/questions?${params.toString()}`, {
                headers: { 'X-User-Email': email }
            });
            if (res.ok) {
                const data = await res.json();
                setQuestions(data);
            }
        } catch (error) {
            console.error('Error fetching questions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedTopics.length > 0) {
            fetchQuestionsByFilter(selectedTopics);
        } else {
            setQuestions([]);
        }
    }, [selectedTopics]);

    const topics = useMemo(() => filterData.topics, [filterData]);
    const subtopics = useMemo(() => {
        const available = new Set(questions.filter(q => selectedTopics.includes(q.topic)).map(q => q.subtopic).filter(Boolean));
        return Array.from(available).sort() as string[];
    }, [questions, selectedTopics]);
    const examNames = useMemo(() => filterData.examNames, [filterData]);

    const filteredQuestions = useMemo(() => {
        if (selectedTopics.length === 0 && !searchQuery) return [];
        return questions.filter(q => {
            if (searchQuery && !q.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            if (selectedTopics.length > 0 && !selectedTopics.includes(q.topic)) return false;
            if (selectedSubtopics.length > 0 && !selectedSubtopics.includes(q.subtopic)) return false;
            if (selectedTypes.length > 0 && !selectedTypes.includes(q.type)) return false;
            if (selectedBatches.length > 0 && (!q.batches || !selectedBatches.some(b => q.batches.includes(b)))) return false;
            
            // Exam Name matching (handles both legacy string and new array)
            if (selectedExams.length > 0) {
                const qExams = q.examNames || (q.examName ? [q.examName] : []);
                if (!selectedExams.some(e => qExams.includes(e))) return false;
            }
            return true;
        });
    }, [questions, searchQuery, selectedTopics, selectedSubtopics, selectedTypes, selectedBatches, selectedExams]);

    const handleSelectAll = () => {
        if (selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0) {
            setSelectedIds(new Set());
            onUpdateQuestions([]);
        } else {
            const newIds = new Set(filteredQuestions.map(q => q.id));
            setSelectedIds(newIds);
            onUpdateQuestions(filteredQuestions);
        }
    };

    const toggleSelection = (q: any) => {
        const newIds = new Set(selectedIds);
        let newSelectedQuestions = [...boardSet.questions];
        
        if (newIds.has(q.id)) {
            newIds.delete(q.id);
            newSelectedQuestions = newSelectedQuestions.filter(sq => sq.id !== q.id);
        } else {
            newIds.add(q.id);
            newSelectedQuestions.push(q);
        }
        
        setSelectedIds(newIds);
        onUpdateQuestions(newSelectedQuestions);
    };

    // Calculate marks for selected questions in this pane
    const totalMarks = useMemo(() => {
        return boardSet.questions.reduce((sum, q) => {
            if (q.type === 'comprehension' && q.subQuestions) {
                return sum + q.subQuestions.reduce((subSum: number, sq: any) => subSum + (sq.marks || 0), 0);
            }
            return sum + (q.marks || 0);
        }, 0);
    }, [boardSet.questions]);

    return (
        <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl relative">
            {/* Header */}
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-emerald-400">
                        {boardSet.boards.join(', ')}
                    </h3>
                    <div className="flex items-center gap-3 text-sm font-medium bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                        <span className="text-slate-300">Selected: <span className="text-emerald-400 font-bold">{boardSet.questions.length}</span></span>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-300">Marks: <span className="text-blue-400 font-bold">{totalMarks}</span></span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-slate-800 bg-slate-850 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search questions..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-slate-200"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <MultiSelect placeholder="Topics" options={topics} selected={selectedTopics} onChange={setSelectedTopics} />
                    <MultiSelect placeholder="Subtopics" options={subtopics} selected={selectedSubtopics} onChange={setSelectedSubtopics} />
                    <MultiSelect placeholder="Exam Names" options={examNames} selected={selectedExams} onChange={setSelectedExams} />
                    <MultiSelect 
                        placeholder="Types" 
                        options={['mcq', 'msq', 'fillblank', 'comprehension', 'broad']} 
                        selected={selectedTypes} 
                        onChange={setSelectedTypes} 
                    />
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
                {selectedTopics.length === 0 && !searchQuery ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <Filter className="h-12 w-12 mb-4 opacity-20" />
                        <p>Select topics to load questions</p>
                    </div>
                ) : loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                ) : filteredQuestions.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">No questions found matching criteria</div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center mb-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                            <span className="text-sm text-slate-400 font-medium">Found {filteredQuestions.length} questions</span>
                            <button
                                onClick={handleSelectAll}
                                className="text-sm px-4 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors font-medium border border-blue-500/30"
                            >
                                {selectedIds.size === filteredQuestions.length ? 'Deselect All' : 'Select All Filtered'}
                            </button>
                        </div>
                        {filteredQuestions.map(q => (
                            <div 
                                key={q.id}
                                onClick={() => toggleSelection(q)}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                    selectedIds.has(q.id) 
                                        ? 'bg-blue-900/30 border-blue-500/50' 
                                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex gap-4">
                                    <div className="mt-1">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                                            selectedIds.has(q.id)
                                                ? 'bg-blue-500 border-blue-500 text-white'
                                                : 'border-slate-600'
                                        }`}>
                                            {selectedIds.has(q.id) && <Check className="h-3 w-3" />}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm text-slate-200 mb-2">
                                            {q.latexContent ? <Latex>{q.text}</Latex> : q.text}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[10px]">
                                            <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 font-medium uppercase tracking-wider">{q.type}</span>
                                            {q.topic && <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{q.topic}</span>}
                                            <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{q.marks} Marks</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function BoardQuestionImportModal({ sets, onImport, onCancel }: BoardQuestionImportModalProps) {
    const [filterData, setFilterData] = useState<any>({ topics: [], subtopics: [], examNames: [], batches: [] });
    const [currentSets, setCurrentSets] = useState<BoardSet[]>(sets);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const user = localStorage.getItem('user');
                const email = user ? JSON.parse(user).email : '';
                const res = await fetch('/api/admin/questions/filters', {
                    headers: { 'X-User-Email': email }
                });
                if (res.ok) {
                    const data = await res.json();
                    setFilterData(data);
                }
            } catch (error) {
                console.error('Error fetching filters:', error);
            }
        };
        fetchFilters();
    }, []);

    const updatePaneQuestions = (index: number, newQuestions: Question[]) => {
        const newSets = [...currentSets];
        newSets[index].questions = newQuestions;
        setCurrentSets(newSets);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col p-4 md:p-6">
            <div className="flex justify-between items-center mb-6 px-2">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Board Specific Question Import</h2>
                    <p className="text-slate-400 text-sm">Create parallel question sets simultaneously. Keep marks and difficulty uniform across boards.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onImport(currentSets)}
                        className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                    >
                        <Check className="h-5 w-5" />
                        Confirm Import
                    </button>
                </div>
            </div>

            <div className={`flex-1 grid gap-6 ${currentSets.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {currentSets.map((set, idx) => (
                    <BoardPane 
                        key={idx} 
                        boardSet={set} 
                        filterData={filterData}
                        onUpdateQuestions={(q) => updatePaneQuestions(idx, q)}
                    />
                ))}
            </div>
        </div>
    );
}
