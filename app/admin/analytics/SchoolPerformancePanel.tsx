'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Search, Check, X, FileText, Send, User, Download, TrendingUp, TrendingDown, Minus, CheckSquare, AlertCircle } from 'lucide-react';
import { generateBatchSchoolReportPDF } from './generateBatchSchoolReportPDF';

type PerformanceBand = 'ALL' | 'MISSING' | 'EXCEEDED' | 'IN_SYNC' | 'UNDERPERFORMED';

export default function SchoolPerformancePanel({ batch, analyticsData }: { batch: string, analyticsData?: any }) {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [uniqueExams, setUniqueExams] = useState<string[]>([]);
    const [uniqueSchools, setUniqueSchools] = useState<string[]>([]);

    const [filterSchool, setFilterSchool] = useState('');
    const [filterExam, setFilterExam] = useState('');
    // Cascading on filterExam: only meaningful once a specific exam is chosen —
    // "missing" and the performance bands are both computed per-exam.
    const [filterBand, setFilterBand] = useState<PerformanceBand>('ALL');

    // Add marks modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [formExamName, setFormExamName] = useState('');
    const [formDate, setFormDate] = useState('');
    const [formFullMarks, setFormFullMarks] = useState(100);
    const [formMarksObtained, setFormMarksObtained] = useState('');

    // WhatsApp
    const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
    const [whatsappMessage, setWhatsappMessage] = useState('Here is your latest school exam analysis...');

    useEffect(() => {
        fetchData();
        // Reset selections when filters change
        setSelectedPhones(new Set());
    }, [batch, filterSchool, filterExam]);

    // Band filter only makes sense scoped to one exam — drop back to "All" if the
    // exam filter is cleared so it can't silently stay applied to nothing.
    useEffect(() => {
        if (!filterExam) setFilterBand('ALL');
    }, [filterExam]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = `/api/admin/school-exams?batch=${encodeURIComponent(batch)}`;
            if (filterSchool) url += `&schoolName=${encodeURIComponent(filterSchool)}`;
            if (filterExam) url += `&examName=${encodeURIComponent(filterExam)}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setStudents(data.results || []);
                setUniqueExams(data.uniqueExams || []);
                setUniqueSchools(data.uniqueSchools || []);
            }
        } catch (error) {
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMarks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent || !formExamName || !formDate || !formMarksObtained) {
            toast.error('Please fill all required fields');
            return;
        }

        const payload = {
            studentId: selectedStudent._id,
            studentPhone: selectedStudent.phoneNumber,
            batch,
            schoolName: selectedStudent.schoolName || '',
            examName: formExamName,
            date: new Date(formDate),
            fullMarks: Number(formFullMarks),
            marksObtained: Number(formMarksObtained)
        };

        try {
            const res = await fetch('/api/admin/school-exams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success('Marks added successfully');
                setIsModalOpen(false);
                fetchData();
            } else {
                const error = await res.json();
                toast.error(error.error || 'Failed to save');
            }
        } catch (error) {
            toast.error('Error saving marks');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this record?')) return;
        try {
            const res = await fetch(`/api/admin/school-exams/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Deleted successfully');
                fetchData();
            } else {
                toast.error('Failed to delete');
            }
        } catch (error) {
            toast.error('Error deleting record');
        }
    };

    const copyForWhatsApp = () => {
        if (selectedPhones.size === 0) return toast.error('No students selected');
        if (!whatsappMessage) return toast.error('Message cannot be empty');
        
        const selectedStudentsList = students.filter(s => selectedPhones.has(s.phoneNumber));
        // Use alternativePhone if available, else fallback to phoneNumber
        const actualPhones = selectedStudentsList.map(s => s.alternativePhone || s.phoneNumber);
        
        const dataStr = `WHATSAPP_BULK|||${whatsappMessage}|||${actualPhones.join(',')}`;
        navigator.clipboard.writeText(dataStr);
        toast.success(`Copied ${actualPhones.length} number(s)! Open WhatsApp Web and press F9`);
    };

    const toggleSelection = (phone: string) => {
        const newSet = new Set(selectedPhones);
        if (newSet.has(phone)) newSet.delete(phone);
        else newSet.add(phone);
        setSelectedPhones(newSet);
    };

    const handleSelectAll = () => {
        if (selectedPhones.size === displayedStudents.length) {
            setSelectedPhones(new Set());
        } else {
            setSelectedPhones(new Set(displayedStudents.map(s => s.phoneNumber)));
        }
    };

    const getCorrelationData = (student: any, exam: any) => {
        if (!analyticsData || !analyticsData.analytics) return null;
        
        const studentStats = analyticsData.analytics.find((a: any) => a.student.phoneNumber === student.phoneNumber);
        if (!studentStats) return null;

        const examDate = new Date(exam.date);
        
        const priorOnlineTests = studentStats.tests.filter((t: any) => 
            t.status === 'completed' && t.percentage !== null && t.submittedAt && new Date(t.submittedAt) < examDate
        );
        const avgOnline = priorOnlineTests.length > 0 
            ? priorOnlineTests.reduce((sum: number, t: any) => sum + (t.percentage || 0), 0) / priorOnlineTests.length 
            : 0;

        const priorOfflineExams = studentStats.offlineExams.filter((t: any) => 
            new Date(t.testDate) < examDate && typeof t.percentage === 'number'
        );
        const avgOffline = priorOfflineExams.length > 0
            ? priorOfflineExams.reduce((sum: number, t: any) => sum + (t.percentage || 0), 0) / priorOfflineExams.length
            : 0;

        const priorAssignments = studentStats.assignments.filter((a: any) => 
            a.submittedAt && new Date(a.submittedAt) < examDate && a.quality
        );
        
        let assignScore = 0;
        if (priorAssignments.length > 0) {
            let total = 0;
            priorAssignments.forEach((a: any) => {
                if (a.quality === 'GOOD') total += 100;
                else if (a.quality === 'SATISFACTORY') total += 60;
            });
            assignScore = total / priorAssignments.length;
        }

        let systemAvg = 0;
        let weights = 0;
        if (priorOnlineTests.length > 0) { systemAvg += avgOnline * 0.35; weights += 0.35; }
        if (priorOfflineExams.length > 0) { systemAvg += avgOffline * 0.60; weights += 0.60; }
        if (priorAssignments.length > 0) { systemAvg += assignScore * 0.05; weights += 0.05; }
        
        if (weights > 0) {
            systemAvg = systemAvg / weights;
        }

        let syncStatus = 'IN_SYNC';
        if (exam.percentage > systemAvg + 5) syncStatus = 'IMPROVED';
        else if (exam.percentage < systemAvg - 5) syncStatus = 'DETERIORATED';

        return {
            priorAvgOnline: parseFloat(avgOnline.toFixed(2)),
            priorAvgOffline: parseFloat(avgOffline.toFixed(2)),
            priorAssignmentScore: parseFloat(assignScore.toFixed(2)),
            priorSystemAvg: parseFloat(systemAvg.toFixed(2)),
            syncStatus
        };
    };

    // Students currently matching school + exam + performance-band filters. This is
    // what "Select All", the counts, and the PDF export all operate on — so a
    // filtered-then-exported PDF only contains what's on screen.
    const displayedStudents = useMemo(() => {
        if (filterBand === 'ALL' || !filterExam) return students;

        return students.filter(student => {
            const examRecord = student.exams.find((e: any) => e.examName === filterExam);
            if (filterBand === 'MISSING') return !examRecord;
            if (!examRecord) return false;

            const correlation = getCorrelationData(student, examRecord);
            if (!correlation) return false;
            if (filterBand === 'EXCEEDED') return correlation.syncStatus === 'IMPROVED';
            if (filterBand === 'UNDERPERFORMED') return correlation.syncStatus === 'DETERIORATED';
            if (filterBand === 'IN_SYNC') return correlation.syncStatus === 'IN_SYNC';
            return true;
        });
    }, [students, filterExam, filterBand, analyticsData]);

    const handleDownloadBatchReport = () => {
        if (!analyticsData || !analyticsData.analytics) {
            toast.error('Analytics data not fully loaded yet for correlation PDF');
            return;
        }
        // Selected rows take priority; otherwise export everything currently shown.
        const rowsToExport = selectedPhones.size > 0
            ? displayedStudents.filter(s => selectedPhones.has(s.phoneNumber))
            : displayedStudents;
        generateBatchSchoolReportPDF(batch, rowsToExport, getCorrelationData, filterExam || undefined);
        toast.success(`Report downloaded (${rowsToExport.length} student${rowsToExport.length === 1 ? '' : 's'})`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 bg-[#1d1535]/50 p-3 sm:p-4 rounded-xl border border-[#352a55]">
                <div className="flex flex-wrap gap-2 sm:gap-4 w-full items-center">
                    <select 
                        value={filterSchool} 
                        onChange={(e) => setFilterSchool(e.target.value)}
                        className="bg-[#140d27] border border-[#352a55] text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-fuchsia-500 flex-1 min-w-[120px]"
                    >
                        <option value="">All Schools</option>
                        {uniqueSchools.map(s => <option key={s} value={s}>{s || 'Unknown'}</option>)}
                    </select>

                    <select 
                        value={filterExam} 
                        onChange={(e) => setFilterExam(e.target.value)}
                        className="bg-[#140d27] border border-[#352a55] text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-fuchsia-500 flex-1 min-w-[120px]"
                    >
                        <option value="">All Exams</option>
                        {uniqueExams.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>

                    {/* Cascades from the exam filter — missing scores and
                        performance bands are only meaningful for one exam at a time. */}
                    <select
                        value={filterBand}
                        onChange={(e) => setFilterBand(e.target.value as PerformanceBand)}
                        disabled={!filterExam}
                        title={!filterExam ? 'Select an exam first' : undefined}
                        className="bg-[#140d27] border border-[#352a55] text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-fuchsia-500 flex-1 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="ALL">All Students</option>
                        <option value="MISSING">Missing Score</option>
                        <option value="EXCEEDED">Exceeded</option>
                        <option value="IN_SYNC">In Sync</option>
                        <option value="UNDERPERFORMED">Underperformed</option>
                    </select>

                    {displayedStudents.length > 0 && (
                        <button
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 px-3 py-2 bg-[#140d27] border border-[#352a55] hover:bg-[#1d1535] text-slate-300 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                        >
                            <CheckSquare className="w-4 h-4 text-fuchsia-400" />
                            {selectedPhones.size === displayedStudents.length ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 sm:gap-3 w-full items-center">
                    <button 
                        onClick={handleDownloadBatchReport}
                        className="px-3 sm:px-4 py-2 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                        <Download className="w-4 h-4" /> Download Report
                    </button>

                    <textarea
                        rows={3}
                        placeholder="WhatsApp message... (Enter = new line)"
                        value={whatsappMessage}
                        onChange={(e) => setWhatsappMessage(e.target.value)}
                        className="bg-[#140d27] border border-[#352a55] text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-fuchsia-500 flex-1 min-w-[150px] resize-y"
                    />
                    <button 
                        onClick={copyForWhatsApp}
                        className="px-3 sm:px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                        <Send className="w-4 h-4" /> ({selectedPhones.size})
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><div className="w-8 h-8 border-3 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedStudents.map(student => (
                        <div key={student.phoneNumber} className={`bg-[#1d1535]/40 border ${selectedPhones.has(student.phoneNumber) ? 'border-fuchsia-500/50' : 'border-[#352a55]/50'} rounded-xl overflow-hidden shadow-lg transition-colors`}>
                            <div className="p-3 sm:p-4 border-b border-[#352a55]/50 flex justify-between items-start bg-[#1d1535]/60">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedPhones.has(student.phoneNumber)}
                                            onChange={() => toggleSelection(student.phoneNumber)}
                                            className="w-4 h-4 rounded border-[#433666] bg-[#140d27] text-fuchsia-500 focus:ring-fuchsia-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
                                        />
                                        <h3 className="text-slate-200 font-bold text-base sm:text-lg cursor-pointer truncate" onClick={() => toggleSelection(student.phoneNumber)}>{student.name}</h3>
                                    </div>
                                    <p className="text-slate-400 text-xs ml-6 truncate">{student.schoolName || 'No School'} - {student.phoneNumber}</p>
                                    {student.alternativePhone && (
                                        <p className="text-emerald-400/80 text-[10px] ml-6 font-semibold">Alt: {student.alternativePhone}</p>
                                    )}
                                </div>
                                <button 
                                    onClick={() => {
                                        setSelectedStudent(student);
                                        setFormExamName(uniqueExams.length > 0 ? uniqueExams[0] : 'Mid Terms');
                                        setFormDate(new Date().toISOString().split('T')[0]);
                                        setFormMarksObtained('');
                                        setIsModalOpen(true);
                                    }}
                                    className="p-1.5 bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 rounded-md transition-colors shrink-0"
                                    title="Add Exam Record"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="p-3 sm:p-4 flex flex-col gap-3">
                                {student.exams.length === 0 ? (
                                    filterExam ? (
                                        <div className="flex items-center justify-center gap-2 text-amber-400 text-sm text-center py-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            No score recorded for &quot;{filterExam}&quot;
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-sm text-center py-4 italic">No exams recorded.</p>
                                    )
                                ) : (
                                    student.exams.map((exam: any) => {
                                        const correlation = getCorrelationData(student, exam);
                                        return (
                                        <div key={exam._id} className="bg-[#140d27]/50 border border-[#352a55] rounded-lg p-3 text-sm relative group overflow-hidden">
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <button 
                                                    onClick={() => handleDelete(exam._id)}
                                                    className="p-1 bg-[#1d1535] rounded text-slate-300 hover:text-red-400 border border-[#433666] shadow-lg"
                                                    title="Delete Record"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            
                                            <div className="flex justify-between items-end mb-1 pr-8">
                                                <span className="font-semibold text-slate-300 truncate mr-2">{exam.examName}</span>
                                                <span className="font-bold text-emerald-400 text-lg shrink-0">{exam.marksObtained}<span className="text-slate-500 text-xs font-normal">/{exam.fullMarks}</span></span>
                                            </div>
                                            <div className="text-xs text-slate-500 flex justify-between border-b border-[#2a2045] pb-2 mb-2">
                                                <span>{new Date(exam.date).toLocaleDateString()}</span>
                                                <span>{exam.percentage.toFixed(1)}%</span>
                                            </div>

                                            {correlation && (
                                                <div className="flex items-center justify-between mt-1 gap-2">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[10px] uppercase tracking-wider text-slate-500">System Prediction</span>
                                                        <span className="font-medium text-slate-300">{correlation.priorSystemAvg}%</span>
                                                    </div>
                                                    
                                                    {correlation.syncStatus === 'IMPROVED' && (
                                                        <div className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-bold whitespace-nowrap shrink-0">
                                                            <TrendingUp className="w-3 h-3"/> Exceeded
                                                        </div>
                                                    )}
                                                    {correlation.syncStatus === 'DETERIORATED' && (
                                                        <div className="flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-1 rounded text-xs font-bold whitespace-nowrap shrink-0">
                                                            <TrendingDown className="w-3 h-3"/> Underperformed
                                                        </div>
                                                    )}
                                                    {correlation.syncStatus === 'IN_SYNC' && (
                                                        <div className="flex items-center gap-1 text-violet-400 bg-violet-400/10 px-2 py-1 rounded text-xs font-bold whitespace-nowrap shrink-0">
                                                            <Minus className="w-3 h-3"/> In Sync
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )})
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && selectedStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[#140d27] border border-[#352a55] rounded-2xl w-full max-w-md shadow-2xl max-h-[90svh] overflow-y-auto">
                        <div className="p-4 border-b border-[#2a2045] flex justify-between items-center bg-[#1d1535]/30">
                            <h2 className="text-lg font-bold text-white">Add Exam Record</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={handleSaveMarks} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Student</label>
                                <div className="text-slate-200 bg-[#1d1535] px-3 py-2 rounded-lg">{selectedStudent.name} ({selectedStudent.phoneNumber})</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Exam Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={formExamName}
                                    onChange={(e) => setFormExamName(e.target.value)}
                                    className="w-full bg-[#0b0718] border border-[#2a2045] text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-fuchsia-500" 
                                    placeholder="e.g. Pre-Board 1"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Exam Date</label>
                                <input 
                                    type="date" 
                                    required 
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    className="w-full bg-[#0b0718] border border-[#2a2045] text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-fuchsia-500" 
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Marks</label>
                                    <input 
                                        type="number" 
                                        required min="1"
                                        value={formFullMarks}
                                        onChange={(e) => setFormFullMarks(Number(e.target.value))}
                                        className="w-full bg-[#0b0718] border border-[#2a2045] text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-fuchsia-500" 
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Marks Obtained</label>
                                    <input 
                                        type="number" 
                                        required min="0" step="0.5"
                                        value={formMarksObtained}
                                        onChange={(e) => setFormMarksObtained(e.target.value)}
                                        className="w-full bg-[#0b0718] border border-[#2a2045] text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-fuchsia-500" 
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 bg-[#1d1535] hover:bg-[#2a2045] text-slate-300 rounded-lg font-semibold transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg font-semibold transition-colors">Save Marks</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}