'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, MessageSquare, ChevronLeft, User, Camera, X, Edit2, Check, Calculator } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

const getPreviewUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com/file/d/')) {
        const id = url.split('/d/')[1]?.split('/')[0];
        if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    if (url.includes('drive.google.com/uc?export=download&id=')) {
        return url.replace('export=download', 'export=view');
    }
    return url;
};

interface Message {
    _id: string;
    batchId: string;
    senderId: string;
    senderName: string;
    senderRole: 'student' | 'admin';
    content: string;
    type: 'text' | 'image';
    isEdited?: boolean;
    createdAt: string;
}

export default function StudentChat() {
    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [editContent, setEditContent] = useState('');
    const [myRoll, setMyRoll] = useState<string | null>(null);
    const [showMathTools, setShowMathTools] = useState(false);
    
    const mathSymbols = [
        { label: 'xⁿ', insert: '$x^{n}$' },
        { label: 'd/dx', insert: '$\\frac{d}{dx}$' },
        { label: '∫', insert: '$\\int$' },
        { label: '∫a→b', insert: '$\\int_{a}^{b}$' },
        { label: '∑', insert: '$\\sum$' },
        { label: '√', insert: '$\\sqrt{x}$' },
        { label: 'lim', insert: '$\\lim_{x \\to a}$' },
        { label: '∞', insert: '$\\infty$' },
        { label: 'π', insert: '$\\pi$' },
        { label: 'θ', insert: '$\\theta$' },
        { label: 'Δ', insert: '$\\Delta$' },
        { label: 'α', insert: '$\\alpha$' },
        { label: 'β', insert: '$\\beta$' },
        { label: 'sin', insert: '$\\sin$' },
        { label: 'cos', insert: '$\\cos$' },
        { label: 'tan', insert: '$\\tan$' },
        { label: '≈', insert: '$\\approx$' },
        { label: '≤', insert: '$\\leq$' },
        { label: '≥', insert: '$\\geq$' },
        { label: '≠', insert: '$\\neq$' },
        { label: '→', insert: '$\\to$' },
        { label: '⇒', insert: '$\\implies$' },
        { label: 'Fraction', insert: '$\\frac{x}{y}$' },
        { label: ' Matrix', insert: '$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$'}
    ];


    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        fetchStudentInfo();
    }, []);

    useEffect(() => {
        if (selectedBatch) {
            fetchMessages(selectedBatch);
            const interval = setInterval(() => fetchMessages(selectedBatch, true), 5000);
            return () => clearInterval(interval);
        }
    }, [selectedBatch]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchStudentInfo = async () => {
        try {
            const res = await fetch('/api/student/me');
            const data = await res.json();
            if (res.ok) {
                setBatches(data.courses || []);
                setMyRoll(data.phoneNumber || data._id); // We use phone number as senderId
                if (data.courses?.length > 0) {
                    setSelectedBatch(data.courses[0]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch student info', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (batchId: string, silent = false) => {
        if (!silent) setLoadingMessages(true);
        try {
            const res = await fetch(`/api/chat/messages?batchId=${encodeURIComponent(batchId)}`);
            const data = await res.json();
            if (res.ok) setMessages(data.messages);
        } catch (error) {
            console.error('Failed to fetch messages', error);
        } finally {
            if (!silent) setLoadingMessages(false);
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !selectedBatch) return;

        const content = newMessage;
        setNewMessage('');

        try {
            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId: selectedBatch, content, type: 'text' })
            });
            if (res.ok) {
                fetchMessages(selectedBatch, true);
            } else {
                toast.error('Failed to send message');
            }
        } catch (error) {
            toast.error('Error sending message');
        }
    };

    const handleEditMessage = async () => {
        if (!editingMessage || !editContent.trim()) return;
        const toastId = toast.loading('Updating...');
        try {
            const res = await fetch('/api/chat/messages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: editingMessage._id, content: editContent })
            });
            if (res.ok) {
                toast.success('Updated', { id: toastId });
                setEditingMessage(null);
                fetchMessages(selectedBatch!, true);
            } else {
                toast.error('Failed', { id: toastId });
            }
        } catch (e) {
            toast.error('Error', { id: toastId });
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setImagePreview(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSendImage = async () => {
        if (!imagePreview || !selectedBatch) return;
        const b64 = imagePreview;
        setImagePreview(null);
        await sendImageMessage(b64);
    };

    const sendImageMessage = async (base64: string) => {
        const toastId = toast.loading('Sending image...');
        try {
            const uploadRes = await fetch('/api/student/assignments/upload-to-drive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batchName: selectedBatch!,
                    assignmentTitle: 'Chat Images',
                    studentName: 'Student',
                    phoneNumber: 'Chat',
                    fileData: base64.split(',')[1],
                    mimeType: 'image/jpeg',
                    fileName: `chat_${Date.now()}.jpg`
                })
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok || uploadData.status === 'error') throw new Error(uploadData.message || 'Upload failed');

            const imageUrl = uploadData.fileUrl || uploadData.downloadUrl;
            if (!imageUrl) throw new Error('No image URL returned');

            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId: selectedBatch!, content: imageUrl, type: 'image' })
            });

            if (res.ok) {
                toast.success('Image sent', { id: toastId });
                fetchMessages(selectedBatch!, true);
            } else {
                throw new Error('Failed to save message');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error sending image', { id: toastId });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050b14] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="h-[100svh] bg-[#050b14] flex flex-col font-sans relative overflow-hidden">
            <Toaster position="top-center" />
            
            {/* Header */}
            <div className="bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/10 p-3 sm:p-5 sticky top-0 z-20 flex flex-col gap-2">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/student')} className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0">
                        <ChevronLeft className="h-6 w-6 text-slate-400" />
                    </button>
                    <div className="min-w-0">
                        {batches.length > 1 ? (
                            <select 
                                value={selectedBatch || ''} 
                                onChange={(e) => setSelectedBatch(e.target.value)}
                                className="bg-transparent text-lg font-bold text-white border-none focus:ring-0 p-0 cursor-pointer max-w-full truncate"
                            >
                                {batches.map(b => <option key={b} value={b} className="bg-[#0a0f1a]">{b}</option>)}
                            </select>
                        ) : (
                            <h2 className="text-lg font-bold text-white truncate">{selectedBatch || 'Student Chat'}</h2>
                        )}
                        <p className="text-xs text-slate-500 truncate">Course Chat Group</p>
                    </div>
                </div>
                
                {selectedBatch && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2.5 mx-2 sm:mx-0 flex flex-col gap-1 shadow-sm">
                        <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] sm:text-xs text-blue-300 font-medium leading-tight">
                                Your name will remain <span className="text-white font-bold">anonymous</span> in the chatbox to your friends, but admin can see your name.
                            </p>
                        </div>
                        <div className="flex items-start gap-2 border-t border-blue-500/20 pt-1 mt-1">
                            <p className="text-[10px] sm:text-[11px] text-blue-200/80 font-medium leading-tight pl-6">
                                <b>Note:</b> All messages are permanently and securely deleted from the database exactly 7 days after sending.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 no-scrollbar pb-32">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 mt-20">
                        <MessageSquare className="h-16 w-16 mb-4" />
                        <p className="font-bold">No messages here yet.</p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.senderId === myRoll;
                        const isAdmin = msg.senderRole === 'admin';

                        return (
                            <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                                <div className="max-w-[85%] sm:max-w-[70%]">
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ml-2 ${isAdmin ? 'text-blue-400' : isMe ? 'text-indigo-400 text-right mr-2' : 'text-slate-500'}`}>
                                        {isAdmin ? 'Admin' : isMe ? 'Me' : 'Anonymous'}
                                    </p>
                                    <div className={`p-3 sm:p-4 rounded-3xl shadow-lg relative group ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : isAdmin ? 'bg-blue-600 text-white rounded-tl-none' : 'bg-slate-800 text-slate-300 rounded-tl-none border border-white/5'}`}>
                                        {msg.type === 'text' ? (
                                            <div className="text-sm sm:text-base leading-relaxed break-words latex-container overflow-x-auto overflow-y-hidden no-scrollbar">
                                                <Latex>{msg.content}</Latex>
                                                {msg.isEdited && <span className="text-[9px] opacity-40 ml-2">(edited)</span>}
                                            </div>
                                        ) : (
                                            <img src={getPreviewUrl(msg.content)} alt="Sent" className="rounded-2xl max-h-80 w-auto object-contain bg-white/5 cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />
                                        )}
                                        <div className="flex items-center justify-between gap-4 mt-2 opacity-50 text-[10px]">
                                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {isMe && msg.type === 'text' && (
                                                <button onClick={() => { setEditingMessage(msg); setEditContent(msg.content); }} className="p-1 hover:text-white transition-colors">
                                                    <Edit2 className="h-2.5 w-2.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Edit Overlay */}
            {editingMessage && (
                <div className="absolute bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-4">
                    <div className="bg-slate-900 border border-blue-500/50 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-[10px] text-blue-400 font-black uppercase mb-2">Editing Doubt</p>
                            <input type="text" value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" autoFocus />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingMessage(null)} className="p-2 rounded-xl bg-white/5 text-slate-400"><X className="h-5 w-5"/></button>
                            <button onClick={handleEditMessage} className="p-2 rounded-xl bg-blue-600 text-white"><Check className="h-5 w-5"/></button>
                        </div>
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="p-4 sm:p-6 bg-[#0a0f1a] border-t border-white/10 sticky bottom-0 z-40">
                {imagePreview && (
                    <div className="absolute bottom-full left-0 right-0 p-4 bg-slate-900 border-t border-white/10 flex flex-col items-center animate-in slide-in-from-bottom-2">
                        <div className="relative group">
                            <img src={imagePreview} alt="Preview" className="max-h-60 rounded-xl border border-white/10 shadow-2xl" />
                            <button onClick={() => setImagePreview(null)} className="absolute -top-3 -right-3 p-1.5 bg-red-600 rounded-full text-white shadow-lg"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="flex gap-4 mt-4 w-full max-w-md">
                            <button onClick={() => setImagePreview(null)} className="flex-1 py-3 rounded-2xl border border-white/10 text-slate-400 font-bold hover:bg-white/5">Cancel</button>
                            <button onClick={handleSendImage} className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 shadow-xl">Send Photo</button>
                        </div>
                    </div>
                )}
                        
                        {/* Math Tools Palette */}
                        {showMathTools && (
                            <div className="absolute bottom-full left-0 right-0 p-3 bg-[#0a0f1a]/95 backdrop-blur-md border-t border-white/10 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-2">
                                <div className="flex items-center justify-between mb-2 px-1 max-w-4xl mx-auto">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Math Symbols</span>
                                    <button onClick={() => setShowMathTools(false)} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar pb-1 max-w-4xl mx-auto">
                                    {mathSymbols.map((item, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setNewMessage(prev => prev + ' ' + item.insert + ' ')}
                                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded-lg text-white font-mono text-xs sm:text-sm transition-colors shadow-sm flex items-center justify-center min-w-[36px]"
                                            title={item.insert}
                                        >
                                            <Latex>{item.insert}</Latex>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-3 max-w-4xl mx-auto">
                            <button type="button" onClick={() => setShowMathTools(!showMathTools)} className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-colors border ${showMathTools ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'}`}>
                                <Calculator className="h-[1.2rem] w-[1.2rem]" />
                            </button>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 transition-all"><ImageIcon className="h-[1.2rem] w-[1.2rem]" /></button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Ask a doubt..." className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner" />
                            <button type="submit" disabled={!newMessage.trim()} className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50 shrink-0"><Send className="h-[1.2rem] w-[1.2rem]" /></button>
                        </form>
                        <p className="text-[9px] text-slate-700 mt-3 text-center uppercase tracking-[0.2em] font-black italic">Encrypted & Anonymous Community</p>

            </div>
        </div>
    );
}
