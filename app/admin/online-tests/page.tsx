'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Send, FileText, Clock, Users, Search, Filter, FolderInput, Eye } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import FolderSidebar from './components/FolderSidebar';

interface OnlineTest {
    _id: string;
    title: string;
    description: string;
    questions: any[];
    status: 'draft' | 'deployed' | 'completed';
    totalMarks: number;
    folderId?: string | null;
    deployment?: {
        batches: string[];
        startTime: Date;
        endTime: Date;
        durationMinutes: number;
    };
    createdAt: string;
    updatedAt: string;
}

interface Folder {
    _id: string;
    name: string;
    type: string;
    createdAt: string;
}

export default function OnlineTestsPage() {
    const router = useRouter();
    const [tests, setTests] = useState<OnlineTest[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'deployed' | 'completed'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [movingTest, setMovingTest] = useState<string | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserEmail(user.email);
        }
    }, []);

    useEffect(() => {
        if (userEmail) {
            fetchTests();
            fetchFolders();
        }
    }, [userEmail, filter, selectedFolder]);

    const fetchTests = async () => {
        try {
            setLoading(true);
            let url = '/api/admin/online-tests';
            const params = new URLSearchParams();

            if (filter !== 'all') {
                params.append('status', filter);
            }
            // Only add folderId param when a folder is actively selected (not viewing all tests)
            if (selectedFolder !== null) {
                params.append('folderId', selectedFolder);
            }

            if (params.toString()) {
                url += '?' + params.toString();
            }

            console.log('🔍 Fetching tests - Selected folder:', selectedFolder, 'URL:', url);

            const res = await fetch(url, {
                headers: { 'X-User-Email': userEmail! }
            });

            if (res.ok) {
                const data = await res.json();
                console.log('📦 Fetched', data.length, 'tests');
                setTests(data);
            } else {
                toast.error('Failed to load tests');
            }
        } catch (error) {
            toast.error('Error loading tests');
        } finally {
            setLoading(false);
        }
    };

    const fetchFolders = async () => {
        try {
            const res = await fetch('/api/admin/online-tests/folders', {
                headers: { 'X-User-Email': userEmail! }
            });

            if (res.ok) {
                const data = await res.json();
                setFolders(data);
            }
        } catch (error) {
            console.error('Error loading folders:', error);
        }
    };

    const moveTestToFolder = async (testId: string, folderId: string | null) => {
        try {
            console.log('🔧 Moving test:', testId, 'to folder:', folderId);

            const res = await fetch('/api/admin/online-tests', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail!
                },
                body: JSON.stringify({ id: testId, folderId })
            });

            console.log('📡 Response status:', res.status);

            if (res.ok) {
                const data = await res.json();
                console.log('✅ Response data:', data);
                toast.success('Test moved successfully');
                fetchTests();
                setMovingTest(null);
            } else {
                const errorData = await res.json();
                console.error('❌ Error response:', errorData);
                toast.error('Failed to move test');
            }
        } catch (error) {
            console.error('❌ Exception:', error);
            toast.error('Error moving test');
        }
    };

    const deleteTest = async (id: string) => {
        if (!confirm('Are you sure you want to delete this test?')) return;

        try {
            const res = await fetch(`/api/admin/online-tests?id=${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': userEmail! }
            });

            if (res.ok) {
                toast.success('Test deleted successfully');
                fetchTests();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to delete test');
            }
        } catch (error) {
            toast.error('Error deleting test');
        }
    };

    const filteredTests = tests.filter(test =>
        test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
            case 'deployed': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            case 'completed': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
        }
    };

    return (
        <div className="space-y-6">
            <Toaster />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                        Online Tests Management
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Create and manage online tests for students</p>
                </div>
                <button
                    onClick={() => router.push('/admin/online-tests/create')}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                    <Plus className="h-5 w-5" />
                    Create New Test
                </button>
            </div>

            {/* Main Content with Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Folder Sidebar */}
                <div className="lg:col-span-1">
                    <FolderSidebar
                        folders={folders}
                        selectedFolder={selectedFolder}
                        onSelectFolder={setSelectedFolder}
                        onFolderChange={fetchFolders}
                        userEmail={userEmail || ''}
                    />
                </div>

                {/* Tests Content */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">\
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search tests..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                        <div className="flex gap-2">
                            {['all', 'draft', 'deployed', 'completed'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilter(status as any)}
                                    className={`px-4 py-2.5 rounded-xl font-medium capitalize transition-all ${filter === status
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                        : 'bg-slate-900/60 text-slate-400 border border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tests Grid */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 animate-pulse">
                                    <div className="h-6 bg-white/5 rounded mb-4"></div>
                                    <div className="h-4 bg-white/5 rounded mb-2"></div>
                                    <div className="h-4 bg-white/5 rounded w-2/3"></div>
                                </div>
                            ))}
                        </div>
                    ) : filteredTests.length === 0 ? (
                        <div className="text-center py-20">
                            <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No tests found</h3>
                            <p className="text-slate-400 mb-6">
                                {searchQuery ? 'Try a different search term' : 'Create your first online test to get started'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={() => router.push('/admin/online-tests/create')}
                                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all"
                                >
                                    Create Test
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTests.map(test => (
                                <div
                                    key={test._id}
                                    className="bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 transition-all group"
                                >
                                    {/* Status Badge */}
                                    <div className="flex items-center justify-between mb-4">
                                        <span className={`text-xs px-3 py-1 rounded-full font-bold border ${getStatusColor(test.status)} uppercase`}>
                                            {test.status}
                                        </span>
                                        <div className="flex gap-2">
                                            {test.status === 'draft' && (
                                                <>
                                                    <button
                                                        onClick={() => router.push(`/admin/online-tests/create?id=${test._id}`)}
                                                        className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => router.push(`/admin/online-tests/deploy/${test._id}`)}
                                                        className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                                        title="Deploy"
                                                    >
                                                        <Send className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}

                                            {test.status === 'deployed' && (
                                                <>
                                                    <button
                                                        onClick={() => router.push(`/admin/online-tests/create?id=${test._id}`)}
                                                        className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                                        title="Edit Questions & Content"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => router.push(`/admin/online-tests/deploy/${test._id}`)}
                                                        className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                                                        title="Edit Deployment"
                                                    >
                                                        <Send className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => router.push(`/admin/online-tests/monitor/${test._id}`)}
                                                        className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                                        title="Monitor Test"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}

                                            {/* Move to Folder - Available for all tests */}
                                            <div className="relative">
                                                <button
                                                    onClick={() => setMovingTest(movingTest === test._id ? null : test._id)}
                                                    className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                                                    title="Move to Folder"
                                                >
                                                    <FolderInput className="h-4 w-4" />
                                                </button>
                                                {movingTest === test._id && (
                                                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-10 p-2">
                                                        <button
                                                            onClick={() => moveTestToFolder(test._id, null)}
                                                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded"
                                                        >
                                                            📂 Root (No Folder)
                                                        </button>
                                                        {folders.map(folder => (
                                                            <button
                                                                key={folder._id}
                                                                onClick={() => moveTestToFolder(test._id, folder._id)}
                                                                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded"
                                                            >
                                                                📁 {folder.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Delete - Available for all tests */}
                                            <button
                                                onClick={() => deleteTest(test._id)}
                                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Title & Description */}
                                    <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{test.title}</h3>
                                    {test.description && (
                                        <p className="text-sm text-slate-400 mb-4 line-clamp-2">{test.description}</p>
                                    )}

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-white/5 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText className="h-4 w-4 text-slate-400" />
                                                <span className="text-xs text-slate-400">Questions</span>
                                            </div>
                                            <p className="text-xl font-bold text-white">{test.questions?.length || 0}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Clock className="h-4 w-4 text-slate-400" />
                                                <span className="text-xs text-slate-400">Marks</span>
                                            </div>
                                            <p className="text-xl font-bold text-white">{test.totalMarks || 0}</p>
                                        </div>
                                    </div>

                                    {/* Deployment Info */}
                                    {test.status === 'deployed' && test.deployment && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Users className="h-4 w-4 text-emerald-400" />
                                                <span className="text-emerald-300 font-medium text-xs">
                                                    {test.deployment.batches && test.deployment.batches.length > 0
                                                        ? test.deployment.batches.join(', ')
                                                        : 'No batches'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Clock className="h-3 w-3" />
                                                <span className="text-xs">
                                                    {test.deployment.durationMinutes} min
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer */}
                                    <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-500">
                                        {test.status === 'deployed' && test.deployment?.startTime && test.deployment?.endTime ? (
                                            <div className="space-y-1">
                                                <div>📅 Start: {new Date(test.deployment.startTime).toLocaleString('en-IN', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short'
                                                })}</div>
                                                <div>📅 End: {new Date(test.deployment.endTime).toLocaleString('en-IN', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short'
                                                })}</div>
                                            </div>
                                        ) : (
                                            <div>Created {new Date(test.createdAt).toLocaleDateString()}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
