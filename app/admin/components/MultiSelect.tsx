'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder: string;
}

export default function MultiSelect({ options, selected, onChange, placeholder }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(''); // Reset search when closing
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        let newSelected = selected.includes(value)
            ? selected.filter((item) => item !== value)
            : [...selected, value];

        // If selecting something other than "No Topic", remove "No Topic"
        if (value !== "No Topic" && !selected.includes(value)) {
            newSelected = newSelected.filter(item => item !== "No Topic");
        }

        // If deselecting the last real topic, add "No Topic" back
        if (selected.includes(value) && newSelected.length === 0) {
            newSelected = ["No Topic"];
        }

        onChange(newSelected);
    };

    // Filter options based on search term
    const filteredOptions = options.filter((opt) =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={containerRef}>
            <div
                className="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded p-2 text-xs min-h-[38px] flex items-center justify-between cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex flex-wrap gap-1">
                    {selected.length === 0 ? <span className="text-gray-500 italic">{placeholder}</span> :
                        selected.length > 2 ? <span className="text-white">{selected.length} selected</span> :
                            selected.map((s) => (
                                <span key={s} className="bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded text-[10px]">{s}</span>
                            ))}
                </div>
                <ChevronDown className="h-3 w-3 text-gray-400" />
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-60 overflow-hidden flex flex-col">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                        <input
                            type="text"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-gray-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {/* Clear Selection Option */}
                    {selected.length > 0 && (
                        <div
                            className="px-3 py-2 hover:bg-red-900/30 cursor-pointer flex items-center gap-2 text-xs text-red-400 border-b border-gray-700 sticky top-[42px] bg-gray-800 z-10"
                            onClick={() => onChange([])}
                        >
                            <X className="h-3 w-3" /> Clear Selection
                        </div>
                    )}

                    {/* Options List */}
                    <div className="overflow-y-auto max-h-48">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500 italic">No matches found</div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt}
                                    className="px-3 py-2 hover:bg-gray-700 cursor-pointer flex items-center gap-2 text-xs text-gray-300"
                                    onClick={() => toggleOption(opt)}
                                >
                                    <div className={`w-3 h-3 rounded border border-gray-500 flex items-center justify-center ${selected.includes(opt) ? 'bg-blue-600 border-blue-600' : ''}`}>
                                        {selected.includes(opt) && <Check className="h-2 w-2 text-white" />}
                                    </div>
                                    {opt}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
