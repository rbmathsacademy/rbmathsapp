'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, AlertCircle, Image as ImageIcon, X, Plus } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface QuestionRowProps {
    index: number;
    question: any;
    mode?: string; // 'latex', 'json', 'pdf'
    topics?: string[];
    subtopics?: string[];
    onChange: (updated: any) => void;
    onDelete: () => void;
}

// ── Helper: compress image file/blob to base64 JPEG ─────────────────────────
function compressImageToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                let b64 = canvas.toDataURL('image/jpeg', 0.7);
                if (b64.length > 500 * 1024) {
                    b64 = canvas.toDataURL('image/jpeg', 0.5);
                }
                resolve(b64);
            };
            img.onerror = () => reject(new Error('Failed to load image'));
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
    });
}

// ── MCQ Option Editor ────────────────────────────────────────────────────────
// Each option can be a plain string (LaTeX text) OR an object { text?, image? }
interface McqOptionEditorProps {
    optIndex: number;
    option: any; // string | { text?: string; image?: string }
    onChange: (updated: any) => void;
    onDelete: () => void;
}

function McqOptionEditor({ optIndex, option, onChange, onDelete }: McqOptionEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const letter = String.fromCharCode(65 + optIndex);

    const isObj = typeof option === 'object' && option !== null;
    const textVal: string = isObj ? (option.text ?? '') : (option ?? '');
    const imageVal: string = isObj ? (option.image ?? '') : '';

    const handleTextChange = (val: string) => {
        if (isObj) {
            onChange({ ...option, text: val });
        } else {
            onChange(val);
        }
    };

    const handleImageUpload = async (file: File | Blob) => {
        if ((file as File).size && (file as File).size > 5 * 1024 * 1024) {
            alert('Image too large (max 5 MB)');
            return;
        }
        try {
            const b64 = await compressImageToBase64(file);
            if (isObj) {
                onChange({ ...option, image: b64 });
            } else {
                onChange({ text: textVal, image: b64 });
            }
        } catch {
            alert('Failed to process image');
        }
    };

    const handleRemoveImage = () => {
        if (isObj) {
            const updated = { ...option } as any;
            delete updated.image;
            // Collapse back to plain string if only text remains
            if (!updated.image && typeof updated.text === 'string') {
                onChange(updated.text);
            } else {
                onChange(updated);
            }
        }
    };

    // Paste image via Ctrl+V
    const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLElement>) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                if (blob) await handleImageUpload(blob);
                return;
            }
        }
    }, [option]);

    return (
        <div className="rounded border border-gray-700 bg-gray-900/60 p-2 flex flex-col gap-1.5">
            {/* Header row */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase w-5 flex-shrink-0">{letter}.</span>

                {/* Image upload button */}
                <label
                    className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer border border-blue-500/30 bg-blue-900/10 hover:bg-blue-900/20 px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
                    title={`Upload or Ctrl+V paste image for option ${letter}`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                            e.target.value = '';
                        }}
                    />
                    <ImageIcon className="h-2.5 w-2.5" />
                    Image
                </label>

                {/* Delete option button */}
                <button
                    onClick={onDelete}
                    className="text-gray-600 hover:text-red-400 p-0.5 ml-auto transition-colors"
                    title="Remove this option"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>

            {/* Image preview (if attached) */}
            {imageVal && (
                <div className="relative group/img flex justify-center bg-gray-950 rounded border border-gray-700 overflow-hidden" style={{ maxHeight: '7rem' }}>
                    <img src={imageVal} alt={`Option ${letter}`} className="object-contain" style={{ maxHeight: '7rem' }} />
                    <button
                        onClick={handleRemoveImage}
                        className="absolute top-1 right-1 bg-red-700 hover:bg-red-600 text-white p-0.5 rounded opacity-0 group-hover/img:opacity-100 transition-opacity"
                        title="Remove image"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            {/* Text input — also accepts Ctrl+V image paste */}
            <input
                type="text"
                className="w-full bg-gray-950 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                value={textVal}
                onChange={(e) => handleTextChange(e.target.value)}
                onPaste={handlePaste}
                placeholder={`Option ${letter} text (LaTeX)… or Ctrl+V to paste image`}
            />

            {/* Live LaTeX preview */}
            {textVal && (
                <div className="text-gray-300 text-xs pl-1 leading-snug">
                    <Latex>{textVal}</Latex>
                </div>
            )}
        </div>
    );
}

// ── MCQ Options Section (used in image/latex modes) ──────────────────────────
interface McqOptionsSectionProps {
    options: any[];
    onChange: (options: any[]) => void;
}

function McqOptionsSection({ options, onChange }: McqOptionsSectionProps) {
    const handleOptionChange = (i: number, updated: any) => {
        const newOpts = [...options];
        newOpts[i] = updated;
        onChange(newOpts);
    };
    const handleOptionDelete = (i: number) => {
        const newOpts = options.filter((_, idx) => idx !== i);
        onChange(newOpts);
    };
    const handleAddOption = () => {
        onChange([...options, '']);
    };

    return (
        <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">MCQ Options</span>
                <button
                    onClick={handleAddOption}
                    className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 bg-emerald-900/10 hover:bg-emerald-900/20 px-1.5 py-0.5 rounded transition-colors"
                >
                    <Plus className="h-2.5 w-2.5" /> Add Option
                </button>
            </div>
            {options.map((opt, i) => (
                <McqOptionEditor
                    key={i}
                    optIndex={i}
                    option={opt}
                    onChange={(updated) => handleOptionChange(i, updated)}
                    onDelete={() => handleOptionDelete(i)}
                />
            ))}
            {options.length === 0 && (
                <p className="text-[10px] text-gray-600 italic">No options yet. Click "Add Option" to add one.</p>
            )}
        </div>
    );
}

export default function QuestionRow({ index, question, mode, topics = [], subtopics = [], onChange, onDelete }: QuestionRowProps) {
    // Local state for immediate UI feedback
    const [localQuestion, setLocalQuestion] = useState(question);
    const [jsonInput, setJsonInput] = useState(JSON.stringify(question, null, 2));
    const [error, setError] = useState<string | null>(null);

    // Ref to track if the update is coming from local user input vs parent prop change
    const isLocalUpdate = useRef(false);

    // Debounce timer ref
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Sync from Props to Local State
    useEffect(() => {
        if (!isLocalUpdate.current) {
            setLocalQuestion(question);
            setJsonInput(JSON.stringify(question, null, 2));
        }
        isLocalUpdate.current = false;
    }, [question]);

    const updateParent = (updated: any) => {
        isLocalUpdate.current = true;
        setLocalQuestion(updated);

        // Clear existing timer
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        // Debounce parent update
        debounceTimer.current = setTimeout(() => {
            onChange(updated);
            isLocalUpdate.current = false;
        }, 500); // 500ms debounce
    };

    const handleJsonChange = (val: string) => {
        setJsonInput(val);
        try {
            const parsed = JSON.parse(val);
            setError(null);
            updateParent(parsed);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleFieldChange = (field: string, value: any) => {
        const updated = { ...localQuestion, [field]: value };
        updateParent(updated);
    };

    if (mode === 'latex' || mode === 'manual') {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-gray-700 bg-gray-900 group">
                {/* Left: Raw Latex Editor */}
                <div className="p-4 border-r border-gray-700 flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase">Q{index + 1} Latex Content</span>
                        <button onClick={onDelete} className="text-gray-600 hover:text-red-400 p-1"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <textarea
                        className="flex-1 w-full bg-gray-950 p-4 rounded border border-gray-700 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[150px] text-gray-300"
                        value={localQuestion.text || ''}
                        onChange={(e) => handleFieldChange('text', e.target.value)}
                        placeholder="Write your question in LateX here..."
                    />
                </div>

                {/* Right: Preview + Metadata Inputs */}
                <div className="p-6 bg-gray-50 flex flex-col gap-4">
                    <div className="prose prose-sm max-w-none mb-4 min-h-[60px]">
                        <div className="font-bold text-gray-400 text-xs uppercase mb-2">Preview</div>
                        <div className="text-lg text-black leading-relaxed">
                            <Latex>{localQuestion.text || ''}</Latex>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded border border-gray-200 shadow-sm mt-auto">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Topic</label>
                            <input
                                list={`topics-${index}`}
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.topic || ''}
                                onChange={(e) => handleFieldChange('topic', e.target.value)}
                                placeholder="Select/Type"
                            />
                            <datalist id={`topics-${index}`}>
                                {topics.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subtopic</label>
                            <input
                                list={`subtopics-${index}`}
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.subtopic || ''}
                                onChange={(e) => handleFieldChange('subtopic', e.target.value)}
                                placeholder="Select/Type"
                            />
                            <datalist id={`subtopics-${index}`}>
                                {subtopics.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type</label>
                            <select
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.type || 'broad'}
                                onChange={(e) => handleFieldChange('type', e.target.value)}
                            >
                                <option value="broad">Broad</option>
                                <option value="short">Short</option>
                                <option value="mcq">MCQ</option>
                                <option value="blanks">Blanks</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded border border-gray-200 shadow-sm mt-auto">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Exam Name</label>
                            <input
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.examNames?.join(', ') || localQuestion.examName || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const names = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
                                    const updated = { ...localQuestion, examNames: names, examName: val };
                                    updateParent(updated);
                                }}
                                placeholder="e.g. JEE Main 2024"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Marks</label>
                            <input
                                type="number"
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.marks || ''}
                                onChange={(e) => handleFieldChange('marks', e.target.value)}
                                placeholder="e.g. 4"
                            />
                        </div>
                    </div>

                    {/* MCQ Options — shown when type is mcq */}
                    {localQuestion.type?.toLowerCase() === 'mcq' && (
                        <div className="p-3 bg-white rounded border border-gray-200 shadow-sm">
                            <McqOptionsSection
                                options={Array.isArray(localQuestion.options) ? localQuestion.options : []}
                                onChange={(opts) => handleFieldChange('options', opts)}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- Image Mode ---
    if (mode === 'image') {
        const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) { // 5MB hard limit
                setError('File too large (Max 5MB)');
                return;
            }

            // Client-side compression
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Resize large images
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;

                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Compress to JPEG 0.7 quality
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                    if (compressedBase64.length > 500 * 1024) {
                        // If still > 500KB, try more aggressive compression
                        const aggressive = canvas.toDataURL('image/jpeg', 0.5);
                        updateParent({ ...localQuestion, image: aggressive });
                    } else {
                        updateParent({ ...localQuestion, image: compressedBase64 });
                    }
                    setError(null);
                };
            };
        };

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-gray-700 bg-gray-900 group">
                {/* Left: Inputs (Image + Text) */}
                <div className="p-4 border-r border-gray-700 flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase">Q{index + 1} Editor</span>
                        <button onClick={onDelete} className="text-gray-600 hover:text-red-400 p-1"><Trash2 className="h-4 w-4" /></button>
                    </div>

                    {/* Image Input */}
                    {!localQuestion.image ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded bg-gray-950 p-6 transition-colors hover:border-blue-500 min-h-[150px]">
                            <input type="file" accept="image/*" className="hidden" id={`img-upload-${index}`} onChange={handleImageUpload} />
                            <label htmlFor={`img-upload-${index}`} className="flex flex-col items-center cursor-pointer">
                                <div className="bg-gray-800 p-3 rounded-full mb-3 text-blue-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                </div>
                                <span className="text-xs font-bold text-white mb-1">Upload Image</span>
                                <span className="text-[10px] text-gray-400">Graphs, Circuits, Diagrams (Max 5MB)</span>
                            </label>
                            {error && <span className="text-xs text-red-500 mt-2">{error}</span>}
                        </div>
                    ) : (
                        <div className="relative group/preview min-h-[150px] bg-gray-950 flex items-center justify-center rounded border border-gray-700 overflow-hidden">
                            <img src={localQuestion.image} alt="Preview" className="max-w-full max-h-[200px] object-contain" />
                            <button
                                onClick={() => updateParent({ ...localQuestion, image: '' })}
                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white p-1 rounded opacity-0 group-hover/preview:opacity-100 transition-opacity"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* Text Input */}
                    <div className="flex flex-col gap-2 flex-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Input Question Text (Latex)</label>
                        <textarea
                            className="w-full h-full min-h-[150px] bg-gray-950 p-4 rounded border border-gray-700 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-300 resize-y"
                            placeholder="Enter the text of the question (Latex)..."
                            value={localQuestion.text || ''}
                            onChange={(e) => handleFieldChange('text', e.target.value)}
                        />
                    </div>
                </div>

                {/* Right: Full Preview + Metadata */}
                <div className="p-6 bg-gray-50 flex flex-col gap-4">
                    {/* Preview Area */}
                    <div className="flex-1 border border-gray-200 rounded p-4 bg-white shadow-sm overflow-auto min-h-[200px]">
                        <div className="font-bold text-gray-400 text-xs uppercase mb-4 border-b pb-2">Q{index + 1} Live Preview</div>

                        <div className="space-y-4">
                            {/* Image Preview in Context */}
                            {localQuestion.image && (
                                <div className="flex justify-center">
                                    <img src={localQuestion.image} alt="Question Image" className="max-w-full max-h-[300px] object-contain rounded" />
                                </div>
                            )}

                            {/* Text Preview in Context */}
                            <div className="text-lg text-black leading-relaxed">
                                {localQuestion.text ? (
                                    <Latex>{localQuestion.text}</Latex>
                                ) : (
                                    <span className="text-gray-400 italic text-sm">Question text will appear here...</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded border border-gray-200 shadow-sm mt-auto">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Exam Names</label>
                            <input
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.examNames?.join(', ') || localQuestion.examName || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const names = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
                                    const updated = { ...localQuestion, examNames: names, examName: val };
                                    updateParent(updated);
                                }}
                                placeholder="e.g. JEE 2024"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Marks</label>
                            <input
                                type="number"
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.marks || ''}
                                onChange={(e) => handleFieldChange('marks', e.target.value)}
                                placeholder="e.g. 4"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded border border-gray-200 shadow-sm mt-auto">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Topic <span className="text-red-500">*</span></label>
                            <input
                                list={`topics-${index}`}
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.topic || ''}
                                onChange={(e) => handleFieldChange('topic', e.target.value)}
                                placeholder="Required"
                            />
                            <datalist id={`topics-${index}`}>
                                {topics.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subtopic <span className="text-red-500">*</span></label>
                            <input
                                list={`subtopics-${index}`}
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.subtopic || ''}
                                onChange={(e) => handleFieldChange('subtopic', e.target.value)}
                                placeholder="Required"
                            />
                            <datalist id={`subtopics-${index}`}>
                                {subtopics.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type <span className="text-red-500">*</span></label>
                            <select
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.type || 'broad'}
                                onChange={(e) => handleFieldChange('type', e.target.value)}
                            >
                                <option value="broad">Broad</option>
                                <option value="mcq">MCQ</option>
                                <option value="blanks">Blanks</option>
                            </select>
                        </div>
                    </div>

                    {/* MCQ Options — shown when type is mcq */}
                    {localQuestion.type?.toLowerCase() === 'mcq' && (
                        <div className="p-3 bg-white rounded border border-gray-200 shadow-sm">
                            <McqOptionsSection
                                options={Array.isArray(localQuestion.options) ? localQuestion.options : []}
                                onChange={(opts) => handleFieldChange('options', opts)}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Default (JSON) Row View
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-gray-700 bg-gray-900 group">
            {/* Left: JSON Editor */}
            <div className="p-4 border-r border-gray-700 flex flex-col gap-4">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gray-500 uppercase">Q{index + 1} JSON Object</span>
                    <button onClick={onDelete} className="text-gray-600 hover:text-red-400 p-1"><Trash2 className="h-4 w-4" /></button>
                </div>
                {error && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Invalid JSON</span>}
                <textarea
                    className={`flex-1 w-full bg-gray-950 p-3 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-1 transition-all min-h-[150px] text-emerald-400 ${error ? 'border-red-500/50 focus:ring-red-500' : 'border-gray-700 focus:ring-blue-500'
                        }`}
                    value={jsonInput}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    spellCheck={false}
                    onPaste={(e) => {
                        const items = e.clipboardData.items;
                        for (let i = 0; i < items.length; i++) {
                            if (items[i].type.indexOf('image') !== -1) {
                                e.preventDefault();
                                const blob = items[i].getAsFile();
                                if (!blob) return;

                                const reader = new FileReader();
                                reader.readAsDataURL(blob);
                                reader.onload = (event) => {
                                    const img = new Image();
                                    img.src = event.target?.result as string;
                                    img.onload = () => {
                                        const canvas = document.createElement('canvas');
                                        const MAX_WIDTH = 800;
                                        const scaleSize = MAX_WIDTH / img.width;
                                        canvas.width = MAX_WIDTH;
                                        canvas.height = img.height * scaleSize;
                                        const ctx = canvas.getContext('2d');
                                        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                                        const updated = { ...localQuestion, image: compressedBase64 };
                                        updateParent(updated);
                                    };
                                };
                            }
                        }
                    }}
                />

                {/* Manual Image Upload for JSON Mode */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
                    <label className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 cursor-pointer transition-colors">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                const reader = new FileReader();
                                reader.readAsDataURL(file);
                                reader.onload = (event) => {
                                    const img = new Image();
                                    img.src = event.target?.result as string;
                                    img.onload = () => {
                                        const canvas = document.createElement('canvas');
                                        const MAX_WIDTH = 800;
                                        const scaleSize = MAX_WIDTH / img.width;
                                        canvas.width = MAX_WIDTH;
                                        canvas.height = img.height * scaleSize;
                                        const ctx = canvas.getContext('2d');
                                        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                                        const updated = { ...localQuestion, image: compressedBase64 };
                                        updateParent(updated);
                                    };
                                };
                            }}
                        />
                        <div className="p-1.5 bg-gray-800 rounded border border-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        </div>
                        <span>Upload/Paste Image</span>
                    </label>
                    {localQuestion.image && (
                        <span className="text-[10px] text-green-400 bg-green-900/20 px-2 py-0.5 rounded border border-green-900/30">
                            Image Attached
                        </span>
                    )}
                </div>
            </div>

            {/* Right: Live Preview */}
            <div className="p-4 bg-gray-900 min-h-[200px] border-l border-gray-700">
                {!error ? (
                    <div className="h-full flex flex-col">
                        {/* Distinct Colored Badges at Top */}
                        <div className="mb-4 border-b border-gray-700 pb-2 flex flex-wrap gap-2 items-center">
                            {/* Topic -> Blue */}
                            <span className="bg-blue-900/40 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                {localQuestion.topic || 'No Topic'}
                            </span>

                            {/* Subtopic -> Cyan */}
                            <span className="bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                {localQuestion.subtopic || 'No Subtopic'}
                            </span>

                            {/* Type -> Color Coded */}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${localQuestion.type?.toLowerCase() === 'mcq' ? 'bg-yellow-900/40 text-yellow-300 border-yellow-500/30' :
                                localQuestion.type?.toLowerCase() === 'broad' ? 'bg-pink-900/40 text-pink-300 border-pink-500/30' :
                                    localQuestion.type?.toLowerCase() === 'short' ? 'bg-purple-900/40 text-purple-300 border-purple-500/30' :
                                        'bg-gray-700 text-gray-300 border-gray-600'
                                }`}>
                                {localQuestion.type || 'Unknown'}
                            </span>

                            {/* Exam Names - Handle Array or String */}
                            {(localQuestion.examNames && localQuestion.examNames.length > 0 ? localQuestion.examNames : localQuestion.examName ? [localQuestion.examName] : []).map((exam: string, i: number) => (
                                <span key={i} className="bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                    {exam}
                                </span>
                            ))}

                            {/* Marks -> Gray Badge */}
                            {localQuestion.marks && (
                                <span className="bg-gray-800 text-gray-300 border border-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">
                                    {localQuestion.marks} Marks
                                </span>
                            )}
                        </div>

                        <div className="text-white text-sm prose prose-sm prose-invert max-w-none mb-4">
                            {localQuestion.text ? <Latex>{localQuestion.text}</Latex> : <span className="text-gray-500 italic">(No text content)</span>}
                        </div>

                        {/* Options for MCQ — supports plain strings and { text, image } objects */}
                        {localQuestion.type?.toLowerCase() === 'mcq' && localQuestion.options && localQuestion.options.length > 0 && (
                            <div className="flex flex-col gap-2 mb-4">
                                {localQuestion.options.map((opt: any, i: number) => {
                                    const isObj = typeof opt === 'object' && opt !== null;
                                    const optText: string = isObj ? (opt.text ?? '') : (opt ?? '');
                                    const optImage: string = isObj ? (opt.image ?? '') : '';
                                    return (
                                        <div key={i} className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 flex flex-col gap-1">
                                            <div className="flex items-start gap-2">
                                                <span className="font-bold text-gray-400">{String.fromCharCode(65 + i)}.</span>
                                                {optText && <span><Latex>{optText}</Latex></span>}
                                            </div>
                                            {optImage && (
                                                <img src={optImage} alt={`Option ${String.fromCharCode(65 + i)}`} className="max-h-20 object-contain rounded border border-gray-600 mt-1" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Render Image at Bottom & Inverted */}
                        {localQuestion.image && (
                            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-center">
                                <img
                                    src={localQuestion.image}
                                    alt="Question Diagram"
                                    className="max-w-full max-h-[200px] object-contain rounded filter invert mix-blend-lighten"
                                />
                            </div>
                        )}

                        {/* Answer Segment */}
                        {localQuestion.answer && (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">Answer</span>
                                <div className="text-emerald-300 text-sm leading-relaxed">
                                    <Latex>{String(localQuestion.answer)}</Latex>
                                </div>
                            </div>
                        )}

                        {/* Hint Segment */}
                        {localQuestion.hint && (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">Hint</span>
                                <div className="text-amber-200 text-sm leading-relaxed">
                                    <Latex>{String(localQuestion.hint)}</Latex>
                                </div>
                            </div>
                        )}

                        {/* Explanation Segment */}
                        {localQuestion.explanation && (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 block mb-1">Explanation</span>
                                <div className="text-gray-300 text-sm leading-relaxed">
                                    <Latex>{String(localQuestion.explanation)}</Latex>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                        Fix JSON to see preview
                    </div>
                )}
            </div>
        </div>
    );
}
