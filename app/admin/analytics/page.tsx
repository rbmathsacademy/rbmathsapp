
'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    Search,
    ChevronRight,
    XCircle,
    Calendar,
    Trophy,
    Target,
    BarChart2,
    BookOpen,
    FileText
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

interface StudentAnalytics {
    student: {
        _id: string;
        name: string;
        phoneNumber: string;
        joinedAt: string;
    };
    stats: {
        avgTestPercentage: number;
        assignmentCompletionRate: number;
        testsAttempted: number;
        testsMissed: number;
        assignmentsSubmitted: number;
        assignmentsLate: number;
        assignmentsMissed: number;
    };
    tests: Array<{
        testId: string;
        score: number | null;
        percentage: number | null;
        status: string; // 'completed', 'in_progress', 'missed', 'not_enrolled'
        submittedAt: string | null;
        title: string;
        totalMarks: number;
        highestScore: number;
        averageScore: number;
    }>;
    assignments: Array<{
        assignmentId: string;
        status: string;
        submittedAt: string | null;
        title: string;
        deadline: string;
    }>;
}

interface BatchAnalyticsData {
    batch: string;
    tests: Array<{ _id: string; title: string; totalMarks: number; highestScore: number; averageScore: number }>;
    assignments: Array<{ _id: string; title: string; deadline: string }>;
    analytics: StudentAnalytics[];
}

export default function AnalyticsPage() {
    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<BatchAnalyticsData | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<StudentAnalytics | null>(null);

    // Fetch Batches
    useEffect(() => {
        fetch('/api/admin/courses')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setBatches(data);
            })
            .catch(err => toast.error('Failed to load batches'));
    }, []);

    // Fetch Analytics when batch changes
    useEffect(() => {
        if (!selectedBatch) return;

        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/analytics/batch?batch=${encodeURIComponent(selectedBatch)}`);
                const result = await res.json();

                if (!res.ok) throw new Error(result.error);

                // Merge test/assignment data
                const enrichedAnalytics = result.analytics.map((student: any) => ({
                    ...student,
                    tests: student.tests.map((t: any) => {
                        const testInfo = result.tests.find((test: any) => test._id === t.testId);
                        return {
                            ...t,
                            title: testInfo?.title || 'Unknown Test',
                            totalMarks: testInfo?.totalMarks || 0,
                            highestScore: testInfo?.highestScore || 0,
                            averageScore: testInfo?.averageScore || 0
                        };
                    }).sort((a: any, b: any) => {
                        // Sort by date descending (latest first)
                        // Prioritize explicit deployment time if available, otherwise rely on backend order or other heuristics
                        const dateA = new Date(result.tests.find((t: any) => t._id === a.testId)?.deployment?.startTime || 0);
                        const dateB = new Date(result.tests.find((t: any) => t._id === b.testId)?.deployment?.startTime || 0);
                        return dateB.getTime() - dateA.getTime();
                    }),
                    assignments: student.assignments.map((a: any) => {
                        const assignInfo = result.assignments.find((assign: any) => assign._id === a.assignmentId);
                        return { ...a, title: assignInfo?.title || 'Unknown Assignment', deadline: assignInfo?.deadline };
                    })
                }));

                // Sort tests in metadata as well for any other use
                result.tests.sort((a: any, b: any) => new Date(b.deployment?.startTime || 0).getTime() - new Date(a.deployment?.startTime || 0).getTime());

                setData({ ...result, analytics: enrichedAnalytics });
            } catch (error: any) {
                toast.error(error.message || 'Failed to load analytics');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [selectedBatch]);

    const filteredStudents = data?.analytics.filter(s =>
        s.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student.phoneNumber.includes(searchTerm)
    ) || [];

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto min-h-screen text-gray-200">
            <Toaster />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Analytics Dashboard
                    </h1>
                    <p className="text-gray-400 mt-1">Detailed student performance insights</p>
                </div>

                <div className="w-full sm:w-64">
                    <select
                        value={selectedBatch}
                        onChange={(e) => setSelectedBatch(e.target.value)}
                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
                    >
                        <option value="">Select Batch</option>
                        {batches.map(batch => (
                            <option key={batch} value={batch}>{batch}</option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedBatch && !data && loading && (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}

            {data && (
                <div className="space-y-6">
                    {/* Student List */}
                    <div className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h2 className="text-lg font-semibold text-white">Student Overview</h2>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search students..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-black/20 text-gray-400 text-sm uppercase">
                                        <th className="p-4 font-medium sticky left-0 bg-[#0f1115] z-10">Student Info</th>
                                        <th className="p-4 font-medium text-center">Test Performance</th>
                                        <th className="p-4 font-medium text-center">Assignment Stats</th>
                                        <th className="p-4 font-medium text-right sticky right-0 bg-[#0f1115] z-10">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredStudents.map((student) => (
                                        <tr key={student.student._id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4 sticky left-0 bg-[#1a1f2e] group-hover:bg-[#252a3b] transition-colors z-10">
                                                <div>
                                                    <p className="font-medium text-white">{student.student.name || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-500">{student.student.phoneNumber}</p>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div className="bg-green-500/10 rounded p-1 border border-green-500/20">
                                                        <div className="text-xs text-gray-400">Attempted</div>
                                                        <div className="font-bold text-green-400">{student.stats.testsAttempted}</div>
                                                    </div>
                                                    <div className="bg-red-500/10 rounded p-1 border border-red-500/20">
                                                        <div className="text-xs text-gray-400">Missed</div>
                                                        <div className="font-bold text-red-400">{student.stats.testsMissed}</div>
                                                    </div>
                                                    <div className="bg-blue-500/10 rounded p-1 border border-blue-500/20">
                                                        <div className="text-xs text-gray-400">Avg %</div>
                                                        <div className="font-bold text-blue-400">{student.stats.avgTestPercentage}%</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div className="bg-green-500/10 rounded p-1 border border-green-500/20">
                                                        <div className="text-xs text-gray-400">Submitted</div>
                                                        <div className="font-bold text-green-400">{student.stats.assignmentsSubmitted}</div>
                                                    </div>
                                                    <div className="bg-orange-500/10 rounded p-1 border border-orange-500/20">
                                                        <div className="text-xs text-gray-400">Late</div>
                                                        <div className="font-bold text-orange-400">{student.stats.assignmentsLate}</div>
                                                    </div>
                                                    <div className="bg-red-500/10 rounded p-1 border border-red-500/20">
                                                        <div className="text-xs text-gray-400">Missed</div>
                                                        <div className="font-bold text-red-400">{student.stats.assignmentsMissed}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right sticky right-0 bg-[#1a1f2e] group-hover:bg-[#252a3b] transition-colors z-10">
                                                <button
                                                    onClick={() => setSelectedStudent(student)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-blue-500/20"
                                                >
                                                    View Progress
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4 p-4">
                            {filteredStudents.map((student) => (
                                <div key={student.student._id} className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-white text-lg">{student.student.name || 'Unknown'}</p>
                                            <p className="text-sm text-gray-500">{student.student.phoneNumber}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <p className="text-xs text-gray-400 font-semibold uppercase">Tests</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-green-500/10 rounded p-2 text-center border border-green-500/20">
                                                    <div className="text-[10px] text-gray-400">Attempted</div>
                                                    <div className="font-bold text-green-400">{student.stats.testsAttempted}</div>
                                                </div>
                                                <div className="bg-red-500/10 rounded p-2 text-center border border-red-500/20">
                                                    <div className="text-[10px] text-gray-400">Missed</div>
                                                    <div className="font-bold text-red-400">{student.stats.testsMissed}</div>
                                                </div>
                                            </div>
                                            <div className="bg-blue-500/10 rounded p-2 text-center border border-blue-500/20 mt-2">
                                                <div className="text-[10px] text-gray-400">Avg %</div>
                                                <div className="font-bold text-blue-400">{student.stats.avgTestPercentage}%</div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs text-gray-400 font-semibold uppercase">Assignments</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-green-500/10 rounded p-2 text-center border border-green-500/20">
                                                    <div className="text-[10px] text-gray-400">Sub</div>
                                                    <div className="font-bold text-green-400">{student.stats.assignmentsSubmitted}</div>
                                                </div>
                                                <div className="bg-orange-500/10 rounded p-2 text-center border border-orange-500/20">
                                                    <div className="text-[10px] text-gray-400">Late</div>
                                                    <div className="font-bold text-orange-400">{student.stats.assignmentsLate}</div>
                                                </div>
                                            </div>
                                            <div className="bg-red-500/10 rounded p-2 text-center border border-red-500/20 mt-2">
                                                <div className="text-[10px] text-gray-400">Missed</div>
                                                <div className="font-bold text-red-300">{student.stats.assignmentsMissed}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setSelectedStudent(student)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-blue-500/20"
                                    >
                                        View Progress <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Student Detail Modal */}
            {selectedStudent && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
                    <div className="w-full max-w-2xl bg-[#0f1115] h-full border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-start bg-[#1a1f2e]">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">{selectedStudent.student.name}</h2>
                                <p className="text-xs sm:text-sm text-gray-400 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                    <span>{selectedStudent.student.phoneNumber}</span>
                                    <span className="hidden sm:inline">•</span>
                                    <span>Joined: {new Date(selectedStudent.student.joinedAt).toLocaleDateString()}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#0f1115]">

                            {/* Chronological Test List */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-blue-400" />
                                    Test Progress Report
                                </h3>

                                <div className="space-y-4">
                                    {selectedStudent.tests.filter(t => t.status !== 'not_enrolled').map((test, index) => (
                                        <div key={test.testId} className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden shadow-lg">
                                            {/* Header */}
                                            <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-white/5">
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Calendar className="w-4 h-4 text-gray-500" />
                                                    <span className="font-semibold line-clamp-1">{test.title}</span>
                                                </div>
                                                {test.status === 'missed' && (
                                                    <span className="bg-red-500/20 text-red-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-red-500/30 whitespace-nowrap ml-2">Missed</span>
                                                )}
                                            </div>

                                            {/* Body */}
                                            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">

                                                {/* Student Score */}
                                                <div className="flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                                                    <span className="text-gray-400 text-xs uppercase tracking-wider mb-0 sm:mb-1 flex items-center gap-1">
                                                        <Target className="w-3 h-3" /> <span className="sm:hidden">Score:</span><span className="hidden sm:inline">Student Score</span>
                                                    </span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`text-2xl sm:text-3xl font-black ${test.score === null ? 'text-gray-600' :
                                                                (test.percentage || 0) >= 75 ? 'text-green-400' :
                                                                    (test.percentage || 0) >= 40 ? 'text-yellow-400' : 'text-red-400'
                                                            }`}>
                                                            {test.score !== null ? test.score : '-'}
                                                        </span>
                                                        {test.score !== null && (
                                                            <span className="text-xs text-gray-500">/{test.totalMarks}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Topper Score */}
                                                <div className="flex flex-row sm:flex-col justify-between sm:justify-center items-center border-l-0 sm:border-l border-white/10 pt-2 sm:pt-0 border-t sm:border-t-0 mt-2 sm:mt-0">
                                                    <span className="text-gray-400 text-xs uppercase tracking-wider mb-0 sm:mb-1 flex items-center gap-1">
                                                        <Trophy className="w-3 h-3 text-purple-400" /> <span className="sm:hidden">Highest:</span><span className="hidden sm:inline">Highest Score</span>
                                                    </span>
                                                    <div className="flex flex-col items-end sm:items-center">
                                                        <span className="text-xl sm:text-2xl font-bold text-purple-400">
                                                            {test.highestScore}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 hidden sm:inline">Batch Topper</span>
                                                    </div>
                                                </div>

                                                {/* Average Score */}
                                                <div className="flex flex-row sm:flex-col justify-between sm:justify-center items-center border-l-0 sm:border-l border-white/10 pt-2 sm:pt-0 border-t sm:border-t-0 mt-2 sm:mt-0">
                                                    <span className="text-gray-400 text-xs uppercase tracking-wider mb-0 sm:mb-1 flex items-center gap-1">
                                                        <Users className="w-3 h-3 text-blue-400" /> <span className="sm:hidden">Avg:</span><span className="hidden sm:inline">Batch Avg</span>
                                                    </span>
                                                    <div className="flex flex-col items-end sm:items-center">
                                                        <span className="text-xl sm:text-2xl font-bold text-blue-400">
                                                            {test.averageScore}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 hidden sm:inline">Average</span>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    ))}

                                    {selectedStudent.tests.filter(t => t.status !== 'not_enrolled').length === 0 && (
                                        <div className="text-center py-10 bg-[#1a1f2e] rounded-xl border border-white/5">
                                            <p className="text-gray-400">No tests available for this student.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
