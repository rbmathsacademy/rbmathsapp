'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Brain, User, BookOpen, Loader2, Lightbulb, ChevronRight, ChevronLeft, Sparkles, X, Bookmark, Eye, HelpCircle, CheckCircle, Home } from 'lucide-react';
import { toast } from 'react-hot-toast';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import LatexWithImages from '@/app/components/LatexWithImages';

export default function PracticeQuestionsPage() {
    const [resource, setResource] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [animating, setAnimating] = useState(false);

    // Toggles state for current question
    const [showHint, setShowHint] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);

    // Bookmarks
    const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

    // AI Verification State
    const [showAIModal, setShowAIModal] = useState(false);

    const router = useRouter();
    const params = useParams();
    const resourceId = params.id as string;

    useEffect(() => {
        fetchResource();
        fetchBookmarks();
    }, [router, resourceId]);

    // Reset toggles when question changes
    useEffect(() => {
        setShowHint(false);
        setShowAnswer(false);
        setShowExplanation(false);
    }, [currentIndex]);

    const fetchResource = async () => {
        try {
            const res = await fetch(`/api/student/resources/${resourceId}`);
            if (res.ok) {
                const data = await res.json();
                setResource(data.resource);
                // Sort: Topic -> Subtopic -> ID
                const sorted = (data.questions || []).sort((a: any, b: any) => {
                    return (a.topic || '').localeCompare(b.topic || '') ||
                        (a.subtopic || '').localeCompare(b.subtopic || '') ||
                        (a._id || '').localeCompare(b._id || '');
                });
                setQuestions(sorted);
            } else {
                if (res.status === 401) {
                    router.push('/student/login');
                    return;
                }
                toast.error('Failed to load resource');
            }
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const fetchBookmarks = async () => {
        try {
            const res = await fetch('/api/student/bookmarks');
            if (res.ok) {
                const data = await res.json();
                // data is array of populated questions or IDs.
                // Actually, API returns array of populated questions.
                // We just need IDs to check status.
                const ids = new Set<string>(data.map((q: any) => String(q._id || q)));
                setBookmarkedIds(ids);
            }
        } catch (e) { }
    };

    const toggleBookmark = async (questionId: string) => {
        try {
            const res = await fetch('/api/student/bookmarks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ questionId })
            });
            if (res.ok) {
                const data = await res.json();
                setBookmarkedIds(prev => {
                    const next = new Set(prev);
                    if (data.isBookmarked) next.add(questionId);
                    else next.delete(questionId);
                    return next;
                });
                toast.success(data.isBookmarked ? 'Bookmarked!' : 'Removed bookmark');
            } else {
                toast.error('Failed to bookmark. Please login again.');
            }
        } catch (e) {
            toast.error('Failed to update bookmark');
        }
    };

    const handleNext = () => {
        if (currentIndex < filteredQuestions.length - 1) {
            setAnimating(true);
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setAnimating(false);
            }, 300);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setAnimating(true);
            setTimeout(() => {
                setCurrentIndex(prev => prev - 1);
                setAnimating(false);
            }, 300);
        }
    };

    // Filter Logic
    const [selectedSubtopic, setSelectedSubtopic] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedType, setSelectedType] = useState('');

    const subtopics = useMemo(() => {
        let filtered = questions;
        if (selectedExam) {
            const exam = selectedExam;
            filtered = filtered.filter(q => (q.examNames && q.examNames.includes(exam)) || q.examName === exam);
        }
        if (selectedType) {
            filtered = filtered.filter(q => q.type === selectedType);
        }
        return Array.from(new Set(filtered.map(q => q.subtopic))).filter(Boolean).sort();
    }, [questions, selectedExam, selectedType]);

    const examNames = useMemo(() => {
        let filtered = questions;
        if (selectedSubtopic) {
            filtered = filtered.filter(q => q.subtopic === selectedSubtopic);
        }
        if (selectedType) {
            filtered = filtered.filter(q => q.type === selectedType);
        }

        const exams = new Set<string>();
        filtered.forEach(q => {
            if (q.examNames && Array.isArray(q.examNames)) q.examNames.forEach((e: string) => exams.add(e));
            else if (q.examName) exams.add(q.examName);
        });
        return Array.from(exams).sort();
    }, [questions, selectedSubtopic, selectedType]);

    const types = useMemo(() => {
        let filtered = questions;
        if (selectedSubtopic) {
            filtered = filtered.filter(q => q.subtopic === selectedSubtopic);
        }
        if (selectedExam) {
            const exam = selectedExam;
            filtered = filtered.filter(q => (q.examNames && q.examNames.includes(exam)) || q.examName === exam);
        }
        return Array.from(new Set(filtered.map(q => q.type))).filter(Boolean).sort();
    }, [questions, selectedSubtopic, selectedExam]);

    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            if (selectedSubtopic && q.subtopic !== selectedSubtopic) return false;
            if (selectedExam) {
                const exams = q.examNames || (q.examName ? [q.examName] : []);
                if (!exams.includes(selectedExam)) return false;
            }
            if (selectedType && q.type !== selectedType) return false;
            return true;
        });
    }, [questions, selectedSubtopic, selectedExam, selectedType]);

    useEffect(() => {
        setCurrentIndex(0);
    }, [selectedSubtopic, selectedExam, selectedType]);

    // AI Logic
    const generateAIPrompt = (question: any) => {
        return `I need help verifying my answer to this question:\n\nQUESTION:\n${question.latex || question.text}\n\nPlease:\n1. Check if my answer and process are correct\n2. If there are errors, guide me\n3. Keep it crisp.\n\nThank you!`;
    };

    const openGemini = () => {
        if (!questions[currentIndex]) return;
        const prompt = generateAIPrompt(questions[currentIndex]);
        navigator.clipboard.writeText(prompt).then(() => {
            toast.success('Prompt copied!');
            window.open('https://gemini.google.com', '_blank');
            setShowAIModal(false);
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f1a] text-gray-200 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!resource || filteredQuestions.length === 0) {
        if (questions.length > 0 && filteredQuestions.length === 0) {
            // Case where filters hide everything
            return (
                <div className="min-h-screen bg-[#0a0f1a] text-gray-200 p-8 flex flex-col items-center justify-center">
                    <p className="text-gray-400 mb-4">No questions match your filters.</p>
                    <button onClick={() => { setSelectedSubtopic(''); setSelectedExam(''); }} className="text-purple-400 hover:underline">Clear Filters</button>
                    <Link href="/student" className="text-gray-500 hover:text-white mt-4 text-sm">Back to Dashboard</Link>
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-[#0a0f1a] text-gray-200 p-8 flex flex-col items-center justify-center">
                <p className="text-gray-400 mb-4">No questions available.</p>
                <Link href="/student" className="text-purple-400 hover:underline">Back to Dashboard</Link>
            </div>
        );
    }

    const currentQuestion = filteredQuestions[currentIndex];
    const isBookmarked = bookmarkedIds.has(currentQuestion._id);
    // Legacy support for hints in resource object + new field in Question
    const questionHints = resource.hints?.[currentQuestion._id] || (currentQuestion.hint ? [currentQuestion.hint] : []);

    return (
        <div className="min-h-screen bg-[#0a0f1a] text-gray-200 font-sans flex flex-col">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-gradient-radial from-purple-900/10 via-transparent to-transparent rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-30%] right-[-20%] w-[60%] h-[60%] bg-gradient-radial from-violet-900/10 via-transparent to-transparent rounded-full blur-3xl"></div>
            </div>

            {/* Header */}
            <header className="relative z-10 px-3 py-2 md:px-4 md:py-4 border-b border-white/5 bg-black/20 backdrop-blur-md">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex items-center gap-2">
                            <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors" title="Go Back">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <Link href="/student" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors" title="Dashboard">
                                <Home className="h-5 w-5" />
                            </Link>
                        </div>

                        {/* Mobile Filters Toggle could go here, but let's keep it simple with dropdowns */}
                    </div>

                    <div className="text-center flex-1">
                        <h1 className="text-base md:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                            {resource.title}
                        </h1>
                        <p className="text-[10px] md:text-xs text-gray-500">
                            Question {currentIndex + 1} of {filteredQuestions.length}
                        </p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto justify-center">
                        <select
                            className="bg-white/5 border border-white/10 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500 max-w-[120px]"
                            value={selectedSubtopic}
                            onChange={(e) => setSelectedSubtopic(e.target.value)}
                        >
                            <option value="">All Topics</option>
                            {subtopics.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select
                            className="bg-white/5 border border-white/10 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500 max-w-[120px]"
                            value={selectedExam}
                            onChange={(e) => setSelectedExam(e.target.value)}
                        >
                            <option value="">All Exams</option>
                            {examNames.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <select
                            className="bg-white/5 border border-white/10 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500 max-w-[120px]"
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                        >
                            <option value="">All Types</option>
                            {types.map(t => <option key={t} value={t}>{t === 'mcq' ? 'MCQ' : t === 'broad' ? 'Broad' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                        </select>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 relative z-10 flex flex-col items-center justify-start py-4 px-3 md:py-8 md:px-4 overflow-y-auto">
                <div className={`w-full max-w-3xl transition-all duration-300 transform ${animating ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>

                    {/* Question Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative group">
                        {/* Bookmark Badge */}
                        <button
                            onClick={() => toggleBookmark(currentQuestion._id)}
                            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-20"
                            title={isBookmarked ? "Remove Bookmark" : "Bookmark Question"}
                        >
                            <Bookmark className={`h-6 w-6 transition-all ${isBookmarked ? 'fill-yellow-500 text-yellow-500' : 'text-gray-500 group-hover:text-gray-300'}`} />
                        </button>

                        <div className="p-4 md:p-8">
                            {/* Metadata */}
                            <div className="flex flex-wrap gap-1.5 md:gap-2 mb-4 md:mb-6 pr-8 md:pr-12">
                                <span className={`px-2 py-1 rounded-[4px] text-[10px] md:text-xs font-bold uppercase tracking-wider ${currentQuestion.type === 'broad' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                                    {currentQuestion.type}
                                </span>
                                <span className="px-2 py-1 rounded-[4px] text-[10px] md:text-xs font-bold bg-white/5 text-gray-400 border border-white/10">
                                    {currentQuestion.topic}
                                </span>
                                {currentQuestion.examNames && currentQuestion.examNames.map((exam: string, i: number) => (
                                    <span key={i} className="px-2 py-1 rounded-[4px] text-[10px] md:text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                        {exam}
                                    </span>
                                ))}
                                {currentQuestion.marks != null && currentQuestion.marks > 0 && (
                                    <span className="px-2 py-1 rounded-[4px] text-[10px] md:text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        {currentQuestion.marks} Marks
                                    </span>
                                )}
                            </div>

                            {/* Question Text */}
                            <div className="prose prose-invert max-w-none text-base md:text-lg leading-relaxed text-gray-100 font-medium">
                                <Latex>{currentQuestion.latex || currentQuestion.text}</Latex>
                            </div>

                            {/* MCQ Options Display */}
                            {currentQuestion.type === 'mcq' && currentQuestion.options && currentQuestion.options.length > 0 && (
                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    {currentQuestion.options.map((opt: string, i: number) => (
                                        <div
                                            key={i}
                                            className="px-4 py-3 rounded-xl border-2 border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-200 flex items-start gap-3 group cursor-default"
                                        >
                                            <span className="font-bold text-blue-400 text-lg uppercase min-w-[24px]">
                                                {String.fromCharCode(65 + i)}.
                                            </span>
                                            <span className="text-gray-200 text-base leading-relaxed flex-1">
                                                <Latex>{opt}</Latex>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Image */}
                            {currentQuestion.image && (
                                <div className="mt-6">
                                    <img
                                        src={currentQuestion.image}
                                        alt="Question"
                                        className="rounded-xl border border-white/10 max-h-80 object-contain bg-black/50 mx-auto"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Interactive Toggles Toolbar */}
                        <div className="bg-black/20 border-t border-white/5 p-3 md:p-4 flex flex-wrap gap-2 md:gap-3 justify-center">
                            {(questionHints.length > 0) && (
                                <button
                                    onClick={() => {
                                        if (!showHint) {
                                            setShowHint(true);
                                            setShowAnswer(false);
                                            setShowExplanation(false);
                                        } else {
                                            setShowHint(false);
                                        }
                                    }}
                                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all ${showHint ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'}`}
                                >
                                    <Lightbulb className="h-3 w-3 md:h-4 md:w-4" />
                                    {showHint ? 'Hide Hint' : 'Show Hint'}
                                </button>
                            )}

                            {currentQuestion.answer && (
                                <button
                                    onClick={() => {
                                        if (!showAnswer) {
                                            setShowAnswer(true);
                                            setShowHint(false);
                                            setShowExplanation(false);
                                        } else {
                                            setShowAnswer(false);
                                        }
                                    }}
                                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all ${showAnswer ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'}`}
                                >
                                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                                    {showAnswer ? 'Hide Answer' : 'Show Answer'}
                                </button>
                            )}

                            {currentQuestion.explanation && (
                                <button
                                    onClick={() => {
                                        if (!showExplanation) {
                                            setShowExplanation(true);
                                            setShowHint(false);
                                            setShowAnswer(false);
                                        } else {
                                            setShowExplanation(false);
                                        }
                                    }}
                                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all ${showExplanation ? 'bg-blue-500 text-black shadow-lg shadow-blue-500/20' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30'}`}
                                >
                                    <BookOpen className="h-3 w-3 md:h-4 md:w-4" />
                                    {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
                                </button>
                            )}

                            {/* AI Verify Button */}
                            {resource.aiEnabled && (
                                <button
                                    onClick={() => setShowAIModal(true)}
                                    className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all border border-indigo-400/30"
                                >
                                    <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
                                    AI Verify
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Revealing Sections */}
                    <div className="space-y-4 mt-6">
                        {showHint && questionHints.length > 0 && (
                            <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-6 animate-in slide-in-from-top-4 fade-in duration-300">
                                <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4" /> Hints
                                </h3>
                                <div className="space-y-3">
                                    {questionHints.map((hint: string, i: number) => (
                                        <div key={i} className="flex gap-3 text-amber-100/90 leading-relaxed">
                                            <span className="font-bold text-amber-500">{i + 1}.</span>
                                            <div><Latex>{hint}</Latex></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {showAnswer && currentQuestion.answer && (
                            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-6 animate-in slide-in-from-top-4 fade-in duration-300">
                                <h3 className="text-emerald-400 font-bold mb-3 flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" /> Correct Answer
                                </h3>
                                <div className="text-emerald-100/90 text-lg font-medium">
                                    <Latex>{currentQuestion.answer}</Latex>
                                </div>
                            </div>
                        )}

                        {showExplanation && currentQuestion.explanation && (
                            <div className="bg-blue-950/30 border border-blue-500/20 rounded-2xl p-6 animate-in slide-in-from-top-4 fade-in duration-300">
                                <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2">
                                    <BookOpen className="h-4 w-4" /> Explanation
                                </h3>
                                <div className="text-blue-100/90 leading-relaxed space-y-2">
                                    <LatexWithImages>{currentQuestion.explanation}</LatexWithImages>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </main>

            {/* Navigation Footer */}
            <footer className="relative z-20 py-6 flex justify-center gap-4 bg-gradient-to-t from-[#0a0f1a] to-transparent">
                <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition-all active:scale-95"
                >
                    <ArrowLeft className="h-5 w-5" /> Previous
                </button>

                <span className="flex items-center justify-center px-4 font-mono text-gray-500 text-sm">
                    {currentIndex + 1} / {filteredQuestions.length}
                </span>

                <button
                    onClick={handleNext}
                    disabled={currentIndex === filteredQuestions.length - 1}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20 transition-all active:scale-95"
                >
                    Next <ChevronRight className="h-5 w-5" />
                </button>
            </footer>

            {/* AI Modal (Simplified reusing existing logic) */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl max-w-md w-full text-center">
                        <Sparkles className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Verify with AI</h3>
                        <p className="text-gray-400 mb-6 text-sm">We'll copy a prompt for you to paste into Gemini.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowAIModal(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold">Cancel</button>
                            <button onClick={openGemini} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500">Go to Gemini</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .bg-gradient-radial {
                    background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
                }
            `}</style>
        </div>
    );
}
