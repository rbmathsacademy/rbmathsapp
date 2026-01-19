'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { Folder as FolderIcon, ChevronRight, FileText, ArrowLeft, LogOut, LayoutGrid, Bookmark } from 'lucide-react';

interface Folder {
    _id: string;
    name: string;
    createdAt: string;
}

interface Question {
    _id: string;
    text: string;
    type: string;
    topic: string;
    subtopic: string;
}

export default function StudentDashboard() {
    const router = useRouter();
    const [student, setStudent] = useState<any>(null);
    const [activeCourse, setActiveCourse] = useState<string | null>(null);
    const [folders, setFolders] = useState<Folder[]>([]);


    const [loadingCourses, setLoadingCourses] = useState(true);
    const [loadingFolders, setLoadingFolders] = useState(false);


    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        if (activeCourse) {
            fetchFolders(activeCourse);
        }
    }, [activeCourse]);



    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/student/me');
            if (!res.ok) throw new Error('Unauthorized');
            const data = await res.json();
            setStudent(data);
            // Auto-select removed to let user choose
        } catch (error) {
            router.push('/student/login');
        } finally {
            setLoadingCourses(false);
        }
    };

    const fetchFolders = async (course: string) => {
        setLoadingFolders(true);
        try {
            const res = await fetch(`/api/student/data?course=${encodeURIComponent(course)}`);
            const data = await res.json();
            setFolders(data.folders || []);
        } catch (e) {
            toast.error('Failed to load course content');
        } finally {
            setLoadingFolders(false);
        }
    };



    const handleLogout = () => {
        // Clear cookie by calling a logout endpoint or just deleting checking
        // Client side cookie deletion is tricky if httpOnly.
        // Best to use an API route or just rely on session expiry for now, but user expects logout.
        // I'll make a simple logout logic: redirect to login and let page handle cleanup if possible?
        // Actually, I should delete the cookie.
        document.cookie = 'auth_token=; Max-Age=0; path=/;';
        router.push('/student/login');
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    if (loadingCourses) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse"></div>
                <div className="text-blue-400 animate-pulse text-xl font-medium relative z-10">Loading your portal...</div>
            </div>
        );
    }

    if (!student) return null;

    return (
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 relative overflow-hidden selection:bg-blue-500/30 pb-20">
            <Toaster position="top-center" />

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Header / Navbar - Compact */}
            <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#050b14]/70 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 text-sm">
                            {student.studentName?.[0] || 'S'}
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white leading-none">Student<span className="text-blue-400">Portal</span></h1>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6 relative z-10">
                {/* Greeting Section - Compact */}
                <div className="mb-6 flex items-end justify-between animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div>
                        <p className="text-xs text-slate-400 font-medium tracking-wide uppercase mb-1">{getGreeting()}</p>
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400">
                            {student?.studentName?.split(' ')[0] || 'Student'}
                        </h2>
                    </div>
                    <button
                        onClick={() => router.push('/student/bookmarks')}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 hover:border-amber-500/50 transition-all group active:scale-95"
                    >
                        <Bookmark className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform mb-1" />
                        <span className="text-[10px] font-bold text-amber-500/80">Saved</span>
                    </button>
                </div>


                {!activeCourse ? (
                    // Course Selection View
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                        <h2 className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-4">Your Courses</h2>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {student?.courses?.map((course: string, idx: number) => (
                                <button
                                    key={course}
                                    onClick={() => setActiveCourse(course)}
                                    className="group relative overflow-hidden bg-slate-900/60 backdrop-blur-md border border-white/5 p-4 rounded-2xl hover:border-blue-500/50 transition-all duration-300 active:scale-95 text-left h-32 flex flex-col justify-between"
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                >
                                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <FolderIcon className="h-16 w-16 -mr-6 -mt-6 rotate-12" />
                                    </div>

                                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-lg">
                                        {course.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">{course}</h3>
                                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                            Open <ChevronRight className="h-2 w-2" />
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    // Folder Grid View
                    <div className="animate-in fade-in duration-500">
                        <button
                            onClick={() => setActiveCourse(null)}
                            className="flex items-center text-slate-400 hover:text-white transition-colors mb-4 text-xs font-medium"
                        >
                            <ArrowLeft className="h-3 w-3 mr-1" /> Back to Courses
                        </button>

                        <div className="flex items-center gap-2 mb-6">
                            <h2 className="text-xl font-bold text-white truncate">{activeCourse}</h2>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 uppercase">
                                Active
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {loadingFolders ? (
                                <div className="col-span-full py-10 text-center">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    <p className="text-xs text-slate-500">Loading...</p>
                                </div>
                            ) : folders.length === 0 ? (
                                <div className="col-span-full bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
                                    <FolderIcon className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400 font-medium">No content yet</p>
                                </div>
                            ) : (
                                folders.map((folder, idx) => (
                                    <div
                                        key={folder._id}
                                        onClick={() => router.push(`/student/resources/${folder._id}`)}
                                        className="group bg-[#0f172a]/60 backdrop-blur-sm border border-white/5 hover:border-blue-500/50 p-4 rounded-2xl cursor-pointer transition-all duration-300 hover:bg-[#0f172a] active:scale-95 relative overflow-hidden flex flex-col items-center text-center gap-3 aspect-square justify-center shadow-lg shadow-black/20"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                    >
                                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-inner shadow-blue-500/20">
                                            <FolderIcon className="h-5 w-5" />
                                        </div>

                                        <div className="w-full">
                                            <h3 className="text-xs font-bold text-slate-200 mb-1 line-clamp-2 leading-relaxed group-hover:text-blue-300 transition-colors">{folder.name}</h3>
                                            <p className="text-[10px] text-slate-500 font-medium">
                                                {new Date(folder.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );

}
