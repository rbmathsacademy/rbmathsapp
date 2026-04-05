'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Image as ImageIcon, MessageSquare, ChevronLeft, User, Camera, X, Edit2, Check, Calculator, Reply, Trash2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import 'katex/dist/katex.min.css';
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

interface ReplyTo {
    messageId: string;
    senderName: string;
    content: string;
    senderRole: string;
}

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
    replyTo?: ReplyTo;
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
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const lastBatchIdScrolled = useRef<string | null>(null);
    
    // Swipe state refs
    const swipeStartX = useRef<number | null>(null);
    const swipeStartY = useRef<number | null>(null);
    const swipeMsgId = useRef<string | null>(null);
    const swipeOffset = useRef<Record<string, number>>({});
    const [, forceRender] = useState(0);

    const mathSymbols = [
        { label: 'xⁿ', insert: '²' }, // commonly used superscripts
        { label: 'x³', insert: '³' },
        { label: 'x⁴', insert: '⁴' },
        { label: 'x/y', insert: '½' },
        { label: 'x/y', insert: '⅓' },
        { label: 'x/y', insert: '¼' },
        { label: '∫', insert: '∫' },
        { label: '∑', insert: '∑' },
        { label: '√', insert: '√' },
        { label: 'lim', insert: 'lim' },
        { label: '∞', insert: '∞' },
        { label: 'π', insert: 'π' },
        { label: 'θ', insert: 'θ' },
        { label: 'Δ', insert: 'Δ' },
        { label: 'α', insert: 'α' },
        { label: 'β', insert: 'β' },
        { label: 'sin', insert: 'sin' },
        { label: 'cos', insert: 'cos' },
        { label: 'tan', insert: 'tan' },
        { label: '≈', insert: '≈' },
        { label: '≤', insert: '≤' },
        { label: '≥', insert: '≥' },
        { label: '≠', insert: '≠' },
        { label: '→', insert: '→' },
        { label: '⇒', insert: '⇒' },
        { label: '×', insert: '×' },
        { label: '÷', insert: '÷' },
        { label: '±', insert: '±' },
        { label: '°', insert: '°' },
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
            const interval = setInterval(() => fetchMessages(selectedBatch, true), 15000);
            return () => clearInterval(interval);
        }
    }, [selectedBatch]);

    useEffect(() => {
        // Push a state so back button navigates within the app
        window.history.pushState({ chatPage: true }, '', window.location.href);
        const handlePopState = (e: PopStateEvent) => {
            e.preventDefault();
            window.location.href = '/student';
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [router]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Auto-resize textarea
    const autoResize = useCallback(() => {
        const el = inputRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        }
    }, []);

    useEffect(() => {
        autoResize();
    }, [newMessage, autoResize]);

    // Swipe handlers for reply
    const handleTouchStart = (e: React.TouchEvent, msgId: string) => {
        swipeStartX.current = e.touches[0].clientX;
        swipeStartY.current = e.touches[0].clientY;
        swipeMsgId.current = msgId;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (swipeStartX.current === null || swipeStartY.current === null || !swipeMsgId.current) return;
        const deltaX = e.touches[0].clientX - swipeStartX.current;
        const deltaY = Math.abs(e.touches[0].clientY - swipeStartY.current);
        
        // Only allow right swipe, and only if horizontal movement dominant
        if (deltaY > Math.abs(deltaX)) return;
        
        if (deltaX > 0) {
            const offset = Math.min(deltaX, 80);
            swipeOffset.current = { ...swipeOffset.current, [swipeMsgId.current]: offset };
            forceRender(n => n + 1);
        }
    };

    const handleTouchEnd = () => {
        if (!swipeMsgId.current) return;
        const msgId = swipeMsgId.current;
        const offset = swipeOffset.current[msgId] || 0;
        
        if (offset > 50) {
            // Trigger reply
            const msg = messages.find(m => m._id === msgId);
            if (msg) {
                setReplyingTo(msg);
                inputRef.current?.focus();
            }
        }
        
        // Reset swipe
        swipeOffset.current = { ...swipeOffset.current, [msgId]: 0 };
        swipeStartX.current = null;
        swipeStartY.current = null;
        swipeMsgId.current = null;
        forceRender(n => n + 1);
    };

    // Scroll to a specific message and highlight it
    const scrollToMessage = (messageId: string) => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMsgId(messageId);
            setTimeout(() => setHighlightedMsgId(null), 2000);
        }
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
            if (res.ok) {
                setMessages(data.messages);
                if (lastBatchIdScrolled.current !== batchId) {
                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
                        lastBatchIdScrolled.current = batchId;
                    }, 100);
                }
            }
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
        const replyData = replyingTo ? {
            messageId: replyingTo._id,
            senderName: replyingTo.senderRole === 'admin' ? 'Admin' : (replyingTo.senderId === myRoll ? replyingTo.senderName : 'Anonymous'),
            content: replyingTo.content,
            senderRole: replyingTo.senderRole
        } : undefined;
        
        setNewMessage('');
        setReplyingTo(null);

        try {
            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId: selectedBatch, content, type: 'text', replyTo: replyData })
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

    const handleDeleteMessage = (msg: Message) => {
        toast((t) => (
            <div className="flex flex-col gap-3">
                <p className="font-bold text-sm">Delete this message permanently?</p>
                <div className="flex gap-2 justify-end">
                    <button 
                        onClick={() => toast.dismiss(t.id)} 
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const toastId = toast.loading('Deleting...');
                            try {
                                const res = await fetch(`/api/chat/messages?messageId=${msg._id}`, {
                                    method: 'DELETE'
                                });
                                if (res.ok) {
                                    toast.success('Message deleted', { id: toastId });
                                    fetchMessages(selectedBatch!, true);
                                } else {
                                    const data = await res.json();
                                    toast.error(data.error || 'Failed to delete', { id: toastId });
                                }
                            } catch (error) {
                                toast.error('Error deleting', { id: toastId });
                            }
                        }} 
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        ), { duration: 5000 });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const toastId = toast.loading('Preparing image...', { id: 'compressing' });
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            // Create an image object to get original dimensions
            const img = new Image();
            img.onload = () => {
                // Short timeout to let the toast render before synchronous drawing blocks the UI
                setTimeout(() => {
                    try {
                        const canvas = document.createElement('canvas');
                        let { width, height } = img;
                        const MAX_SIZE = 1200;

                        if (width > height && width > MAX_SIZE) {
                            height = Math.round((height * MAX_SIZE) / width);
                            width = MAX_SIZE;
                        } else if (height >= width && height > MAX_SIZE) {
                            width = Math.round((width * MAX_SIZE) / height);
                            height = MAX_SIZE;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0, width, height);
                            // Compress to JPEG with 0.8 quality
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            setImagePreview(dataUrl);
                        } else {
                            setImagePreview(result);
                        }
                    } catch (err) {
                        setImagePreview(result);
                    } finally {
                        toast.dismiss(toastId);
                    }
                }, 50);
            };
            img.src = result;
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

    const handleReplyClick = (msg: Message) => {
        setReplyingTo(msg);
        inputRef.current?.focus();
    };

    // Get display name for reply preview considering anonymity
    const getReplyDisplayName = (msg: Message) => {
        if (msg.senderRole === 'admin') return 'Admin';
        if (msg.senderId === myRoll) return 'Me';
        return 'Anonymous';
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

            
            {/* Header */}
            <div className="bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/10 p-2 sm:p-3 shrink-0 z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <button 
                    onClick={() => { lastBatchIdScrolled.current = null; router.push('/student'); }} 
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-bold transition-colors shrink-0"
                >
                    <ChevronLeft className="h-5 w-5" /> Back
                </button>
                
                {selectedBatch && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-2 w-full sm:w-auto shadow-sm">
                        <ul className="text-[10px] sm:text-xs text-blue-300 space-y-0.5 list-none m-0 p-0 text-left">
                            <li>* Student names are shown as Anonymous to all, but admin can see student names.</li>
                            <li>* Messages auto-delete after 7 days.</li>
                        </ul>
                    </div>
                )}
            </div>

            {/* Messages */}
            <div 
                className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 no-scrollbar min-h-0"
                style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
            >
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 mt-20">
                        <MessageSquare className="h-16 w-16 mb-4" />
                        <p className="font-bold">No messages here yet.</p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.senderId === myRoll;
                        const isAdmin = msg.senderRole === 'admin';
                        const offset = swipeOffset.current[msg._id] || 0;
                        const isHighlighted = highlightedMsgId === msg._id;

                        return (
                            <div 
                                key={msg._id}
                                id={`msg-${msg._id}`}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 relative transition-colors duration-700 rounded-2xl ${isHighlighted ? 'bg-blue-500/20' : ''}`}
                                onTouchStart={(e) => handleTouchStart(e, msg._id)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                style={{ 
                                    transform: offset > 0 ? `translateX(${offset}px)` : undefined,
                                    transition: offset > 0 ? 'none' : 'transform 0.2s ease-out'
                                }}
                            >
                                {/* Reply indicator on swipe */}
                                {offset > 20 && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center" style={{ opacity: Math.min(offset / 50, 1) }}>
                                        <div className="bg-blue-600/30 rounded-full p-2">
                                            <Reply className="h-4 w-4 text-blue-400" />
                                        </div>
                                    </div>
                                )}
                                <div className="max-w-[85%] sm:max-w-[70%]">
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ml-2 ${isAdmin ? 'text-blue-400' : isMe ? 'text-indigo-400 text-right mr-2' : 'text-slate-500'}`}>
                                        {isAdmin ? 'Admin' : isMe ? 'Me' : 'Anonymous'}
                                    </p>
                                    <div className={`p-3 sm:p-4 rounded-3xl shadow-lg relative group ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : isAdmin ? 'bg-[#1e293b] text-slate-200 border border-slate-700 rounded-tl-none shadow-md' : 'bg-slate-800 text-slate-300 rounded-tl-none border border-white/5'}`}>
                                        {/* Reply preview inside message - clickable to scroll */}
                                        {msg.replyTo && (
                                            <div 
                                                className={`mb-2 p-2 rounded-xl border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${isMe ? 'bg-indigo-700/50 border-indigo-300' : isAdmin ? 'bg-slate-700/50 border-slate-500' : 'bg-slate-700/50 border-blue-400'}`}
                                                onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                                            >
                                                <p className={`text-[10px] font-bold ${isAdmin ? 'text-slate-300' : 'text-blue-300'}`}>
                                                    {msg.replyTo.senderRole === 'admin' ? 'Admin' : 'Anonymous'}
                                                </p>
                                                <p className="text-[11px] opacity-80 truncate max-w-[250px]">
                                                    {msg.replyTo.content?.substring(0, 80)}{(msg.replyTo.content?.length || 0) > 80 ? '...' : ''}
                                                </p>
                                            </div>
                                        )}
                                        {msg.type === 'text' ? (
                                            <div className="text-sm sm:text-base leading-relaxed break-words latex-container overflow-x-auto overflow-y-hidden no-scrollbar whitespace-pre-wrap">
                                                <Latex>{msg.content}</Latex>
                                                {msg.isEdited && <span className="text-[9px] opacity-40 ml-2">(edited)</span>}
                                            </div>
                                        ) : (
                                            <img src={getPreviewUrl(msg.content)} alt="Sent" className="rounded-2xl max-h-80 w-auto object-contain bg-white/5 cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />
                                        )}
                                        <div className="flex items-center justify-between gap-4 mt-2 opacity-50 text-[10px]">
                                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <div className="flex items-center gap-1">
                                                {isMe && msg.type === 'text' && (
                                                    <button onClick={() => { setEditingMessage(msg); setEditContent(msg.content); }} className="p-1 hover:text-white transition-colors">
                                                        <Edit2 className="h-2.5 w-2.5" />
                                                    </button>
                                                )}
                                                {isMe && (
                                                    <button 
                                                        onClick={() => handleDeleteMessage(msg)}
                                                        className="p-1 hover:text-red-400 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                    </button>
                                                )}
                                                {/* Reply button (desktop) */}
                                                <button 
                                                    onClick={() => handleReplyClick(msg)}
                                                    className="opacity-0 group-hover:opacity-100 hover:text-white transition-all p-1"
                                                    title="Reply"
                                                >
                                                    <Reply className="h-3 w-3" />
                                                </button>
                                            </div>
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
            <div className="p-4 sm:p-6 bg-[#0a0f1a] border-t border-white/10 shrink-0 z-40 relative">
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
                            <div className="absolute bottom-full left-0 right-0 p-3 bg-[#0a0f1a]/95 backdrop-blur-md border-t border-white/10 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                                <div className="flex items-center justify-between mb-2 px-1 max-w-4xl mx-auto">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Math Symbols</span>
                                    <button onClick={() => setShowMathTools(false)} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar pb-1 max-w-4xl mx-auto">
                                    {mathSymbols.map((item, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setNewMessage(prev => prev + item.insert);
                                                inputRef.current?.focus();
                                            }}
                                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded-lg text-white font-mono text-xs sm:text-sm transition-colors shadow-sm flex items-center justify-center min-w-[36px]"
                                            title={item.label}
                                        >
                                            {item.insert}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Reply preview bar */}
                        {replyingTo && (
                            <div className="mb-2 flex items-center gap-3 bg-slate-800/80 border border-white/10 rounded-xl p-2.5 animate-in slide-in-from-bottom-2">
                                <div className="w-1 h-8 bg-blue-500 rounded-full shrink-0"></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-blue-400">{getReplyDisplayName(replyingTo)}</p>
                                    <p className="text-xs text-slate-400 truncate">{replyingTo.type === 'image' ? '📷 Photo' : replyingTo.content.substring(0, 60)}</p>
                                </div>
                                <button onClick={() => setReplyingTo(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors shrink-0">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="flex items-end gap-2 sm:gap-3 max-w-4xl mx-auto">
                            <button type="button" onClick={() => setShowMathTools(!showMathTools)} className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-colors border ${showMathTools ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'}`}>
                                <Calculator className="h-[1.2rem] w-[1.2rem]" />
                            </button>
                            <label className="relative p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 transition-all cursor-pointer flex items-center justify-center m-0 overflow-hidden">
                                <ImageIcon className="h-[1.2rem] w-[1.2rem]" />
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                    accept="image/*" 
                                    onChange={handleImageUpload}
                                    onClick={(e) => { (e.target as HTMLInputElement).value = '' }} 
                                />
                            </label>
                            
                            <textarea 
                                ref={inputRef}
                                value={newMessage} 
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Ask a doubt..." 
                                rows={1}
                                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-all resize-none overflow-hidden"
                                style={{ maxHeight: '120px' }}
                            />
                            
                            <button type="submit" disabled={!newMessage.trim()} className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50 shrink-0"><Send className="h-[1.2rem] w-[1.2rem]" /></button>
                        </form>
                        <p className="text-[9px] text-slate-700 mt-2 text-center uppercase tracking-[0.2em] font-black italic">Encrypted & Anonymous Community</p>

            </div>
            <Toaster 
                position="top-center" 
                containerStyle={{ zIndex: 100000 }} 
                toastOptions={{
                    style: {
                        zIndex: 100000,
                    },
                }}
            />
        </div>
    );
}
