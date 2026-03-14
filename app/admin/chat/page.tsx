'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Send, Image as ImageIcon, MessageSquare, ChevronLeft, User, ExternalLink, Scissors, Camera, X, Edit2, Check, RefreshCcw, Calculator } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

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
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [editContent, setEditContent] = useState('');
    const [showMathTools, setShowMathTools] = useState(false);
    
    const mathSymbols = ['∫', 'dx', 'dy/dx', '∂', '∑', '∞', 'π', 'θ', 'λ', 'μ', 'Δ', '∇', '±', '√', 'x²', 'x³', 'xⁿ', 'eˣ', 'ln()', 'log()', 'sin()', 'cos()', 'tan()', '≈', '≠', '≤', '≥', '→', '⇒', '↔', '⇔'];

    
    const messagesEndRef = useRef<HTMLDivElement>(null);
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
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedBatch) {
            fetchMessages(selectedBatch.id);
            const interval = setInterval(() => fetchMessages(selectedBatch.id, true), 5000); 
            return () => clearInterval(interval);
        }
    }, [selectedBatch]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        setNewMessage('');

        try {
            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ batchId: selectedBatch.id, content, type: 'text' })
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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedBatch) return;

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

    const shareToAI = (content: string, type: 'text' | 'image') => {
        const prompt = type === 'image' ? `Analyze this image link: ${content}` : content;
        const encodedText = encodeURIComponent(prompt);
        try {
            navigator.clipboard.writeText(prompt);
            toast.success('Text copied to clipboard for Gemini');
        } catch (e) {}
        window.open(`https://gemini.google.com/app?q=${encodedText}`, '_blank');
    };

    const filteredBatches = batches.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="h-[calc(100svh-85px)] md:h-[calc(100vh-140px)] flex flex-col md:flex-row bg-[#0f172a] md:rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative w-full -mx-4 md:mx-0 w-[calc(100%+2rem)] md:w-full">
            <Toaster position="top-right" />
            
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
                <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0f172a] to-[#050b14] relative">
                    {/* Chat Header */}
                    <div className="p-4 sm:p-6 border-b border-white/10 backdrop-blur-md bg-white/5 flex items-center justify-between sticky top-0 z-10">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setSelectedBatch(null)} className="md:hidden p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <ChevronLeft className="h-6 w-6 text-slate-400" />
                            </button>
                            <div>
                                <h3 className="text-lg font-bold text-white">{selectedBatch.name}</h3>
                                <p className="text-xs text-slate-500">Real-name Chat (Admin View)</p>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 no-scrollbar relative min-h-0">
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
                                return (
                                    <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                                        <div className="max-w-[85%] sm:max-w-[70%]">
                                            {!isMe && (
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 ml-2">
                                                    {msg.senderName}
                                                </p>
                                            )}
                                            <div className={`relative group p-3 sm:p-4 rounded-3xl shadow-xl ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'}`}>
                                                {msg.type === 'text' ? (
                                                    <p className="text-sm sm:text-base leading-relaxed break-words">
                                                        {msg.content}
                                                        {msg.isEdited && <span className="text-[9px] opacity-40 ml-2">(edited)</span>}
                                                    </p>
                                                ) : (
                                                    <img src={msg.content} alt="Sent" className="rounded-2xl max-h-80 w-auto object-contain cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />
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
                                                    </div>
                                                    <button 
                                                        onClick={() => shareToAI(msg.content, msg.type)}
                                                        className="flex items-center gap-1 hover:text-white transition-colors bg-white/5 px-2 py-1 rounded-full border border-white/10"
                                                    >
                                                        <ExternalLink className="h-2.5 w-2.5" /> AI
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
                    <div className="p-4 sm:p-6 border-t border-white/10 bg-[#0a0f1a] relative">
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
                            <div className="absolute bottom-full left-0 right-0 p-3 bg-[#0f172a] border-t border-white/10 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-2">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Math Symbols</span>
                                    <button onClick={() => setShowMathTools(false)} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar pb-1">
                                    {mathSymbols.map((sym, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setNewMessage(prev => prev + sym);
                                            }}
                                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded-lg text-white font-mono text-sm transition-colors shadow-sm"
                                        >
                                            {sym}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-3">
                            <button type="button" onClick={() => setShowMathTools(!showMathTools)} className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-colors border ${showMathTools ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'}`}>
                                <Calculator className="h-5 w-5" />
                            </button>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10"><ImageIcon className="h-5 w-5" /></button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type message..." className="flex-1 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-sans min-w-0" />
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
        </div>
    );
}
