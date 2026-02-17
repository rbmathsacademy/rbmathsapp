
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import { toast, Toaster } from 'react-hot-toast';

interface Question {
    _id: string;
    text: string;
    type: string;
    image?: string;
    options?: string[];
    marks?: number;
}

export default function AssignmentQuestionsPage() {
    const params = useParams();
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [deadline, setDeadline] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id) fetchQuestions();
    }, [params.id]);

    const fetchQuestions = async () => {
        try {
            const res = await fetch(`/api/student/assignments/${params.id}/questions`);
            if (!res.ok) {
                if (res.status === 401) {
                    toast.error('Session expired. Please login again.');
                    return;
                }
                const err = await res.json();
                toast.error(err.error || 'Failed to load');
                return;
            }
            const data = await res.json();
            setTitle(data.title || 'Assignment');
            setDeadline(data.deadline || '');
            setQuestions(data.questions || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load assignment questions');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-gray-400">Loading questions...</div>;

    return (
        <div className="p-4 md:p-6 pb-24 max-w-4xl mx-auto text-gray-200 min-h-screen">
            <Toaster position="top-center" />

            <button
                onClick={() => router.push('/student/assignments')}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
                Back to Assignments
            </button>

            <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-6 mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
                {deadline && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Clock className="w-4 h-4" />
                        Due: {new Date(deadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
                <div className="mt-2 text-xs text-gray-500">{questions.length} question{questions.length !== 1 ? 's' : ''}</div>
            </div>

            <div className="space-y-6">
                {questions.map((q, i) => (
                    <div key={q._id} className="bg-[#1a1f2e] border border-white/5 rounded-xl p-6">
                        <div className="flex gap-4">
                            <span className="font-mono text-gray-500 font-bold">{i + 1}.</span>
                            <div className="flex-1 space-y-4">
                                <div className="text-gray-200 text-lg">
                                    <Latex>{q.text}</Latex>
                                </div>
                                {q.image && (
                                    <img
                                        src={`data:image/png;base64,${q.image}`}
                                        alt="Question"
                                        className="max-h-64 rounded-lg border border-white/10"
                                    />
                                )}
                                {q.type === 'mcq' && q.options && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                        {q.options.map((opt, idx) => (
                                            <div key={idx} className="bg-black/20 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                                                <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-xs text-gray-500 font-mono">
                                                    {String.fromCharCode(65 + idx)}
                                                </span>
                                                <Latex>{opt}</Latex>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {q.marks && (
                                    <div className="text-right text-sm text-gray-500 font-mono">
                                        [{q.marks} Marks]
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {questions.length === 0 && (
                    <div className="text-center py-12 text-gray-500 bg-[#1a1f2e] rounded-xl border border-white/5">
                        No questions found for this assignment.
                    </div>
                )}
            </div>
        </div>
    );
}
