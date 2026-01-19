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
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 relative overflow-hidden selection:bg-blue-500/30">
            <Toaster position="top-center" />

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-purple-600/5 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* Header / Navbar */}
            <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#050b14]/70">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                            {student.studentName?.[0] || 'S'}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white leading-none tracking-tight">Student<span className="text-blue-400">Portal</span></h1>
                            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-1">RB Maths Academy</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="group flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all duration-300"
                    >
                        <span className="text-sm font-medium hidden sm:block">Logout</span>
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
                {/* Greeting Section */}
                <div className="mb-8 md:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-2xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400 mb-2">
                        {getGreeting()}, <br className="sm:hidden" /> {student?.studentName?.split(' ')[0] || 'Student'}
                    </h2>
                    <p className="text-slate-400 text-sm md:text-lg">Ready to continue your learning journey?</p>
                </div>

                {/* Bookmarks Section */}
                <div className="mb-8 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-75">
                    <button
                        onClick={() => router.push('/student/bookmarks')}
                        className="w-full sm:w-auto group relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-900/40 to-amber-900/40 border border-amber-500/20 p-4 md:p-6 flex items-center gap-4 hover:border-amber-500/50 transition-all hover:shadow-2xl hover:shadow-amber-900/20"
                    >
                        <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors"></div>
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                            <Bookmark className="h-5 w-5 md:h-6 md:w-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="text-base md:text-lg font-bold text-white group-hover:text-amber-200 transition-colors">My Bookmarks</h3>
                            <p className="text-xs md:text-sm text-amber-200/60">Review your saved questions</p>
                        </div>
                        <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-amber-500/50 ml-auto group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {!activeCourse ? (
                    // Course Selection View
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        <h2 className="text-xl text-slate-400 font-medium mb-6">Select a Course</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {student?.courses?.map((course: string, idx: number) => (
                                <button
                                    key={course}
                                    onClick={() => setActiveCourse(course)}
                                    className="group relative overflow-hidden bg-slate-900 border border-white/5 p-4 md:p-6 rounded-3xl hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 text-left"
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <FolderIcon className="h-16 w-16 md:h-24 md:w-24 -mr-6 -mt-6 md:-mr-8 md:-mt-8 rotate-12" />
                                    </div>

                                    <div className="relative z-10">
                                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-base md:text-lg mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                            {course.charAt(0)}
                                        </div>
                                        <h3 className="text-lg md:text-xl font-bold text-white mb-2">{course}</h3>
                                        <p className="text-xs md:text-sm text-slate-400 group-hover:text-blue-300 transition-colors flex items-center gap-2">
                                            View Content <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
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
                            className="group flex items-center text-slate-400 hover:text-white transition-colors mb-8"
                        >
                            <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center mr-3 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <ArrowLeft className="h-4 w-4" />
                            </div>
                            <span className="font-medium">Back to Courses</span>
                        </button>

                        <div className="flex items-center gap-4 mb-8">
                            <h2 className="text-3xl font-bold text-white">{activeCourse}</h2>
                            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                                Current
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {loadingFolders ? (
                                <div className="col-span-full py-20 text-center">
                                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-slate-500">Loading modules...</p>
                                </div>
                            ) : folders.length === 0 ? (
                                <div className="col-span-full bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-16 text-center">
                                    <FolderIcon className="h-16 w-16 text-slate-700 mx-auto mb-6" />
                                    <p className="text-lg text-slate-400 font-medium mb-2">No folders defined</p>
                                    <p className="text-sm text-slate-500">Check back later for new content.</p>
                                </div>
                            ) : (
                                folders.map((folder, idx) => (
                                    <div
                                        key={folder._id}
                                        onClick={() => router.push(`/student/resources/${folder._id}`)}
                                        className="group bg-[#0f172a]/60 backdrop-blur-sm border border-white/5 hover:border-blue-500/50 p-4 md:p-6 rounded-3xl cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 relative overflow-hidden"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                    >
                                        <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <FolderIcon className="h-24 w-24 md:h-32 md:w-32 -mr-8 -mt-8 md:-mr-10 md:-mt-10 text-white" />
                                        </div>

                                        <div className="h-10 w-10 md:h-14 md:w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 md:mb-6 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-inner shadow-blue-500/20">
                                            <FolderIcon className="h-5 w-5 md:h-7 md:w-7" />
                                        </div>

                                        <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight group-hover:text-blue-300 transition-colors">{folder.name}</h3>
                                        <p className="text-[10px] md:text-xs text-slate-400 font-medium flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            {new Date(folder.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </p>
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
