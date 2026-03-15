'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, FileQuestion, ClipboardCheck, LayoutDashboard, CreditCard, PenTool, Shield, UserPlus, Trash2, Loader2, Phone, MessageCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Staff {
    _id: string;
    name: string;
    phoneNumber: string;
    role: string;
    createdAt: string;
}

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalQuestions: 0,
        activeTests: 0,
        unreadChats: 0,
    });
    const [loading, setLoading] = useState(true);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [staffLoading, setStaffLoading] = useState(true);
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);

    // Add Staff Form
    const [newStaff, setNewStaff] = useState({ name: '', phoneNumber: '', role: 'manager' });
    const [addingStaff, setAddingStaff] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            fetchDashboard();
        }
    }, []);

    const fetchDashboard = async () => {
        try {
            const res = await fetch('/api/admin/dashboard');
            
            let unreadCount = 0;
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                
                const chatRes = await fetch('/api/chat/batches', { headers });
                if (chatRes.ok) {
                    const chatData = await chatRes.json();
                    unreadCount = chatData.batches?.filter((b: any) => b.hasUnread).length || 0;
                }
            } catch (e) {
                console.error('Error fetching chat stats', e);
            }

            if (res.ok) {
                const data = await res.json();
                setStats({
                    totalStudents: data.totalStudents,
                    totalQuestions: data.totalQuestions,
                    activeTests: data.activeTests,
                    unreadChats: unreadCount,
                });
                setStaffList(data.staff || []);
            }
        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setLoading(false);
            setStaffLoading(false);
        }
    };

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingStaff(true);
        try {
            const res = await fetch('/api/admin/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newStaff)
            });
            const data = await res.json();

            if (res.ok) {
                toast.success(`${newStaff.role === 'manager' ? 'Manager' : 'Copy Checker'} added successfully`);
                setNewStaff({ name: '', phoneNumber: '', role: 'manager' });
                setShowAddStaffModal(false);
                fetchDashboard();
            } else {
                toast.error(data.error || 'Failed to add staff');
            }
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setAddingStaff(false);
        }
    };

    const handleDeleteStaff = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to remove ${name}?`)) return;
        try {
            const res = await fetch(`/api/admin/staff?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Staff removed successfully');
                fetchDashboard();
            } else {
                toast.error('Failed to remove staff');
            }
        } catch (error) {
            toast.error('Something went wrong');
        }
    };

    const statCards = [
        {
            title: 'Chat',
            value: stats.unreadChats,
            icon: MessageCircle,
            gradient: stats.unreadChats > 0 ? 'from-red-500 to-rose-600' : 'from-slate-600 to-slate-700',
            href: '/admin/chat',
            badge: stats.unreadChats > 0 ? `${stats.unreadChats} new` : null
        },
        {
            title: 'Students',
            value: stats.totalStudents,
            icon: Users,
            gradient: 'from-blue-500 to-cyan-500',
            href: null,
        },
        {
            title: 'Questions',
            value: stats.totalQuestions,
            icon: FileQuestion,
            gradient: 'from-purple-500 to-violet-500',
            href: '/admin/questions',
        },
        {
            title: 'Tests',
            value: stats.activeTests,
            icon: ClipboardCheck,
            gradient: 'from-emerald-500 to-teal-500',
            href: '/admin/online-tests',
        },
    ];

    return (
        <div className="space-y-4 sm:space-y-6 pb-12">
            <Toaster position="top-center" />

            {/* Page Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400">
                    Dashboard
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">Welcome back! Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    const isClickable = !!stat.href;
                    return (
                        <div
                            key={index}
                            onClick={() => isClickable && router.push(stat.href!)}
                            className={`bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-5 transition-all duration-300 relative group overflow-hidden ${isClickable
                                ? 'hover:border-white/20 cursor-pointer hover:shadow-lg'
                                : ''
                                }`}
                        >
                            {/* Accent Glow */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity`} />
                            
                            <div className="flex justify-between items-start mb-2 sm:mb-4 relative z-10">
                                <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg shadow-black/20 text-white shrink-0`}>
                                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                                </div>
                                {stat.badge && (
                                    <span className="bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md animate-pulse">
                                        {stat.badge}
                                    </span>
                                )}
                            </div>

                            <div className="relative z-10 flex flex-col justify-end min-h-[40px] sm:min-h-[50px]">
                                <h3 className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{stat.title}</h3>

                                {loading ? (
                                    <div className="h-6 w-12 bg-white/5 rounded animate-pulse mt-1"></div>
                                ) : (
                                    <p className="text-lg sm:text-2xl lg:text-3xl font-black text-white leading-none">
                                        {stat.value.toLocaleString()}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

                {/* Quick Actions - Spans 2 cols */}
                <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 h-fit">
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h2 className="text-lg sm:text-xl font-bold text-white">Quick Actions</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                        <button
                            onClick={() => router.push('/admin/online-tests/create')}
                            className="p-3 bg-slate-800/50 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all text-left group"
                        >
                            <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 mb-1.5 group-hover:scale-110 transition-transform" />
                            <p className="text-[11px] sm:text-sm font-bold text-white leading-tight">Create<br/>Test</p>
                        </button>

                        <button
                            onClick={() => router.push('/admin/assignments/create')}
                            className="p-3 bg-slate-800/50 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 rounded-xl transition-all text-left group"
                        >
                            <PenTool className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 mb-1.5 group-hover:scale-110 transition-transform" />
                            <p className="text-[11px] sm:text-sm font-bold text-white leading-tight">Create<br/>Assign.</p>
                        </button>

                        <button
                            onClick={() => router.push('/admin/fees?tab=record')}
                            className="p-3 bg-slate-800/50 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/30 rounded-xl transition-all text-left group"
                        >
                            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400 mb-1.5 group-hover:scale-110 transition-transform" />
                            <p className="text-[11px] sm:text-sm font-bold text-white leading-tight">Fees<br/>Grid</p>
                        </button>

                        <button
                            onClick={() => router.push('/admin/questions')}
                            className="p-3 bg-slate-800/50 hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/30 rounded-xl transition-all text-left group"
                        >
                            <FileQuestion className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400 mb-1.5 group-hover:scale-110 transition-transform" />
                            <p className="text-[11px] sm:text-sm font-bold text-white leading-tight">Add<br/>Questions</p>
                        </button>
                    </div>
                </div>

                {/* Staff Management - Spans 1 col */}
                <div className="bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-indigo-400" /> Staff Access
                        </h2>
                        <button
                            onClick={() => setShowAddStaffModal(true)}
                            className="p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 transition-colors"
                        >
                            <UserPlus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-2 custom-scrollbar">
                        {staffLoading ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
                        ) : staffList.length === 0 ? (
                            <p className="text-center text-gray-500 text-sm py-4">No staff members added.</p>
                        ) : (
                            staffList.map(staff => (
                                <div key={staff._id} className="bg-white/5 rounded-xl p-3 flex justify-between items-center group hover:bg-white/10 transition-colors">
                                    <div>
                                        <p className="font-semibold text-white text-sm">{staff.name}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                            <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[10px] ${staff.role === 'manager' ? 'bg-amber-500/20 text-amber-400' : 'bg-pink-500/20 text-pink-400'
                                                }`}>
                                                {staff.role === 'manager' ? 'Manager' : 'Checker'}
                                            </span>
                                            <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" /> {staff.phoneNumber}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteStaff(staff._id, staff.name)}
                                        className="p-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Add Staff Modal */}
            {showAddStaffModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-white mb-4">Add Staff Member</h2>
                        <form onSubmit={handleAddStaff} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Role</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewStaff({ ...newStaff, role: 'manager' })}
                                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${newStaff.role === 'manager'
                                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        Manager
                                        <span className="block text-[10px] font-normal opacity-70 mt-1">Fees Access Only</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewStaff({ ...newStaff, role: 'copy_checker' })}
                                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${newStaff.role === 'copy_checker'
                                            ? 'bg-pink-500/20 border-pink-500/50 text-pink-400'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        Copy Checker
                                        <span className="block text-[10px] font-normal opacity-70 mt-1">Assignments Only</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newStaff.name}
                                    onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                    placeholder="e.g. John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    required
                                    value={newStaff.phoneNumber}
                                    onChange={e => setNewStaff({ ...newStaff, phoneNumber: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                    placeholder="e.g. 9876543210"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">This will be used as the login password.</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddStaffModal(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 text-sm font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addingStaff}
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {addingStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Add Member
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
