'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, ChevronLeft, ChevronRight, Flag, Send, AlertTriangle, CheckCircle, Circle, Minus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface Question {
    id: string;
    text: string;
    image?: string;
    latexContent?: boolean;
    type: 'mcq' | 'msq' | 'fillblank' | 'comprehension' | 'broad';
    marks: number;
    timeLimit?: number;
    negativeMarks?: number;
    options?: string[];
    shuffleOptions?: boolean;
    caseSensitive?: boolean;
    isNumberRange?: boolean;
    comprehensionText?: string;
    comprehensionImage?: string;
    subQuestions?: Question[];
}

interface TestData {
    _id: string;
    title: string;
    description?: string;
    totalMarks: number;
    durationMinutes: number;
    startTime?: string;
    endTime?: string;
    config: {
        shuffleQuestions?: boolean;
        showTimer?: boolean;
        allowBackNavigation?: boolean;
        showResults?: boolean;
        passingPercentage?: number;
        enablePerQuestionTimer?: boolean;
        perQuestionDuration?: number;
        maxQuestionsToAttempt?: number;
    };
    questions: Question[];
}

export default function TakeTestPage() {
    const router = useRouter();
    const params = useParams();
    const testId = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [test, setTest] = useState<TestData | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string, any>>(new Map());
    const answersRef = useRef<Map<string, any>>(new Map()); // Ref to access latest answers in closures (timers/handlers)
    const [flagged, setFlagged] = useState<Set<string>>(new Set());
    const [timeLeft, setTimeLeft] = useState(0); // in seconds
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showPalette, setShowPalette] = useState(false);
    const [started, setStarted] = useState(false);
    const [warningCount, setWarningCount] = useState(0);
    const warningCountRef = useRef(0); // Ref to track warning count synchronously
    const [showWarningModal, setShowWarningModal] = useState(false);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isInputFocusedRef = useRef(false); // Track if an input/textarea is focused (for proctoring guard)
    const inputBlurCooldownRef = useRef<NodeJS.Timeout | null>(null); // Cooldown after input blur
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null); // Periodic auto-save
    const testDurationMs = useRef<number>(0); // Total test duration in ms (set once)

    // Flatten questions for navigation (comprehension sub-questions are inline)
    const allQuestions = test?.questions || [];
    const currentQuestion = allQuestions[currentIndex];

    // Per-question timer state
    const [questionTimeLeft, setQuestionTimeLeft] = useState(0);

    // Initialize per-question timer when question changes
    useEffect(() => {
        if (!started || !test?.config?.enablePerQuestionTimer) return;

        // Determine duration for current question
        const qDuration = currentQuestion?.timeLimit || test.config.perQuestionDuration || 60;
        setQuestionTimeLeft(qDuration);

    }, [currentIndex, started, test, currentQuestion]);

    // Per-question timer countdown
    useEffect(() => {
        if (!started || !test?.config?.enablePerQuestionTimer || questionTimeLeft <= 0) return;

        const timer = setInterval(() => {
            setQuestionTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Auto-advance
                    if (currentIndex < allQuestions.length - 1) {
                        toast.success('Time up for this question! Moving to next.');
                        setCurrentIndex(prevIndex => prevIndex + 1);
                    } else {
                        // Last question time up
                        toast.success('Time up for last question!');
                        handleSubmit(true);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [started, test, questionTimeLeft, currentIndex, allQuestions.length]);

    // Proctoring: Visibility Change Detection (mobile-safe)
    // Uses focusin/focusout tracking to avoid false positives from keyboard open/close
    useEffect(() => {
        if (!started) return;

        // Fetch existing warnings on load/resume
        const fetchWarnings = async () => {
            try {
                const res = await fetch(`/api/student/online-tests/${testId}/warning`);
                if (res.ok) {
                    const data = await res.json();
                    setWarningCount(data.count || 0);
                    warningCountRef.current = data.count || 0; // Sync ref
                }
            } catch (e) { console.error('Failed to fetch warnings', e); }
        };
        fetchWarnings();

        // --- Input focus tracking (focusin/focusout bubble, unlike focus/blur) ---
        const handleFocusIn = (e: FocusEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                isInputFocusedRef.current = true;
                // Clear any pending cooldown
                if (inputBlurCooldownRef.current) {
                    clearTimeout(inputBlurCooldownRef.current);
                    inputBlurCooldownRef.current = null;
                }
            }
        };

        const handleFocusOut = (e: FocusEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                // Don't immediately clear — some devices fire focusout+focusin rapidly
                // when switching between inputs or when keyboard is animating
                inputBlurCooldownRef.current = setTimeout(() => {
                    isInputFocusedRef.current = false;
                    inputBlurCooldownRef.current = null;
                }, 1500);
            }
        };

        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);

        // --- Visibility change handler (with multi-layer mobile guards) ---
        let visibilityTimer: NodeJS.Timeout | null = null;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Guard 1: If an input/textarea is focused (tracked via focusin/focusout),
                // the keyboard is likely opening/closing — skip entirely.
                // This is MORE reliable than checking document.activeElement because
                // focusin fires BEFORE the keyboard animation starts on most devices.
                if (isInputFocusedRef.current) {
                    return;
                }

                // Guard 2: Also check activeElement as a fallback
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') {
                    return;
                }

                // Guard 3: Debounce — wait 1200ms and re-verify the page is still hidden.
                // Increased from 800ms to handle slower keyboard animations on budget phones.
                visibilityTimer = setTimeout(() => {
                    if (document.hidden && !isInputFocusedRef.current) {
                        handleViolation();
                    }
                }, 1200);
            } else {
                // Page became visible again within the delay window — cancel pending violation
                if (visibilityTimer) {
                    clearTimeout(visibilityTimer);
                    visibilityTimer = null;
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
            if (visibilityTimer) clearTimeout(visibilityTimer);
            if (inputBlurCooldownRef.current) clearTimeout(inputBlurCooldownRef.current);
        };
    }, [started]); // Removed warningCount dependency to avoid re-attaching listeners endlessly

    const handleViolation = async () => {
        if (submitting) return; // Prevent loop if already submitting

        const newCount = warningCountRef.current + 1;
        warningCountRef.current = newCount; // Update ref immediately
        setWarningCount(newCount); // Update state for UI

        // Show modal for all warnings (1st, 2nd, and 3rd/Termination)
        setShowWarningModal(true);

        // Auto-submit on 3rd warning
        if (newCount >= 3) {
            toast.error('Maximum warnings reached. Test is being auto-submitted.');

            // FIX: Do NOT set submitting(true) here because handleSubmit checks it and will return early.
            // handleSubmit sets it to true internally.
            handleSubmit(true, 'proctoring_violation');
        }

        // Persist warning count
        try {
            await fetch(`/api/student/online-tests/${testId}/warning`, { method: 'POST' });
        } catch (error) {
            console.error('Failed to update warning count', error);
        }
    };



    useEffect(() => {
        fetchTest();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [testId]);

    const fetchTest = async () => {
        try {
            const res = await fetch(`/api/student/online-tests/${testId}`);
            if (!res.ok) {
                if (res.status === 401) { router.push('/student/login'); return; }
                const data = await res.json();
                toast.error(data.error || 'Failed to load test');
                router.push('/student/online-test');
                return;
            }
            const data = await res.json();

            // Calculate total duration if per-question timer is enabled
            if (data.test.config?.enablePerQuestionTimer) {
                // Respect maxQuestionsToAttempt for duration calculation
                const maxQ = data.test.config.maxQuestionsToAttempt;
                const questionsToCount = (maxQ && maxQ > 0)
                    ? data.test.questions.slice(0, maxQ)
                    : data.test.questions;

                const totalSeconds = questionsToCount.reduce((acc: number, q: Question) => {
                    return acc + (q.timeLimit || data.test.config.perQuestionDuration || 60);
                }, 0);
                // Update duration minutes for proper global timer calculation
                data.test.durationMinutes = Math.ceil(totalSeconds / 60);
            }

            setTest(data.test);

            // If we have an existing attempt, restore answers
            if (data.attempt?.answers?.length > 0) {
                const restored = new Map<string, any>();
                data.attempt.answers.forEach((a: any) => restored.set(a.questionId, a.answer));
                setAnswers(restored);
                answersRef.current = restored; // Sync ref
            }

            // If already started, set the time
            if (data.attempt?.status === 'in_progress') {
                const elapsed = data.attempt.timeSpent || (Date.now() - new Date(data.attempt.startedAt).getTime());
                const totalMs = (data.test.durationMinutes || 60) * 60 * 1000;
                testDurationMs.current = totalMs;
                const remaining = Math.max(0, Math.floor((totalMs - elapsed) / 1000));
                setTimeLeft(remaining);
                setStarted(true);
                startTimeRef.current = Date.now() - elapsed;
                setWarningCount(data.attempt.warningCount || 0);
                warningCountRef.current = data.attempt.warningCount || 0; // Sync ref
            } else {
                const totalMs = (data.test.durationMinutes || 60) * 60 * 1000;
                testDurationMs.current = totalMs;
                setTimeLeft((data.test.durationMinutes || 60) * 60);
            }
        } catch {
            toast.error('Error loading test');
            router.push('/student/online-test');
        } finally {
            setLoading(false);
        }
    };

    const startTest = async () => {
        try {
            const res = await fetch(`/api/student/online-tests/${testId}`, { method: 'POST' });
            if (!res.ok) {
                const data = await res.json();
                if (data.error === 'You have already completed this test') {
                    toast.error('You have already completed this test');
                    router.push('/student/online-test');
                    return;
                }
                toast.error(data.error || 'Failed to start test');
                return;
            }
            const data = await res.json();

            // If the backend returns a randomized set of questions (snapshot), update the test state
            if (data.questions && data.questions.length > 0 && test) {
                setTest({
                    ...test,
                    questions: data.questions
                });
            }

            setStarted(true);
            startTimeRef.current = Date.now();
            toast.success('Test started! Good luck!');
        } catch {
            toast.error('Network error');
        }
    };

    // --- Auto-save answers periodically (every 30 seconds) and on pagehide ---
    const doAutoSave = useCallback(async (useBeacon = false) => {
        const currentAnswers = answersRef.current;
        if (currentAnswers.size === 0) return;

        const answerArray: any[] = [];
        for (const q of (test?.questions || [])) {
            if (q.type === 'comprehension' && q.subQuestions) {
                for (const sq of q.subQuestions) {
                    const ans = currentAnswers.get(sq.id);
                    if (ans !== undefined && ans !== null) {
                        answerArray.push({ questionId: sq.id, answer: ans });
                    }
                }
            } else {
                const ans = currentAnswers.get(q.id);
                if (ans !== undefined && ans !== null) {
                    answerArray.push({ questionId: q.id, answer: ans });
                }
            }
        }

        if (answerArray.length === 0) return;

        const payload = JSON.stringify({
            answers: answerArray,
            timeSpent: Date.now() - startTimeRef.current
        });

        if (useBeacon) {
            // sendBeacon is the only reliable way to send data when the page is being unloaded
            navigator.sendBeacon?.(`/api/student/online-tests/${testId}`, new Blob([payload], { type: 'application/json' }));
        } else {
            try {
                await fetch(`/api/student/online-tests/${testId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                });
            } catch { /* silent fail for auto-save */ }
        }
    }, [test, testId]);

    useEffect(() => {
        if (!started) return;

        // Periodic auto-save every 30 seconds
        autoSaveTimerRef.current = setInterval(() => doAutoSave(false), 30000);

        // Save on page hide (tab close, app switch, browser killed)
        // pagehide is more reliable than beforeunload on mobile
        const handlePageHide = () => doAutoSave(true);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [started, doAutoSave]);

    // Timer — uses Date.now() calculation to resist mobile throttling
    // Mobile browsers throttle setInterval when backgrounded, so decrementing
    // a counter would drift. Instead we recalculate from wall-clock time.
    useEffect(() => {
        if (!started || testDurationMs.current <= 0) return;
        timerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const remaining = Math.max(0, Math.floor((testDurationMs.current - elapsed) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(timerRef.current!);
                handleSubmit(true);
            }
        }, 1000);

        // Also recalculate when page becomes visible again (catches mobile background throttling)
        const handleVisible = () => {
            if (!document.hidden) {
                const elapsed = Date.now() - startTimeRef.current;
                const remaining = Math.max(0, Math.floor((testDurationMs.current - elapsed) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    clearInterval(timerRef.current!);
                    handleSubmit(true);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisible);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            document.removeEventListener('visibilitychange', handleVisible);
        };
    }, [started]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const setAnswer = useCallback((questionId: string, answer: any) => {
        setAnswers(prev => {
            const next = new Map(prev);
            if (answer === null || answer === undefined || (Array.isArray(answer) && answer.length === 0) || answer === '') {
                next.delete(questionId);
            } else {
                next.set(questionId, answer);
            }
            answersRef.current = next; // Update ref!
            return next;
        });
    }, []);

    const toggleFlag = (questionId: string) => {
        setFlagged(prev => {
            const next = new Set(prev);
            if (next.has(questionId)) next.delete(questionId);
            else next.add(questionId);
            return next;
        });
    };

    const handleSubmit = async (autoSubmit = false, terminationReason?: string) => {
        if (submitting) return;
        setSubmitting(true);
        setShowSubmitConfirm(false);

        try {
            // Build answers array FROM REF (Critical for auto-submit/timers)
            const currentAnswers = answersRef.current;
            const answerArray: any[] = [];

            // Collect answers for all questions (including comprehension sub-questions)
            for (const q of allQuestions) {
                if (q.type === 'comprehension' && q.subQuestions) {
                    for (const sq of q.subQuestions) {
                        answerArray.push({
                            questionId: sq.id,
                            answer: currentAnswers.get(sq.id) ?? null
                        });
                    }
                } else {
                    answerArray.push({
                        questionId: q.id,
                        answer: currentAnswers.get(q.id) ?? null
                    });
                }
            }

            const timeSpent = Date.now() - startTimeRef.current;

            const res = await fetch(`/api/student/online-tests/${testId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answers: answerArray,
                    timeSpent,
                    terminationReason: terminationReason || (autoSubmit ? 'time_limit' : null)
                })
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(autoSubmit ? 'Time up! Test auto-submitted.' : 'Test submitted successfully!');
                router.push(`/student/online-test/${testId}/result`);
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to submit');
                setSubmitting(false);
            }
        } catch {
            toast.error('Network error while submitting');
            setSubmitting(false);
        }
    };

    // Get question status helpers
    const getQuestionStatus = (q: Question) => {
        if (q.type === 'comprehension' && q.subQuestions) {
            const allAnswered = q.subQuestions.every(sq => answers.has(sq.id) && answers.get(sq.id) !== null && answers.get(sq.id) !== '');
            const someAnswered = q.subQuestions.some(sq => answers.has(sq.id) && answers.get(sq.id) !== null && answers.get(sq.id) !== '');
            if (allAnswered) return 'answered';
            if (someAnswered) return 'partial';
            return 'unanswered';
        }
        const ans = answers.get(q.id);
        if (ans === null || ans === undefined || ans === '' || (Array.isArray(ans) && ans.length === 0)) return 'unanswered';
        return 'answered';
    };

    const answeredCount = allQuestions.reduce((count, q) => {
        if (q.type === 'comprehension' && q.subQuestions) {
            return count + q.subQuestions.filter(sq => {
                const a = answers.get(sq.id);
                return a !== null && a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0);
            }).length;
        }
        const a = answers.get(q.id);
        return count + (a !== null && a !== undefined && a !== '' && !(Array.isArray(a) && a.length === 0) ? 1 : 0);
    }, 0);

    const totalQuestionCount = allQuestions.reduce((count, q) => {
        if (q.type === 'comprehension' && q.subQuestions) return count + q.subQuestions.length;
        return count + 1;
    }, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050b14] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm">Loading test...</p>
                </div>
            </div>
        );
    }

    if (!test) return null;

    // Pre-test screen
    if (!started) {
        return (
            <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 flex items-center justify-center p-4">
                <div className="max-w-lg w-full bg-slate-900/60 border border-white/10 rounded-2xl p-6 sm:p-8 text-center">
                    <div className="mb-6">
                        <div className="inline-flex p-4 rounded-full bg-emerald-500/20 mb-4">
                            <Clock className="h-10 w-10 text-emerald-400" />
                        </div>
                        <h1 className="text-xl font-black text-white mb-2">{test.title}</h1>
                        {test.description && <p className="text-slate-400 text-xs mb-4">{test.description}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                        {/* Questions Count Display */}
                        <div className="bg-slate-800/50 rounded-xl p-3">
                            <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Questions</div>
                            <div className="text-lg font-bold text-white">
                                {test.config?.maxQuestionsToAttempt
                                    ? test.config.maxQuestionsToAttempt
                                    : allQuestions.length}
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3">
                            <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Marks</div>
                            <div className="text-lg font-bold text-white">{test.totalMarks}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3">
                            <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Duration</div>
                            <div className="text-lg font-bold text-white">{test.durationMinutes} min</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3">
                            <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Pass %</div>
                            <div className="text-lg font-bold text-white">{test.config?.passingPercentage || 40}%</div>
                        </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-left text-sm text-amber-200">
                        <div className="flex items-center gap-2 font-bold mb-2">
                            <AlertTriangle className="h-4 w-4" /> Instructions
                        </div>
                        <ul className="space-y-1.5 text-xs text-amber-300/80 list-disc list-inside">
                            <li>Once started, the test cannot be paused</li>
                            {test.config?.enablePerQuestionTimer
                                ? (
                                    <>
                                        <li className="font-bold text-amber-200">PER-QUESTION TIMER ACTIVE: You have a specific time limit for each question.</li>
                                        <li>You will be moved to the next question automatically when time runs out.</li>
                                        <li>Global timer is hidden; focus on the question timer.</li>
                                        <li>You cannot go back to previous questions.</li>
                                    </>
                                )
                                : (
                                    <>
                                        <li>Test will auto-submit when the total time runs out.</li>
                                        {test.config?.shuffleQuestions && <li>Questions may appear in random order</li>}
                                        {test.config?.maxQuestionsToAttempt && <li>You will attempt a random subset of {test.config.maxQuestionsToAttempt} questions.</li>}
                                        {!test.config?.allowBackNavigation && <li>You cannot go back to previous questions</li>}
                                    </>
                                )
                            }
                        </ul>
                    </div>

                    <button
                        onClick={startTest}
                        disabled={loading || started}
                        className="w-full px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-sm sm:text-base transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {started ? 'Starting...' : 'Start Test'}
                    </button>
                </div>
            </div>
        );
    }



    return (
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 flex flex-col relative">
            {/* Strict Orientation Lock Overlay */}
            <style jsx global>{`
                @media screen and (orientation: landscape) {
                    .landscape-blocker { display: flex !important; }
                    .test-content { display: none !important; }
                }
            `}</style>
            <div className="landscape-blocker fixed inset-0 z-[9999] bg-[#050b14] flex-col items-center justify-center p-8 text-center" style={{ display: 'none' }}>
                <div className="p-6 rounded-full bg-red-500/10 mb-6 animate-pulse">
                    <div className="w-16 h-24 border-4 border-red-500 rounded-xl flex items-center justify-center">
                        <div className="w-1 h-12 bg-red-500 rounded-full"></div>
                    </div>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Portrait Mode Required</h2>
                <p className="text-slate-400 max-w-xs mx-auto">
                    Please rotate your device to portrait mode to continue the test. Landscape mode is not allowed.
                </p>
            </div>



            <div className="test-content flex flex-col min-h-screen">
                {/* Top Bar - Timer & Progress */}
                <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 shadow-sm">
                    <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                        <h1 className="text-xs font-bold text-white truncate flex-1 min-w-0">{test.title}</h1>

                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            {/* Progress */}
                            <span className="text-xs text-slate-400 hidden sm:block bg-slate-800 px-2 py-1 rounded-md">
                                {answeredCount}/{totalQuestionCount} answered
                            </span>

                            {/* Global Timer (Hidden if per-question enabled) */}
                            {test.config?.showTimer !== false && !test.config?.enablePerQuestionTimer && (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-[13px] shadow-inner overflow-hidden ${timeLeft <= 300 ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30' :
                                    timeLeft <= 600 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                        'bg-slate-800 text-emerald-400 border border-emerald-500/20'
                                    }`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatTime(timeLeft)}
                                </div>
                            )}

                            {/* Per-Question Timer */}
                            {test.config?.enablePerQuestionTimer && (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-[13px] shadow-inner overflow-hidden ${questionTimeLeft <= 10 ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30' :
                                    'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                    }`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatTime(questionTimeLeft)} (Q)
                                </div>
                            )}

                            {/* Question Palette Toggle */}
                            <button
                                onClick={() => setShowPalette(!showPalette)}
                                className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 text-[10px] font-bold border border-white/10 flex items-center gap-2 transition-all"
                            >
                                <span className="hidden sm:inline">Questions</span>
                                <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{currentIndex + 1}/{allQuestions.length}</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex relative">
                    {/* Question Area */}
                    <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 sm:pb-6">
                        {currentQuestion && (
                            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                                {/* Question Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-bold border border-white/5">
                                            Question {currentIndex + 1}
                                        </span>
                                        <span className="text-xs sm:text-sm text-slate-500 font-medium">
                                            {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? 's' : ''}
                                            {currentQuestion.negativeMarks ? <span className="text-red-400/80 ml-1">(-{currentQuestion.negativeMarks})</span> : ''}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => toggleFlag(currentQuestion.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${flagged.has(currentQuestion.id)
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                                            : 'bg-white/5 text-slate-400 hover:text-amber-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <Flag className={`h-4 w-4 ${flagged.has(currentQuestion.id) ? 'fill-amber-400' : ''}`} />
                                        <span className="hidden sm:inline">{flagged.has(currentQuestion.id) ? 'Flagged' : 'Flag'}</span>
                                    </button>
                                </div>

                                {/* Question Text */}
                                <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3 sm:p-6 shadow-lg">
                                    {currentQuestion.type === 'comprehension' && (
                                        <div className="mb-8 pb-8 border-b border-white/10">
                                            <div className="inline-block px-3 py-1 rounded-lg bg-purple-500/10 text-xs font-bold text-purple-400 uppercase tracking-wider mb-4 border border-purple-500/20">
                                                Passage
                                            </div>
                                            <div className="text-xs sm:text-sm text-slate-300 prose prose-invert prose-p:leading-relaxed prose-img:rounded-xl max-w-none">
                                                {currentQuestion.latexContent ? <Latex>{currentQuestion.comprehensionText || ''}</Latex> : (currentQuestion.comprehensionText || '')}
                                            </div>
                                            {currentQuestion.comprehensionImage && (
                                                <div className="mt-4 rounded-xl overflow-hidden border border-slate-700 bg-black/20">
                                                    <img src={currentQuestion.comprehensionImage} alt="Passage" className="w-full h-auto object-contain max-h-[500px]" />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {currentQuestion.type !== 'comprehension' ? (
                                        <>
                                            <div className="text-sm sm:text-base font-medium text-white leading-relaxed mb-6 prose prose-invert prose-p:text-white prose-headings:text-white max-w-none">
                                                {currentQuestion.latexContent ? <Latex>{currentQuestion.text}</Latex> : currentQuestion.text}
                                            </div>
                                            {currentQuestion.image && (
                                                <div className="mb-6 rounded-xl overflow-hidden border border-slate-700 bg-black/20">
                                                    <img src={currentQuestion.image} alt="Question" className="w-full h-auto object-contain max-h-[500px]" />
                                                </div>
                                            )}
                                            {renderAnswerInput(currentQuestion, answers, setAnswer)}
                                        </>
                                    ) : (
                                        /* Comprehension sub-questions */
                                        <div className="space-y-8">
                                            {currentQuestion.subQuestions?.map((sq, i) => (
                                                <div key={sq.id} className="bg-slate-950/50 rounded-xl p-3 sm:p-5 border border-white/5 relative">
                                                    <div className="absolute top-0 left-0 -mt-2 -ml-2 w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                                                        {String.fromCharCode(65 + i)}
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-4 ml-4">
                                                        <span className="text-xs text-slate-500 font-medium">({sq.marks} marks)</span>
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-white mb-4 prose prose-invert prose-p:leading-relaxed max-w-none">
                                                        {sq.latexContent ? <Latex>{sq.text}</Latex> : sq.text}
                                                    </div>
                                                    {sq.image && (
                                                        <div className="mb-4 rounded-lg overflow-hidden border border-slate-700 bg-black/20">
                                                            <img src={sq.image} alt="Sub-question" className="w-full h-auto object-contain max-h-[300px]" />
                                                        </div>
                                                    )}
                                                    {renderAnswerInput(sq, answers, setAnswer)}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </main>

                    {/* Question Palette Sidebar - Mobile Friendly */}
                    {showPalette && (
                        <div className="fixed inset-0 z-[100]">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPalette(false)}></div>
                            <div className="absolute right-0 top-0 bottom-0 w-[85vw] sm:w-80 bg-[#0a0f1a] border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                                {/* Palette Header */}
                                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                                            <div className="bg-emerald-400 rounded-[1px]"></div>
                                            <div className="bg-slate-600 rounded-[1px]"></div>
                                            <div className="bg-amber-400 rounded-[1px]"></div>
                                            <div className="bg-slate-600 rounded-[1px]"></div>
                                        </div>
                                        Question Palette
                                    </h3>
                                    <button onClick={() => setShowPalette(false)} className="p-2 rounded-lg hover:bg-white/10">
                                        <Minus className="h-5 w-5 text-slate-400 rotate-45" />
                                    </button>
                                </div>

                                {/* Palette Grid */}
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    <div className="grid grid-cols-5 gap-3">
                                        {allQuestions.map((q, i) => {
                                            const status = getQuestionStatus(q);
                                            const isFlagged = flagged.has(q.id);
                                            const isCurrent = i === currentIndex;

                                            return (
                                                <button
                                                    key={q.id}
                                                    onClick={() => { setCurrentIndex(i); setShowPalette(false); }}
                                                    className={`
                                                        relative aspect-square rounded-xl text-xs font-extrabold transition-all duration-200 flex items-center justify-center
                                                        ${isCurrent ? 'ring-2 ring-white scale-110 z-10' : ''} 
                                                        ${status === 'answered' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                                                            status === 'partial' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                                                'bg-slate-800 text-slate-400 border border-white/5 hover:bg-slate-700'
                                                        }
                                                    `}
                                                >
                                                    {i + 1}
                                                    {isFlagged && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-[#0a0f1a]"></div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="p-4 border-t border-white/10 bg-slate-900/50 text-xs text-slate-400 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Answered</div>
                                        <span className="font-bold text-white">{answeredCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500/40 border border-amber-500/50"></div> Partially</div>
                                        <span className="font-bold text-slate-300">-</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-800 border border-slate-600"></div> Unanswered</div>
                                        <span className="font-bold text-slate-300">{totalQuestionCount - answeredCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Flagged</div>
                                        <span className="font-bold text-white">{flagged.size}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Navigation Bar */}
                {/* Bottom Navigation Bar */}
                <div className="fixed bottom-0 left-0 right-0 bg-[#0a0f1a]/95 backdrop-blur-xl border-t border-white/5 px-4 py-3 z-40 safe-area-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
                    <div className="max-w-4xl mx-auto">
                        {/* Mobile Layout (Stacked) */}
                        <div className="flex sm:hidden flex-col gap-2 items-start">
                            {/* Top Row: Back */}
                            <button
                                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                                disabled={currentIndex === 0 || test.config?.allowBackNavigation === false || test.config?.enablePerQuestionTimer === true}
                                className="w-24 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                            >
                                <ChevronLeft className="h-3 w-3" /> Back
                            </button>

                            {/* Bottom Row: Next | Submit */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentIndex(Math.min(allQuestions.length - 1, currentIndex + 1))}
                                    disabled={currentIndex === allQuestions.length - 1}
                                    className="w-24 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                                >
                                    Next <ChevronRight className="h-3 w-3" />
                                </button>

                                <button
                                    onClick={() => setShowSubmitConfirm(true)}
                                    // Submit is always enabled if on last question OR explicit submit allowed? 
                                    // Usually submit is visible always or only on last. 
                                    // Existing logic was disabled={currentIndex !== allQuestions.length - 1}
                                    disabled={currentIndex !== allQuestions.length - 1}
                                    className="w-24 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Send className="h-3 w-3" /> Submit
                                </button>
                            </div>
                        </div>

                        {/* Desktop Layout (Original) */}
                        <div className="hidden sm:flex items-center justify-start gap-4">
                            <button
                                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                                disabled={currentIndex === 0 || test.config?.allowBackNavigation === false || test.config?.enablePerQuestionTimer === true}
                                className="flex-none w-28 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 border border-white/5"
                            >
                                <ChevronLeft className="h-5 w-5" /> Back
                            </button>

                            <button
                                onClick={() => setCurrentIndex(Math.min(allQuestions.length - 1, currentIndex + 1))}
                                disabled={currentIndex === allQuestions.length - 1}
                                className="flex-none w-28 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-800 active:scale-95 shadow-lg shadow-emerald-500/20"
                            >
                                Next <ChevronRight className="h-5 w-5" />
                            </button>

                            <button
                                onClick={() => setShowSubmitConfirm(true)}
                                disabled={currentIndex !== allQuestions.length - 1}
                                className="flex-none w-28 px-4 py-3.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                            >
                                <Send className="h-4 w-4" /> Submit
                            </button>
                        </div>
                    </div>
                </div>

                {/* Submit Confirmation Modal */}
                {showSubmitConfirm && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-xl bg-red-500/20">
                                    <AlertTriangle className="h-6 w-6 text-red-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Submit Test?</h3>
                            </div>

                            <div className="bg-slate-800/50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                                <div className="flex justify-between text-slate-300">
                                    <span className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Answered</span>
                                    <span className="font-bold text-emerald-400">{answeredCount}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                    <span className="flex items-center gap-2"><Circle className="h-3.5 w-3.5 text-slate-500" /> Unanswered</span>
                                    <span className="font-bold text-slate-400">{totalQuestionCount - answeredCount}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                    <span className="flex items-center gap-2"><Flag className="h-3.5 w-3.5 text-amber-400" /> Flagged</span>
                                    <span className="font-bold text-amber-400">{flagged.size}</span>
                                </div>
                            </div>

                            {totalQuestionCount - answeredCount > 0 && (
                                <p className="text-amber-300 text-xs mb-4">
                                    ⚠️ You have {totalQuestionCount - answeredCount} unanswered question(s). Are you sure?
                                </p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSubmitConfirm(false)}
                                    className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all"
                                >
                                    Go Back
                                </button>
                                <button
                                    onClick={() => handleSubmit(false)}
                                    disabled={submitting}
                                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Now'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Warning Modal */}
                {showWarningModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>

                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="p-4 rounded-full bg-red-500/10 mb-2 ring-1 ring-red-500/30">
                                    <AlertTriangle className="h-10 w-10 text-red-500 animate-pulse" />
                                </div>

                                <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                                    {warningCount >= 3 ? 'Test Terminated' : warningCount === 2 ? 'Final Warning' : 'Warning'}
                                </h3>

                                <div className="space-y-2">
                                    <p className="text-slate-300">
                                        {warningCount >= 3
                                            ? "You have exceeded the maximum limit of moving away from the test screen. Your test is being auto-submitted."
                                            : warningCount === 2
                                                ? "You have moved away from the test screen again. This is your FINAL WARNING. The next violation will strictly result in the test being submitted."
                                                : "You moved away from the test screen. This has been recorded. Please stay on the test screen."
                                        }
                                    </p>
                                </div>

                                <button
                                    onClick={() => {
                                        if (warningCount < 3) {
                                            setShowWarningModal(false);
                                            // Removed requestFullscreen to prevent rotation issues
                                        }
                                    }}
                                    disabled={warningCount >= 3}
                                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                >
                                    {warningCount >= 3 ? 'Submitting Test...' : 'I Understand'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Render the answer input for a question
function renderAnswerInput(question: Question, answers: Map<string, any>, setAnswer: (id: string, val: any) => void) {
    const currentAnswer = answers.get(question.id);

    switch (question.type) {
        case 'mcq':
            return (
                <div className="space-y-3">
                    {question.options?.map((option, i) => (
                        <label
                            key={i}
                            onClick={() => setAnswer(question.id, i)}
                            className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 relative overflow-hidden group active:scale-[0.99] touch-manipulation ${currentAnswer === i
                                ? 'bg-emerald-900/10 border-emerald-500/50 shadow-sm'
                                : 'bg-slate-800/40 border-transparent hover:bg-slate-800/60'
                                }`}
                        >
                            <div className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${currentAnswer === i
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-slate-500 group-hover:border-slate-400'
                                }`}>
                                {currentAnswer === i && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                            </div>
                            <span className={`text-xs sm:text-sm flex-1 leading-relaxed ${currentAnswer === i ? 'text-white font-medium' : 'text-slate-300'}`}>
                                <Latex>{option}</Latex>
                            </span>
                        </label>
                    ))}
                    {currentAnswer !== undefined && currentAnswer !== null && (
                        <button
                            onClick={() => setAnswer(question.id, null)}
                            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 mt-2 px-2 py-1 rounded"
                        >
                            <Minus className="h-3 w-3" /> Clear selection
                        </button>
                    )}
                </div>
            );

        case 'msq':
            const selectedIndices: number[] = Array.isArray(currentAnswer) ? currentAnswer : [];
            return (
                <div className="space-y-3">
                    <p className="text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-wider">Select all correct answers</p>
                    {question.options?.map((option, i) => {
                        const isSelected = selectedIndices.includes(i);
                        return (
                            <label
                                key={i}
                                className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 relative overflow-hidden group active:scale-[0.99] touch-manipulation ${isSelected
                                    ? 'bg-emerald-900/10 border-emerald-500/50 shadow-sm'
                                    : 'bg-slate-800/40 border-transparent hover:bg-slate-800/60'
                                    }`}
                            >
                                <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                    ? 'border-emerald-500 bg-emerald-500'
                                    : 'border-slate-500 group-hover:border-slate-400'
                                    }`}>
                                    {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <span className={`text-xs sm:text-sm flex-1 leading-relaxed ${isSelected ? 'text-white font-medium' : 'text-slate-300'}`}>
                                    <Latex>{option}</Latex>
                                </span>
                                {/* Hidden checkbox for logic, but UI depends on div above */}
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                        const next = isSelected
                                            ? selectedIndices.filter(x => x !== i)
                                            : [...selectedIndices, i];
                                        setAnswer(question.id, next.length > 0 ? next : null);
                                    }}
                                    className="hidden"
                                />
                            </label>
                        );
                    })}
                </div>
            );
        case 'fillblank':
            return (
                <div className="pt-2">
                    <input
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={currentAnswer || ''}
                        onChange={e => setAnswer(question.id, e.target.value || null)}
                        placeholder={question.isNumberRange ? 'Enter a number...' : 'Type your answer...'}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                    {question.isNumberRange && (
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <Minus className="h-3 w-3" /> Enter a numeric value within the range
                        </p>
                    )}
                </div>
            );

        case 'broad':
            return (
                <div>
                    <textarea
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={currentAnswer || ''}
                        onChange={e => setAnswer(question.id, e.target.value || null)}
                        placeholder="Write your answer here..."
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm min-h-[120px] resize-y"
                    />
                </div>
            );

        default:
            return null;
    }
}
