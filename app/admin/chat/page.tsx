'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Send, Image as ImageIcon, MessageSquare, ChevronLeft, User, Scissors, Camera, X, Edit2, Check, RefreshCcw, Calculator, Reply, Trash2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
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

interface Batch {
    id: string;
    name: string;
    hasUnread: boolean;
    lastMessageAt: string | null;
}

export default function AdminChat() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingBatches, setLoadingBatches] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message|null>(null);
    const [editContent, setEditContent] = useState('');
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
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get admin auth headers from localStorage token to avoid student cookie conflicts
    const getAuthHeaders = (): Record<string, string> => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
        if (token) {
            return { 'Authorization': `Bearer ${token}` };
        }
        return {};
    };

    useEffect(() => {
        fetchBatches();
        const interval = setInterval(fetchBatches, 30000); 
        
        // Push a state so back button navigates within the app
        window.history.pushState({ chatPage: true }, '', window.location.href);
        const handlePopState = (e: PopStateEvent) => {
            e.preventDefault();
            window.location.href = '/admin/dashboard';
        };
        window.addEventListener('popstate', handlePopState);
        
        return () => {
            clearInterval(interval);
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    useEffect(() => {
        if (selectedBatch) {
            fetchMessages(selectedBatch.id);
            const interval = setInterval(() => fetchMessages(selectedBatch.id, true), 5000); 
            return () => clearInterval(interval);
        }
    }, [selectedBatch]);

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

    const fetchBatches = async () => {
        try {
            const res = await fetch('/api/chat/batches', { headers: getAuthHeaders() });
            const data = await res.json();
            if (res.ok) {
                setBatches(data.batches || []);
            } else {
                console.error('Failed to fetch batches:', data.error, data.detail);
                if (res.status === 403) {
                    toast.error('Auth issue: Please re-login as admin');
                }
            }
        } catch (error) {
            console.error('Failed to fetch batches', error);
        } finally {
            setLoadingBatches(false);
        }
    };

    const fetchMessages = async (batchId: string, silent = false) => {
        if (!silent) setLoadingMessages(true);
        try {
            const res = await fetch(`/api/chat/messages?batchId=${encodeURIComponent(batchId)}`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (res.ok) {
                setMessages(data.messages);
                setBatches(prev => prev.map(b => b.id === batchId ? { ...b, hasUnread: false } : b));
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
            senderName: replyingTo.senderName,
            content: replyingTo.content,
            senderRole: replyingTo.senderRole
        } : undefined;
        
        setNewMessage('');
        setReplyingTo(null);

        try {
            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ batchId: selectedBatch.id, content, type: 'text', replyTo: replyData })
            });
            if (res.ok) {
                fetchMessages(selectedBatch.id, true);
            } else {
                toast.error('Failed to send message');
            }
        } catch (error) {
            toast.error('Error sending message');
        }
    };

    const handleEditMessage = async () => {
        if (!editingMessage || !editContent.trim()) return;
        const toastId = toast.loading('Updating message...');
        try {
            const res = await fetch('/api/chat/messages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ messageId: editingMessage._id, content: editContent })
            });
            if (res.ok) {
                toast.success('Message updated', { id: toastId });
                setEditingMessage(null);
                fetchMessages(selectedBatch!.id, true);
            } else {
                toast.error('Failed to update', { id: toastId });
            }
        } catch (error) {
            toast.error('Error updating', { id: toastId });
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
                                    method: 'DELETE',
                                    headers: getAuthHeaders()
                                });
                                if (res.ok) {
                                    toast.success('Message deleted', { id: toastId });
                                    fetchMessages(selectedBatch!.id, true);
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
        if (!file || !selectedBatch) return;

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
                    batchName: selectedBatch!.name || selectedBatch!.id,
                    assignmentTitle: 'Chat Images',
                    studentName: 'Admin',
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
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ batchId: selectedBatch!.id, content: imageUrl, type: 'image' })
            });

            if (res.ok) {
                toast.success('Image sent', { id: toastId });
                fetchMessages(selectedBatch!.id, true);
            } else {
                throw new Error('Failed to save message');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error sending image', { id: toastId });
        }
    };

    const filteredBatches = batches.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleReplyClick = (msg: Message) => {
        setReplyingTo(msg);
        inputRef.current?.focus();
    };

    return (
        <div className="fixed top-[64px] left-0 right-0 bottom-0 md:relative md:top-0 h-[calc(100svh-64px)] md:h-[calc(100vh-140px)] flex flex-col md:flex-row bg-[#0f172a] md:rounded-3xl md:border border-white/10 overflow-hidden shadow-2xl w-full z-20">

            
            {/* Sidebar: Batch List */}

            <div className={`w-full md:w-80 border-r border-white/10 flex flex-col bg-[#0a0f1a]/50 ${selectedBatch ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <MessageSquare className="text-blue-400" /> Student Chat
                        </h2>
                        <button onClick={fetchBatches} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors">
                            <RefreshCcw className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search batches..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
                    {loadingBatches ? (
                        Array(5).fill(0).map((_, i) => (
                            <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse mb-2"></div>
                        ))
                    ) : batches.length === 0 ? (
                        <div className="p-8 text-center text-slate-600">
                            <p className="text-sm">No batches found.</p>
                            <p className="text-[10px] mt-1">Ensure students are enrolled in batches.</p>
                        </div>
                    ) : filteredBatches.map((batch) => (
                        <button
                            key={batch.id}
                            onClick={() => setSelectedBatch(batch)}
                            className={`w-full p-4 rounded-2xl transition-all duration-200 flex items-center justify-between group ${
                                selectedBatch?.id === batch.id 
                                ? 'bg-blue-600 text-white shadow-lg' 
                                : batch.hasUnread
                                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-100 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                                : 'hover:bg-white/5 text-slate-400 border border-transparent'
                            }`}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                                    selectedBatch?.id === batch.id 
                                    ? 'bg-white/20' 
                                    : batch.hasUnread 
                                    ? 'bg-red-500/20 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                    : 'bg-slate-800 text-slate-400'
                                }`}>
                                    {batch.name[0]}
                                </div>
                                <span className="font-bold truncate">{batch.name}</span>
                            </div>
                            {batch.hasUnread && (
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            {selectedBatch ? (
                <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0f172a] to-[#050b14] relative min-h-0">
                    {/* Chat Header */}
                    <div className="p-2 sm:p-3 border-b border-white/10 backdrop-blur-md bg-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 z-10 gap-2">
                        <button 
                            onClick={() => { setSelectedBatch(null); lastBatchIdScrolled.current = null; }} 
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-bold transition-colors md:hidden"
                        >
                            <ChevronLeft className="h-5 w-5" /> Back
                        </button>
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-2 w-full sm:w-auto shadow-sm">
                            <ul className="text-[10px] sm:text-xs text-blue-300 space-y-0.5 list-none m-0 p-0 text-left">
                                <li>* Student names are shown as Anonymous to all, but admin can see student names.</li>
                                <li>* Messages auto-delete after 7 days.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Messages */}
                    <div 
                        ref={messagesContainerRef}
                        className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 relative min-h-0 custom-scrollbar"
                        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
                    >
                        {loadingMessages ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-30">
                                <MessageSquare className="h-16 w-16 mb-4" />
                                <p className="font-bold">No messages yet.</p>
                            </div>
                        ) : (
                            messages.map((msg, i) => {
                                const isMe = msg.senderRole === 'admin';
                                const offset = swipeOffset.current[msg._id] || 0;
                                const isHighlighted = highlightedMsgId === msg._id;
                                return (
                                    <div 
                                        key={msg._id}
                                        id={`msg-${msg._id}`}
                                        className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 transition-colors duration-700 rounded-2xl ${isHighlighted ? 'bg-blue-500/20' : ''}`}
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
                                            {!isMe && (
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 ml-2">
                                                    {msg.senderName}
                                                </p>
                                            )}
                                            <div className={`relative group p-3 sm:p-4 rounded-3xl shadow-xl ${isMe ? 'bg-[#1e293b] text-slate-200 rounded-tr-none border border-slate-700 shadow-md' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'}`}>
                                                {/* Reply preview inside message - clickable to scroll */}
                                                {msg.replyTo && (
                                                    <div 
                                                        className={`mb-2 p-2 rounded-xl border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${isMe ? 'bg-slate-700/50 border-slate-500' : 'bg-slate-700/50 border-blue-400'}`}
                                                        onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                                                    >
                                                        <p className={`text-[10px] font-bold ${isMe ? 'text-slate-300' : 'text-blue-300'}`}>{msg.replyTo.senderRole === 'admin' ? 'Admin' : msg.replyTo.senderName}</p>
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
                                                    <img src={getPreviewUrl(msg.content)} alt="Sent" className="rounded-2xl max-h-80 w-auto object-contain cursor-pointer bg-white/5" onClick={() => window.open(msg.content, '_blank')} />
                                                )}
                                                
                                                <div className="flex items-center justify-between gap-4 mt-2 opacity-50 text-[10px]">
                                                    <div className="flex items-center gap-2">
                                                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        {isMe && msg.type === 'text' && (
                                                            <button 
                                                                onClick={() => { setEditingMessage(msg); setEditContent(msg.content); }}
                                                                className="hover:text-white transition-colors p-1"
                                                            >
                                                                <Edit2 className="h-2.5 w-2.5" />
                                                            </button>
                                                        )}
                                                        {isMe && (
                                                            <button 
                                                                onClick={() => handleDeleteMessage(msg)}
                                                                className="hover:text-red-400 transition-colors p-1"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-2.5 w-2.5" />
                                                            </button>
                                                        )}
                                                    </div>
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
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Edit Overlay */}
                    {editingMessage && (
                        <div className="absolute bottom-24 left-4 right-4 z-20 animate-in slide-in-from-bottom-4">
                            <div className="bg-slate-900 border border-blue-500/50 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="text-[10px] text-blue-400 font-black uppercase mb-2">Editing Message</p>
                                    <input 
                                        type="text" 
                                        value={editContent} 
                                        onChange={e => setEditContent(e.target.value)} 
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500" 
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingMessage(null)} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10"><X className="h-5 w-5"/></button>
                                    <button onClick={handleEditMessage} className="p-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20"><Check className="h-5 w-5"/></button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chat Input */}
                    <div className="p-4 sm:p-6 border-t border-white/10 bg-[#0a0f1a] relative shrink-0">
                        {imagePreview && (
                            <div className="absolute bottom-full left-0 right-0 p-4 bg-slate-900 border-t border-white/10 flex flex-col items-center animate-in slide-in-from-bottom-2 duration-300 z-30">
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
                            <div className="absolute bottom-full left-0 right-0 p-3 bg-[#0f172a] border-t border-white/10 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Math Symbols</span>
                                    <button onClick={() => setShowMathTools(false)} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar pb-1">
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
                                    <p className="text-[10px] font-bold text-blue-400">{replyingTo.senderRole === 'admin' ? 'Admin' : replyingTo.senderName}</p>
                                    <p className="text-xs text-slate-400 truncate">{replyingTo.type === 'image' ? '📷 Photo' : replyingTo.content.substring(0, 60)}</p>
                                </div>
                                <button onClick={() => setReplyingTo(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors shrink-0">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="flex items-end gap-2 sm:gap-3">
                            <button type="button" onClick={() => setShowMathTools(!showMathTools)} className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-colors border ${showMathTools ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'}`}>
                                <Calculator className="h-5 w-5" />
                            </button>
                            <label className="relative p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 transition-all cursor-pointer flex items-center justify-center m-0 overflow-hidden">
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
                                placeholder="Type a message..." 
                                rows={1}
                                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-all resize-none overflow-hidden"
                                style={{ maxHeight: '120px' }}
                            />
                            
                            <button type="submit" disabled={!newMessage.trim()} className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50 shrink-0"><Send className="h-5 w-5" /></button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-[#0f172a] text-slate-500">
                    <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                    <h3 className="text-xl font-bold text-slate-300">Select a batch to chat</h3>
                </div>
            )}
            <Toaster 
                position="top-right" 
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
