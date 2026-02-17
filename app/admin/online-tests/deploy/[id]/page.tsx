'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Send, Users, Calendar, Clock, CheckSquare, Square } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

interface Student {
    phoneNumber: string;
    studentName: string;
    batchName: string;
}

export default function DeployTestPage() {
    const router = useRouter();
    const params = useParams();
    const testId = params?.id as string;

    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [test, setTest] = useState<any>(null);
    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
    const [deploymentMode, setDeploymentMode] = useState<'all' | 'specific'>('all');

    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState<number>(60);
    const [loading, setLoading] = useState(true);
    const [deploying, setDeploying] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUserEmail(JSON.parse(storedUser).email);
        }
    }, []);

    useEffect(() => {
        if (userEmail && testId) {
            loadData();
        }
    }, [userEmail, testId]);

    useEffect(() => {
        if (selectedBatches.length > 0) {
            fetchStudents();
        } else {
            setStudents([]);
            setSelectedStudents([]);
        }
    }, [selectedBatches]);

    const loadData = async () => {
        try {
            // Fetch test
            const testsRes = await fetch('/api/admin/online-tests', {
                headers: { 'X-User-Email': userEmail! }
            });
            const tests = await testsRes.json();
            const foundTest = tests.find((t: any) => t._id === testId);

            if (!foundTest) {
                toast.error('Test not found');
                router.push('/admin/online-tests');
                return;
            }

            setTest(foundTest);

            // Compute duration: per-question timer takes priority, then deployment, then fallback
            let defaultDuration = 60; // ultimate fallback
            if (foundTest.config?.enablePerQuestionTimer && foundTest.questions?.length) {
                // Per-question timer: sum up timers for the questions that will be served
                const maxQ = foundTest.config?.maxQuestionsToAttempt;
                const questionsToCount = (maxQ && maxQ > 0)
                    ? foundTest.questions.slice(0, maxQ)
                    : foundTest.questions;
                let totalSeconds = 0;
                for (const q of questionsToCount) {
                    if (q.type === 'comprehension' && q.subQuestions?.length) {
                        for (const sq of q.subQuestions) {
                            totalSeconds += sq.timeLimit || foundTest.config.perQuestionDuration || 60;
                        }
                    } else {
                        totalSeconds += q.timeLimit || foundTest.config.perQuestionDuration || 60;
                    }
                }
                defaultDuration = Math.ceil(totalSeconds / 60);
            } else if (foundTest.deployment?.durationMinutes) {
                defaultDuration = foundTest.deployment.durationMinutes;
            }
            setDurationMinutes(defaultDuration);

            // Fetch batches from Google Sheets
            const batchesRes = await fetch('/api/admin/courses', {
                headers: { 'X-User-Email': userEmail! }
            });
            const batchesData = await batchesRes.json();

            // Ensure batches data is an array
            if (Array.isArray(batchesData)) {
                setBatches(batchesData);
            } else {
                console.error('Invalid batches data:', batchesData);
                setBatches([]);
                toast.error('Failed to load batches: Invalid data format');
            }

            // Pre-fill deployment data if exists
            if (foundTest.deployment) {
                if (foundTest.deployment.startTime) {
                    const start = new Date(foundTest.deployment.startTime);
                    start.setMinutes(start.getMinutes() - start.getTimezoneOffset());
                    setStartTime(start.toISOString().slice(0, 16));
                }

                if (foundTest.deployment.endTime) {
                    const end = new Date(foundTest.deployment.endTime);
                    end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
                    setEndTime(end.toISOString().slice(0, 16));
                }

                if (foundTest.deployment.batches && Array.isArray(foundTest.deployment.batches)) {
                    setSelectedBatches(foundTest.deployment.batches);
                }
            } else {
                // Initialize defaults
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset() + 30); // Local time + 30m
                setStartTime(now.toISOString().slice(0, 16));

                const end = new Date(now.getTime() + defaultDuration * 60000);
                setEndTime(end.toISOString().slice(0, 16));
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/admin/online-tests/students', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail!
                },
                body: JSON.stringify({ batches: selectedBatches })
            });

            console.log('Create/deploy Page: fetchStudents API Status:', res.status, res.statusText);

            const data = await res.json();
            console.log('Create/deploy Page: fetchStudents API Data:', data);

            // Ensure data is an array
            if (Array.isArray(data)) {
                setStudents(data);
                console.log('Students loaded:', data.length);
            } else {
                console.error('Invalid students data received from API:', data);
                console.error('Data type:', typeof data);
                if (data && typeof data === 'object') {
                    console.error('Data keys:', Object.keys(data));
                    // Explicitly show error for debugging
                    if ('error' in data) {
                        console.error('API Error Message:', (data as any).error);
                        alert(`API Error: ${(data as any).error}`);
                    }
                }
                setStudents([]);
                toast.error(`Failed to fetch students: ${(data as any)?.error || 'Invalid data format'}`);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
            setStudents([]);
            toast.error('Failed to fetch students');
        }
    };

    const toggleBatch = (batch: string) => {
        setSelectedBatches(prev =>
            prev.includes(batch) ? prev.filter(b => b !== batch) : [...prev, batch]
        );
    };

    const toggleStudent = (student: Student) => {
        setSelectedStudents(prev => {
            const exists = prev.find(s => s.phoneNumber === student.phoneNumber);
            if (exists) {
                return prev.filter(s => s.phoneNumber !== student.phoneNumber);
            } else {
                return [...prev, student];
            }
        });
    };

    const selectAllStudents = () => {
        setSelectedStudents(students);
    };

    const deselectAllStudents = () => {
        setSelectedStudents([]);
    };

    const deployTest = async () => {
        // Validation Logic
        let finalBatches = selectedBatches;

        // If deployed, trust existing batches if selection is empty
        if (test?.status === 'deployed') {
            if (finalBatches.length === 0 && test.deployment?.batches?.length > 0) {
                finalBatches = test.deployment.batches;
                // console.log('Using existing batches for update:', finalBatches);
            }
        }

        if (test?.status !== 'deployed' && selectedBatches.length === 0) {
            toast.error('Please select at least one batch');
            return;
        }

        if (deploymentMode === 'specific' && selectedStudents.length === 0) {
            toast.error('Please select at least one student');
            return;
        }

        let finalStartTime = startTime;

        // If deployed and start time is empty (maybe not loaded correctly), use existing
        if (test?.status === 'deployed' && !finalStartTime) {
            // Ensure we have a valid start time from deployment
            if (test.deployment?.startTime) {
                finalStartTime = test.deployment.startTime;
            }
        }

        // If still empty, try to derive from pre-filled data again or fail
        if (!finalStartTime) {
            // Check if we can salvage from test object
            if (test?.deployment?.startTime) {
                finalStartTime = test.deployment.startTime;
            } else {
                toast.error('Please set start time');
                return;
            }
        }

        setDeploying(true);
        try {
            const res = await fetch('/api/admin/online-tests/deploy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail!
                },
                body: JSON.stringify({
                    testId,
                    batches: finalBatches,
                    students: deploymentMode === 'specific' ? selectedStudents : [],
                    startTime: finalStartTime,
                    endTime,
                    durationMinutes
                })
            });

            if (res.ok) {
                toast.success(test?.status === 'deployed' ? 'Deployment updated successfully!' : 'Test deployed successfully!');
                setTimeout(() => {
                    router.push('/admin/online-tests');
                }, 1500);
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to deploy test');
            }
        } catch (error) {
            toast.error('Error deploying test');
        } finally {
            setDeploying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-slate-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Toaster />

            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-slate-400" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                        Deploy Test
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Configure deployment settings and select target batches/students</p>
                </div>
            </div>

            {/* Test Info */}
            {test && (
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-2">{test.title}</h2>
                    {test.description && <p className="text-slate-400 text-sm mb-4">{test.description}</p>}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-slate-400 mb-1">Questions</p>
                            <p className="text-lg font-bold text-white">
                                {(test.config?.maxQuestionsToAttempt && test.config.maxQuestionsToAttempt > 0)
                                    ? test.config.maxQuestionsToAttempt
                                    : (test.questions?.length || 0)}
                                {test.config?.maxQuestionsToAttempt > 0 && test.config.maxQuestionsToAttempt < (test.questions?.length || 0) && (
                                    <span className="text-xs text-slate-500 font-normal ml-1">/ {test.questions?.length} pool</span>
                                )}
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-slate-400 mb-1">Total Marks</p>
                            <p className="text-lg font-bold text-white">
                                {(() => {
                                    const maxQ = test.config?.maxQuestionsToAttempt;
                                    const questions = test.questions || [];

                                    if (maxQ && maxQ > 0 && questions.length > 0 && maxQ < questions.length) {
                                        // Calculate sum of marks for the first N questions (subset)
                                        // This is consistent with Create page logic and backend pre-save hook
                                        const subset = questions.slice(0, maxQ);
                                        const subsetTotal = subset.reduce((total: number, q: any) => {
                                            if (q.type === 'comprehension' && q.subQuestions) {
                                                return total + q.subQuestions.reduce((st: number, sq: any) => st + (sq.marks || 0), 0);
                                            }
                                            return total + (q.marks || 0);
                                        }, 0);

                                        // If questions have varying marks, this is an estimate (first N)
                                        // If all have same marks, it's exact.
                                        return subsetTotal;
                                    }
                                    return test.totalMarks || 0;
                                })()}
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-slate-400 mb-1">Duration</p>
                            <p className="text-lg font-bold text-white">{durationMinutes} min</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Selection - Show if draft OR if deployed but no batches found (repair mode) */}
            {(!test?.status || test.status === 'draft' || (test.status === 'deployed' && (!test.deployment?.batches || test.deployment.batches.length === 0))) ? (
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="h-5 w-5 text-emerald-400" />
                        <h2 className="text-xl font-bold text-white">Select Batches</h2>
                        <span className="text-sm text-slate-400">({selectedBatches.length} selected)</span>
                    </div>

                    {batches.length === 0 ? (
                        <p className="text-slate-500 text-sm">No batches found in Google Sheets</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {Array.isArray(batches) && batches.map(batch => (
                                <label
                                    key={batch}
                                    className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all border ${selectedBatches.includes(batch)
                                        ? 'bg-emerald-500/20 border-emerald-500/50'
                                        : 'bg-slate-950/50 border-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedBatches.includes(batch)}
                                        onChange={() => toggleBatch(batch)}
                                        className="w-5 h-5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-medium text-slate-300 flex-1">{batch}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="h-5 w-5 text-emerald-400" />
                        <h2 className="text-xl font-bold text-white">Deployed Batches</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {test.deployment?.batches?.map((batch: string) => (
                            <span key={batch} className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-sm font-medium">
                                {batch}
                            </span>
                        ))}
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm flex items-start gap-2">
                        <div className="mt-0.5"><Users className="h-4 w-4" /></div>
                        <p>Batches cannot be changed for a deployed test. To assign to new batches, please duplicate the test.</p>
                    </div>
                </div>
            )}

            {/* Student Selection - Only show if not deployed */}
            {(!test?.status || test.status === 'draft') && selectedBatches.length > 0 && (
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="h-5 w-5 text-blue-400" />
                        <h2 className="text-xl font-bold text-white">Student Selection</h2>
                    </div>

                    {/* Deployment Mode */}
                    <div className="mb-4 space-y-2">
                        <label className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-lg cursor-pointer hover:bg-slate-950 transition-colors">
                            <input
                                type="radio"
                                name="deploymentMode"
                                checked={deploymentMode === 'all'}
                                onChange={() => setDeploymentMode('all')}
                                className="w-4 h-4"
                            />
                            <span className="text-sm font-medium text-slate-300">
                                All students in selected batches ({students.length} students)
                            </span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-lg cursor-pointer hover:bg-slate-950 transition-colors">
                            <input
                                type="radio"
                                name="deploymentMode"
                                checked={deploymentMode === 'specific'}
                                onChange={() => setDeploymentMode('specific')}
                                className="w-4 h-4"
                            />
                            <span className="text-sm font-medium text-slate-300">
                                Specific students only
                            </span>
                        </label>
                    </div>

                    {/* Student List (if specific mode) */}
                    {deploymentMode === 'specific' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-400">{selectedStudents.length} of {students.length} selected</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllStudents}
                                        className="text-xs px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500/30 transition-colors"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={deselectAllStudents}
                                        className="text-xs px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                                    >
                                        Deselect All
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-64 overflow-y-auto space-y-2 bg-slate-950/30 rounded-lg p-3">
                                {students.map(student => (
                                    <label
                                        key={student.phoneNumber}
                                        className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedStudents.some(s => s.phoneNumber === student.phoneNumber)}
                                            onChange={() => toggleStudent(student)}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-blue-500 focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-300">{student.studentName}</p>
                                            <p className="text-xs text-slate-500">{student.batchName} · {student.phoneNumber}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Schedule */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Calendar className="h-5 w-5 text-purple-400" />
                    <h2 className="text-xl font-bold text-white">Schedule</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-slate-300 mb-2 block">Start Time</label>
                        <input
                            type="datetime-local"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            disabled={test?.status === 'deployed' && startTime !== ''}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {test?.status === 'deployed' && startTime !== '' && <p className="text-xs text-slate-500 mt-1">Start time cannot be changed for deployed tests</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-300 mb-2 block">End Time</label>
                        <input
                            type="datetime-local"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                        <Clock className="h-4 w-4 text-purple-400" />
                        <span className="text-sm text-slate-300">
                            Each student gets <span className="font-bold text-white">{durationMinutes} minutes</span> after starting
                            {test?.config?.enablePerQuestionTimer && <span className="text-purple-400 ml-1">(auto-calculated from per-question timers)</span>}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Duration is configured on the test creation page.</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pb-8">
                <button
                    onClick={() => router.back()}
                    className="px-6 py-3 text-slate-400 hover:text-white transition-colors font-medium"
                >
                    Cancel
                </button>
                <button
                    onClick={deployTest}
                    disabled={deploying || (test?.status !== 'deployed' && selectedBatches.length === 0)}
                    className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Send className="h-5 w-5" />
                    {deploying ? 'Saving...' : (test?.status === 'deployed' ? 'Update Deployment' : 'Deploy Test')}
                </button>
            </div>
        </div>
    );
}
