'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, Users, Clock, Save, Search, Trash2, CheckSquare, Square } from 'lucide-react';
import InstallPWA from '@/components/InstallPWA';

export default function AdminAttendance() {
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<any>({ attendanceRequirement: 70, attendanceRules: {}, teacherAssignments: {} });
    const [adminEmail, setAdminEmail] = useState<string | null>(null);
    const [students, setStudents] = useState<any[]>([]);

    // Tab State
    const [activeTab, setActiveTab] = useState<'take' | 'manage'>('take');

    // Take Attendance State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [filters, setFilters] = useState({ dept: '', year: '', course: '' });
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
    const [attendanceData, setAttendanceData] = useState<Record<string, boolean>>({}); // studentId -> present (true/false)
    const [selectAll, setSelectAll] = useState(true);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

    // Manage Attendance State
    const [manageFilters, setManageFilters] = useState({ date: new Date().toISOString().split('T')[0], dept: '', year: '', course: '' });
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const TIME_SLOTS = [
        "9-10AM", "10-11AM", "11-12PM", "12-1PM",
        "1-2PM", "2-3PM", "3-4PM", "4-5PM", "5-6PM"
    ];

    // Fetch Data
    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/admin/students/all');
            if (res.ok) setStudents(await res.json());
        } catch (error) { console.error('Failed to fetch students', error); }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/admin/config');
            if (res.ok) setConfig(await res.json() || { attendanceRequirement: 70, attendanceRules: {}, teacherAssignments: {} });
        } catch (error) { console.error('Failed to fetch config', error); }
    };

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (user) {
            try {
                const parsed = JSON.parse(user);
                setAdminEmail(parsed.email || null);
            } catch (e) { console.error(e); }
        }
        fetchConfig();
        fetchStudents();
    }, []);

    // Derived Lists
    const { departments, years, courses } = useMemo(() => {
        const depts = new Set<string>();
        const yrs = new Set<string>();
        const crs = new Set<string>();
        students.forEach(s => {
            if (s.department) depts.add(s.department);
            if (s.year) yrs.add(s.year);
            if (s.course_code) crs.add(s.course_code);
        });
        return {
            departments: Array.from(depts).sort(),
            years: Array.from(yrs).sort(),
            courses: Array.from(crs).sort()
        };
    }, [students]);

    // Access Control & Filtering
    const visibleStudents = useMemo(() => {
        if (!adminEmail) return students;
        const assignedKeys = Object.entries(config.teacherAssignments || {}).filter(([key, teachers]: [string, any]) => {
            return Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === adminEmail.toLowerCase());
        }).map(([key]) => key);

        if (assignedKeys.length === 0) return students; // Fallback

        return students.filter(s => {
            const key = `${s.department}_${s.year}_${s.course_code}`;
            return assignedKeys.includes(key);
        });
    }, [students, config, adminEmail]);

    // Filtered Students for Attendance Table
    const tableStudents = useMemo(() => {
        if (!filters.dept || !filters.year || !filters.course) return [];
        return visibleStudents.filter(s =>
            s.department === filters.dept &&
            s.year === filters.year &&
            s.course_code === filters.course
        ).sort((a, b) => (a.roll || '').localeCompare(b.roll || ''));
    }, [visibleStudents, filters]);

    // Initialize Checkboxes
    useEffect(() => {
        if (tableStudents.length > 0 && !editingRecordId) {
            const initial: Record<string, boolean> = {};
            tableStudents.forEach(s => initial[s._id] = true);
            setAttendanceData(initial);
            setSelectAll(true);
        }
    }, [tableStudents, editingRecordId]);

    // Available Teachers for Selected Group
    const availableTeachers = useMemo(() => {
        if (!filters.dept || !filters.year || !filters.course) return [];
        const key = `${filters.dept}_${filters.year}_${filters.course}`;
        return config.teacherAssignments?.[key] || [];
    }, [config, filters]);

    // Auto-select logged-in teacher
    useEffect(() => {
        if (availableTeachers.length > 0 && adminEmail && !editingRecordId) {
            const me = availableTeachers.find((t: any) => t.email?.toLowerCase() === adminEmail.toLowerCase());
            if (me) {
                setSelectedTeacher(JSON.stringify(me));
            } else {
                setSelectedTeacher(''); // Not assigned to this course
            }
        }
    }, [availableTeachers, adminEmail, editingRecordId]);

    // Handlers
    const handleSelectAll = () => {
        const newVal = !selectAll;
        setSelectAll(newVal);
        const updated: Record<string, boolean> = {};
        tableStudents.forEach(s => updated[s._id] = newVal);
        setAttendanceData(updated);
    };

    const toggleStudent = (id: string) => {
        setAttendanceData(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleEditRecord = (record: any) => {
        setEditingRecordId(record._id);
        setDate(record.date);
        setFilters({ dept: record.department, year: record.year, course: record.course_code });

        const teacherObj = { name: record.teacherName, email: record.teacherEmail };
        setSelectedTeacher(JSON.stringify(teacherObj));

        setSelectedTimeSlots([record.timeSlot]);

        const attData: Record<string, boolean> = {};
        if (record.presentStudentIds && Array.isArray(record.presentStudentIds)) {
            record.presentStudentIds.forEach((id: string) => attData[id] = true);
        }
        setAttendanceData(attData);

        setActiveTab('take');
    };

    const handleSaveAttendance = async () => {
        if (!date || !selectedTeacher || selectedTimeSlots.length === 0 || tableStudents.length === 0) {
            alert('Please fill all fields and ensure students are listed.');
            return;
        }

        const action = editingRecordId ? 'Update' : 'Save';
        if (!confirm(`${action} attendance for ${selectedTimeSlots.length} slot(s)?`)) return;

        setLoading(true);
        try {
            const presentIds = tableStudents.filter(s => attendanceData[s._id]).map(s => s._id);
            const absentIds = tableStudents.filter(s => !attendanceData[s._id]).map(s => s._id);

            let teacherName = '';
            let teacherEmail = '';

            if (typeof selectedTeacher === 'string') {
                try {
                    const parsed = JSON.parse(selectedTeacher);
                    teacherName = parsed.name;
                    teacherEmail = parsed.email;
                } catch (e) {
                    teacherName = selectedTeacher; // Fallback
                }
            } else if (typeof selectedTeacher === 'object') {
                teacherName = (selectedTeacher as any).name;
                teacherEmail = (selectedTeacher as any).email;
            }

            const payload = {
                date,
                teacherName,
                teacherEmail,
                department: filters.dept,
                year: filters.year,
                course_code: filters.course,
                timeSlot: selectedTimeSlots[0],
                presentStudentIds: presentIds,
                absentStudentIds: absentIds
            };

            let res;
            if (editingRecordId) {
                res = await fetch(`/api/admin/attendance/${editingRecordId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                const records = selectedTimeSlots.map(slot => ({
                    ...payload,
                    timeSlot: slot
                }));
                res = await fetch('/api/admin/attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ records })
                });
            }

            if (!res.ok) throw new Error(`Failed to ${action.toLowerCase()}`);

            alert(`Attendance ${action.toLowerCase()}d successfully!`);

            if (editingRecordId) {
                setEditingRecordId(null);
                setActiveTab('manage');
                handleSearchRecords();
            } else {
                setSelectedTimeSlots([]);
            }
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingRecordId(null);
        setActiveTab('manage');
        setSelectedTimeSlots([]);
        setAttendanceData({});
    };

    const handleSearchRecords = async () => {
        if (!manageFilters.date || !manageFilters.dept || !manageFilters.year || !manageFilters.course) {
            alert('Please select all filters.');
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams(manageFilters);
            const res = await fetch(`/api/admin/attendance?${params}`);
            if (res.ok) {
                setSearchResults(await res.json());
                setHasSearched(true);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm('Delete this record?')) return;
        try {
            const res = await fetch(`/api/admin/attendance/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setSearchResults(prev => prev.filter(r => r._id !== id));
            }
        } catch (error) { console.error(error); }
    };

    const handleDeleteAllFiltered = async () => {
        if (searchResults.length === 0) return;
        if (!confirm(`Delete ALL ${searchResults.length} records? This cannot be undone.`)) return;

        setLoading(true);
        try {
            const ids = searchResults.map(r => r._id);
            const res = await fetch('/api/admin/attendance', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (res.ok) {
                setSearchResults([]);
                alert('All records deleted.');
            }
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Attendance Management</h1>
                    <InstallPWA type="admin" />
                </div>
                {adminEmail && <div className="text-sm text-gray-400">Logged in as: <span className="text-blue-400 font-semibold">{JSON.parse(localStorage.getItem('user') || '{}').name}</span></div>}
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 rounded-xl bg-gray-800 p-1 mb-6 max-w-md">
                <button
                    onClick={() => { setActiveTab('take'); setEditingRecordId(null); }}
                    className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all ${activeTab === 'take' ? 'bg-white text-blue-700 shadow' : 'text-gray-400 hover:text-white hover:bg-white/[0.12]'
                        }`}
                >
                    {editingRecordId ? 'Edit Record' : 'Take Attendance'}
                </button>
                <button
                    onClick={() => { setActiveTab('manage'); setEditingRecordId(null); }}
                    className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all ${activeTab === 'manage' ? 'bg-white text-blue-700 shadow' : 'text-gray-400 hover:text-white hover:bg-white/[0.12]'
                        }`}
                >
                    Manage Records
                </button>
            </div>

            {/* TAKE ATTENDANCE TAB */}
            {activeTab === 'take' && (
                <div className="animate-fade-in">
                    {editingRecordId && (
                        <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-lg mb-6 flex justify-between items-center">
                            <span className="text-blue-300 font-medium">Editing Record: {date} - {filters.dept} {filters.year} {filters.course}</span>
                            <button onClick={handleCancelEdit} className="text-sm text-gray-400 hover:text-white underline">Cancel Edit</button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {/* Date */}
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <label className="block text-sm font-medium text-gray-300 mb-2">1. Select Date</label>
                            <input
                                type="date"
                                className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                disabled={!!editingRecordId}
                            />
                        </div>

                        {/* Group Filters */}
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 md:col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-2">2. Select Student Group</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <select
                                    className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={filters.dept} onChange={e => setFilters({ ...filters, dept: e.target.value })}
                                    disabled={!!editingRecordId}
                                >
                                    <option value="">Select Dept</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select
                                    className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={filters.year} onChange={e => setFilters({ ...filters, year: e.target.value })}
                                    disabled={!!editingRecordId}
                                >
                                    <option value="">Select Year</option>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <select
                                    className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={filters.course} onChange={e => setFilters({ ...filters, course: e.target.value })}
                                    disabled={!!editingRecordId}
                                >
                                    <option value="">Select Course</option>
                                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Teacher Display (Auto-selected) */}
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <label className="block text-sm font-medium text-gray-300 mb-2">3. Faculty</label>
                            <div className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600">
                                {selectedTeacher ? (
                                    <span>
                                        {typeof selectedTeacher === 'string' ? JSON.parse(selectedTeacher).name : (selectedTeacher as any).name}
                                        <span className="text-gray-400 text-xs ml-2">
                                            ({typeof selectedTeacher === 'string' ? JSON.parse(selectedTeacher).email : (selectedTeacher as any).email})
                                        </span>
                                    </span>
                                ) : (
                                    <span className="text-gray-500 italic">
                                        {filters.course ? 'You are not assigned to this course.' : 'Select Group First'}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Time Slots (Multi-select) */}
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <label className="block text-sm font-medium text-gray-300 mb-2">4. Select Time Slots</label>
                            <div className="flex flex-wrap gap-2">
                                {TIME_SLOTS.map(slot => (
                                    <button
                                        key={slot}
                                        onClick={() => {
                                            if (editingRecordId) return;
                                            setSelectedTimeSlots(prev =>
                                                prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
                                            );
                                        }}
                                        disabled={!!editingRecordId}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${selectedTimeSlots.includes(slot)
                                            ? 'bg-blue-600 text-white border-blue-500'
                                            : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                                            } ${editingRecordId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Student List */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden mb-6">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-white">5. Mark Attendance ({tableStudents.length})</h3>
                            <button onClick={handleSelectAll} className="text-sm text-blue-400 hover:text-blue-300">
                                {selectAll ? 'Unselect All' : 'Select All'}
                            </button>
                        </div>
                        <div className="overflow-x-auto max-h-96">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left w-16">
                                            <input
                                                type="checkbox"
                                                checked={selectAll}
                                                onChange={handleSelectAll}
                                                className="rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Roll</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700 bg-gray-800">
                                    {tableStudents.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-8 text-gray-500">Select a valid group to see students.</td></tr>
                                    ) : (
                                        tableStudents.map(s => (
                                            <tr key={s._id} className="hover:bg-gray-700/50" onClick={() => toggleStudent(s._id)}>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!attendanceData[s._id]}
                                                        onChange={() => toggleStudent(s._id)}
                                                        className="rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500"
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-sm text-white font-medium">{s.name}</td>
                                                <td className="px-4 py-3 text-sm text-gray-400">{s.roll}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    {attendanceData[s._id] ? (
                                                        <span className="inline-flex items-center rounded-md bg-green-400/10 px-2 py-1 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-400/20">Present</span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-400/20">Absent</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveAttendance}
                        disabled={loading || tableStudents.length === 0}
                        className="w-full rounded-md bg-green-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                        {editingRecordId ? 'Update Attendance' : 'Save Attendance'}
                    </button>
                </div>
            )}

            {/* MANAGE RECORDS TAB */}
            {activeTab === 'manage' && (
                <div className="animate-fade-in">
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Search Existing Records</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
                                <input
                                    type="date"
                                    className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={manageFilters.date}
                                    onChange={e => setManageFilters({ ...manageFilters, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Department</label>
                                <select
                                    className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={manageFilters.dept} onChange={e => setManageFilters({ ...manageFilters, dept: e.target.value })}
                                >
                                    <option value="">Select Dept</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Year</label>
                                <select
                                    className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={manageFilters.year} onChange={e => setManageFilters({ ...manageFilters, year: e.target.value })}
                                >
                                    <option value="">Select Year</option>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Course</label>
                                <select
                                    className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={manageFilters.course} onChange={e => setManageFilters({ ...manageFilters, course: e.target.value })}
                                >
                                    <option value="">Select Course</option>
                                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={handleSearchRecords}
                            disabled={loading}
                            className="mt-4 w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-6 rounded-md transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                            Find Records
                        </button>
                    </div>

                    {hasSearched && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white">Found Records ({searchResults.length})</h3>
                                {searchResults.length > 0 && (
                                    <button
                                        onClick={handleDeleteAllFiltered}
                                        className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold py-2 px-4 rounded-md flex items-center gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" /> Delete ALL Shown
                                    </button>
                                )}
                            </div>

                            {searchResults.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
                                    No attendance records found for this criteria.
                                </div>
                            ) : (
                                <div className="overflow-hidden bg-gray-800 shadow sm:rounded-md border border-gray-700">
                                    <ul className="divide-y divide-gray-700">
                                        {searchResults.map(record => (
                                            <li key={record._id}>
                                                <div className="px-4 py-4 sm:px-6 flex items-center justify-between hover:bg-gray-700/50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="bg-blue-900/50 p-2 rounded-lg border border-blue-700/50 min-w-[80px]">
                                                            <span className="text-blue-400 font-bold block text-center text-xs uppercase">Time Slot</span>
                                                            <span className="text-white font-bold block text-center">{record.timeSlot}</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-blue-400 truncate">{record.teacherName}</p>
                                                            <p className="mt-1 flex items-center text-sm text-gray-400">
                                                                <span className="truncate">
                                                                    Present: {record.presentStudentIds?.length || 0} | Absent: {record.absentStudentIds?.length || 0}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 ml-4 gap-2">
                                                        <button
                                                            onClick={() => handleEditRecord(record)}
                                                            className="rounded-md bg-blue-900/30 px-3 py-2 text-xs font-semibold text-blue-400 ring-1 ring-inset ring-blue-700/50 hover:bg-blue-900/70 transition-all"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRecord(record._id)}
                                                            className="rounded-md bg-red-900/30 px-3 py-2 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-700/50 hover:bg-red-900/70 transition-all"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
