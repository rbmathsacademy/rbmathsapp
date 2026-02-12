'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, GripVertical, Save, Send, AlertTriangle } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import QuestionEditor from '../components/QuestionEditor';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

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
    timeLimit?: number;
    options?: string[];
    correctIndices?: number[];
    shuffleOptions?: boolean;
    fillBlankAnswer?: string;
    caseSensitive?: boolean;
    isNumberRange?: boolean;
    numberRangeMin?: number;
    numberRangeMax?: number;
    comprehensionText?: string;
    comprehensionImage?: string;
    subQuestions?: any[];
}

export default function CreateTestPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const testId = searchParams?.get('id');

    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(90);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [config, setConfig] = useState({
        shuffleQuestions: false,
        showTimer: true,
        allowBackNavigation: true,
        showResults: true,
        passingPercentage: 40,
        enablePerQuestionTimer: false,
        perQuestionDuration: 60
    });

    const [showQuestionEditor, setShowQuestionEditor] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | undefined>();
    const [loading, setLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<string>('draft');
    const [showGraceDialog, setShowGraceDialog] = useState(false);
    const [pendingDeploy, setPendingDeploy] = useState(false);
    const [graceMarks, setGraceMarks] = useState(0);
    const [graceReason, setGraceReason] = useState('');

    const [isAutoSaving, setIsAutoSaving] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUserEmail(JSON.parse(storedUser).email);
        }
    }, []);

    useEffect(() => {
        if (testId && userEmail) {
            loadTest();
        }
    }, [testId, userEmail]);

    const loadTest = async () => {
        try {
            const res = await fetch(`/api/admin/online-tests/${testId}`, {
                headers: { 'X-User-Email': userEmail! }
            });

            if (!res.ok) {
                throw new Error('Failed to load test');
            }

            const test = await res.json();

            if (test) {
                setTitle(test.title);
                setDescription(test.description || '');
                setQuestions(test.questions || []);
                setConfig(test.config || config);
                setDurationMinutes(test.deployment?.durationMinutes || 90);
                setTestStatus(test.status || 'draft');
            }
        } catch (error) {
            console.error('Error loading test:', error);
            toast.error('Failed to load test');
        }
    };

    const addQuestion = (question: Question) => {
        const newQuestions = [...questions, question];
        setQuestions(newQuestions);
        setShowQuestionEditor(false);
        // Auto-save
        saveTest(false, 0, '', true, newQuestions);
    };

    const updateQuestion = (question: Question) => {
        const newQuestions = questions.map(q => q.id === question.id ? question : q);
        setQuestions(newQuestions);
        setShowQuestionEditor(false);
        setEditingQuestion(undefined);
        // Auto-save
        saveTest(false, 0, '', true, newQuestions);
    };

    const deleteQuestion = (id: string) => {
        if (confirm('Delete this question?')) {
            const newQuestions = questions.filter(q => q.id !== id);
            setQuestions(newQuestions);
            // Auto-save
            saveTest(false, 0, '', true, newQuestions);
        }
    };

    const editQuestion = (question: Question) => {
        setEditingQuestion(question);
        setShowQuestionEditor(true);
    };

    const moveQuestion = (index: number, direction: 'up' | 'down') => {
        const newQuestions = [...questions];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= questions.length) return;

        [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
        setQuestions(newQuestions);
        // Auto-save
        saveTest(false, 0, '', true, newQuestions);
    };

    const calculateTotalMarks = () => {
        return questions.reduce((total, q) => {
            if (q.type === 'comprehension' && q.subQuestions) {
                return total + q.subQuestions.reduce((subTotal: number, sq: any) => subTotal + (sq.marks || 0), 0);
            }
            return total + (q.marks || 0);
        }, 0);
    };

    const calculateTotalDuration = () => {
        if (!config.enablePerQuestionTimer) return durationMinutes;
        const totalSeconds = questions.reduce((total, q) => {
            return total + (q.timeLimit || config.perQuestionDuration || 60);
        }, 0);
        return Math.ceil(totalSeconds / 60);
    };

    const saveTest = async (deploy: boolean = false, gMarks: number = 0, gReason: string = '', silent: boolean = false, questionsOverride?: Question[]) => {
        if (!title.trim()) {
            if (!silent) toast.error('Please enter a title');
            return;
        }

        const currentQuestions = questionsOverride || questions;

        if (currentQuestions.length === 0) {
            if (!silent) toast.error('Please add at least one question');
            return;
        }

        // If editing a deployed test, show grace marks dialog first if not provided
        if (testId && testStatus === 'deployed' && !showGraceDialog && gMarks === 0 && !gReason && !silent) {
            setPendingDeploy(deploy);
            setShowGraceDialog(true);
            return;
        }

        if (silent) {
            setIsAutoSaving(true);
        } else {
            setLoading(true);
        }

        try {
            const method = testId ? 'PUT' : 'POST';
            const body: any = {
                title,
                description,
                questions: currentQuestions,
                config,
                deployment: { durationMinutes }
            };

            if (testId) {
                body.id = testId;
                if (testStatus === 'deployed' && gMarks > 0) {
                    body.graceMarks = gMarks;
                    body.graceReason = gReason;
                }
            }

            const res = await fetch('/api/admin/online-tests', {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail!
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                const savedTest = await res.json();

                if (!silent) {
                    toast.success(testId ? 'Test updated successfully' : 'Test created successfully');
                    if (deploy && testStatus !== 'deployed') {
                        // Only redirect to deploy if specifically requested AND not already deployed
                        router.push(`/admin/online-tests/deploy/${savedTest._id}`);
                    } else {
                        router.push('/admin/online-tests');
                    }
                } else {
                    // Silent save successful
                    if (!testId && savedTest._id) {
                        // If it came from a new test, update URL without reloading
                        // This updates the testId for future saves
                        // We use replaceState to change URL, but router.replace is safer for Next.js
                        router.replace(`/admin/online-tests/create?id=${savedTest._id}`, { scroll: false });
                    }
                }
            } else {
                const data = await res.json();
                if (!silent) toast.error(data.error || 'Failed to save test');
                else console.error('Auto-save failed:', data.error);
            }
        } catch (error) {
            if (!silent) toast.error('Error saving test');
            console.error('Save error:', error);
        } finally {
            setLoading(false);
            setIsAutoSaving(false);
            setShowGraceDialog(false);
        }
    };

    const getQuestionTypeLabel = (type: string) => {
        const labels: any = {
            mcq: 'MCQ',
            msq: 'MSQ',
            fillblank: 'Fill Blank',
            comprehension: 'Comprehension',
            broad: 'Broad'
        };
        return labels[type] || type;
    };

    const getQuestionTypeColor = (type: string) => {
        const colors: any = {
            mcq: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
            msq: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
            fillblank: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            comprehension: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            broad: 'bg-pink-500/20 text-pink-300 border-pink-500/30'
        };
        return colors[type] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    };

    return (
        <div className="space-y-6 pb-20">
            <Toaster />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-slate-400" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                            {testId ? 'Edit Test' : 'Create New Test'}
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Build your online test with various question types</p>
                    </div>
                </div>
            </div>

            {/* Test Metadata */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
                <h2 className="text-xl font-bold text-white mb-4">Test Information</h2>

                <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Title *</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Mid-Term Mathematics Test"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Description (Optional)</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of the test..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[80px] resize-y"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Duration (minutes)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={config.enablePerQuestionTimer ? calculateTotalDuration() : durationMinutes}
                            readOnly={config.enablePerQuestionTimer}
                            disabled={config.enablePerQuestionTimer}
                            onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                            className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${config.enablePerQuestionTimer ? 'opacity-50 cursor-not-allowed' : ''}`}
                            min="1"
                        />
                        {config.enablePerQuestionTimer && (
                            <div className="absolute top-full left-0 mt-1 text-xs text-purple-400">
                                Duration is auto-calculated from per-question limits.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Test Configuration */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Test Settings</h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <label className="flex items-center gap-3 p-4 bg-slate-950/50 rounded-lg cursor-pointer hover:bg-slate-950 transition-colors">
                        <input
                            type="checkbox"
                            checked={config.shuffleQuestions}
                            onChange={(e) => setConfig({ ...config, shuffleQuestions: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-300">Shuffle Questions</span>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-slate-950/50 rounded-lg cursor-pointer hover:bg-slate-950 transition-colors">
                        <input
                            type="checkbox"
                            checked={config.showTimer}
                            onChange={(e) => setConfig({ ...config, showTimer: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-300">Show Timer</span>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-slate-950/50 rounded-lg cursor-pointer hover:bg-slate-950 transition-colors">
                        <input
                            type="checkbox"
                            checked={config.allowBackNavigation}
                            onChange={(e) => setConfig({ ...config, allowBackNavigation: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-300">Allow Back Navigation</span>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-slate-950/50 rounded-lg cursor-pointer hover:bg-slate-950 transition-colors">
                        <input
                            type="checkbox"
                            checked={config.showResults}
                            onChange={(e) => setConfig({ ...config, showResults: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-300">Show Results After</span>
                    </label>

                    <div className="col-span-2 md:col-span-1">
                        <label className="text-sm font-medium text-slate-300 mb-2 block">Passing %</label>
                        <input
                            type="number"
                            value={config.passingPercentage}
                            onChange={(e) => setConfig({ ...config, passingPercentage: parseInt(e.target.value) || 0 })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            min="0"
                            max="100"
                        />
                    </div>

                    <div className="col-span-2 md:col-span-3 border-t border-white/10 pt-4 mt-2">
                        <label className="flex items-center gap-3 p-4 bg-slate-950/50 rounded-lg cursor-pointer hover:bg-slate-950 transition-colors mb-4">
                            <input
                                type="checkbox"
                                checked={config.enablePerQuestionTimer || false}
                                onChange={(e) => setConfig({ ...config, enablePerQuestionTimer: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-600 bg-slate-950 text-purple-500 focus:ring-purple-500"
                            />
                            <div>
                                <span className="text-sm font-bold text-slate-200 block">Enable Per-Question Timer</span>
                                <span className="text-xs text-slate-500">Each question will have a specific time limit. Global timer will be hidden.</span>
                            </div>
                        </label>

                        {(config.enablePerQuestionTimer) && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="text-sm font-medium text-slate-300 mb-2 block">Default Time per Question (seconds)</label>
                                <div className="flex gap-4 items-center">
                                    <input
                                        type="number"
                                        value={config.perQuestionDuration || 60}
                                        onChange={(e) => setConfig({ ...config, perQuestionDuration: parseInt(e.target.value) || 60 })}
                                        className="w-full md:w-1/3 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                        min="10"
                                    />
                                    <span className="text-sm text-slate-500">
                                        Use 'Time Limit' inside Question Editor to override this for specific questions.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Questions Section */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">Questions ({questions.length})</h2>
                        <p className="text-sm text-slate-400 mt-1">Total Marks: {calculateTotalMarks()}</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingQuestion(undefined);
                            setShowQuestionEditor(true);
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <Plus className="h-5 w-5" />
                        Add Question
                    </button>
                </div>

                {questions.length === 0 ? (
                    <div className="text-center py-12 bg-slate-950/30 rounded-xl border border-dashed border-slate-700">
                        <p className="text-slate-400 mb-4">No questions added yet</p>
                        <button
                            onClick={() => setShowQuestionEditor(true)}
                            className="text-emerald-400 hover:text-emerald-300 font-medium"
                        >
                            Add your first question
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {questions.map((q, index) => (
                            <div
                                key={q.id}
                                className="bg-slate-950/50 border border-white/5 hover:border-emerald-500/30 rounded-xl p-4 transition-all group"
                            >
                                <div className="flex items-start gap-4">
                                    {/* Question Number & Drag Handle */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-slate-300 font-bold text-sm">
                                            {index + 1}
                                        </div>
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => moveQuestion(index, 'up')}
                                                disabled={index === 0}
                                                className="p-1 hover:bg-slate-800 rounded disabled:opacity-30"
                                            >
                                                <GripVertical className="h-3 w-3 text-slate-500 rotate-180" />
                                            </button>
                                            <button
                                                onClick={() => moveQuestion(index, 'down')}
                                                disabled={index === questions.length - 1}
                                                className="p-1 hover:bg-slate-800 rounded disabled:opacity-30"
                                            >
                                                <GripVertical className="h-3 w-3 text-slate-500" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Question Content */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold border uppercase ${getQuestionTypeColor(q.type)}`}>
                                                {getQuestionTypeLabel(q.type)}
                                            </span>
                                            {q.shuffleOptions && (
                                                <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                                                    Shuffle Options
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-500 ml-auto">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                                        </div>

                                        <div className="text-sm text-slate-300 line-clamp-2 mb-2 prose prose-invert prose-sm max-w-none">
                                            {q.latexContent ? <Latex>{q.text}</Latex> : q.text}
                                        </div>

                                        {q.image && (
                                            <div className="mt-2 mb-2">
                                                <img src={q.image} alt="Question" className="h-20 rounded border border-slate-700" />
                                            </div>
                                        )}

                                        {q.type === 'comprehension' && (
                                            <div className="mt-2 text-xs text-purple-400">
                                                {q.subQuestions?.length || 0} sub-question{q.subQuestions?.length !== 1 ? 's' : ''}
                                            </div>
                                        )}

                                        {(q.type === 'mcq' || q.type === 'msq') && (
                                            <div className="mt-2 text-xs text-slate-500">
                                                {q.options?.length || 0} options, {q.correctIndices?.length || 0} correct
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => editQuestion(q)}
                                            className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteQuestion(q.id)}
                                            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Fixed Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-white/10 p-4 md:p-6 backdrop-blur-lg z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
                    <div className="text-sm text-slate-400">
                        {questions.length} question{questions.length !== 1 ? 's' : ''} · {calculateTotalMarks()} marks
                        {isAutoSaving && <span className="ml-4 text-emerald-400 animate-pulse font-medium">Saving changes...</span>}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => router.back()}
                            className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => saveTest(false)}
                            disabled={loading}
                            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            Save Draft
                        </button>
                        <button
                            onClick={() => saveTest(true)}
                            disabled={loading}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Send className="h-4 w-4" />
                            Save & Deploy
                        </button>
                    </div>
                </div>
            </div>

            {/* Question Editor Modal */}
            {showQuestionEditor && (
                <QuestionEditor
                    onSave={editingQuestion ? updateQuestion : addQuestion}
                    onCancel={() => {
                        setShowQuestionEditor(false);
                        setEditingQuestion(undefined);
                    }}
                    initialQuestion={editingQuestion}
                />
            )}

            {/* Grace Marks Confirmation Dialog */}
            {showGraceDialog && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-xl w-full shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-amber-500/20 shadow-lg shadow-amber-500/10">
                                <AlertTriangle className="h-6 w-6 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Editing Deployed Test</h3>
                                <p className="text-slate-400 text-sm">This test is live and may have submissions</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Modifications to a deployed test can affect student scores.
                                Would you like to award grace marks to students who have <strong className="text-emerald-400">already submitted</strong> their answers?
                            </p>

                            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 space-y-4">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={graceMarks > 0 || graceReason.length > 0}
                                            onChange={(e) => {
                                                if (!e.target.checked) return; // Can't uncheck directly, use separate state logic if needed or just toggle
                                                // Actually, let's use a simple toggle logic
                                            }}
                                            onClick={() => {
                                                if (graceMarks > 0 || graceReason.length > 0) {
                                                    setGraceMarks(0);
                                                    setGraceReason('');
                                                } else {
                                                    setGraceMarks(1);
                                                }
                                            }}
                                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-600 bg-slate-700 transition-all checked:border-emerald-500 checked:bg-emerald-500 hover:border-emerald-400"
                                        />
                                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-bold text-white group-hover:text-emerald-400 transition-colors block">Award Grace Marks</span>
                                        <span className="text-slate-400">Apply to existing submissions</span>
                                    </div>
                                </label>

                                {(graceMarks > 0 || graceReason.length > 0) && (
                                    <div className="pl-8 space-y-3 animate-in slide-in-from-top-2 fade-in duration-300">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-1">
                                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Marks</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={graceMarks}
                                                    onChange={(e) => setGraceMarks(Math.max(0, parseInt(e.target.value) || 0))}
                                                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Reason (Required)</label>
                                                <input
                                                    type="text"
                                                    value={graceReason}
                                                    onChange={(e) => setGraceReason(e.target.value)}
                                                    placeholder="e.g. Question 5 error"
                                                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowGraceDialog(false)}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-white/5 hover:border-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if ((graceMarks > 0 || graceReason.length > 0) && !graceReason) {
                                        toast.error('Please provide a reason for grace marks');
                                        return;
                                    }
                                    saveTest(pendingDeploy, graceMarks, graceReason);
                                }}
                                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
