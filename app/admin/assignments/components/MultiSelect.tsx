'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder: string;
}

export default function MultiSelect({ options, selected, onChange, placeholder }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        const newSelected = selected.includes(value)
            ? selected.filter((item: string) => item !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    return (
        <div className="relative" ref={containerRef}>
            <div
                className="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded p-2 text-xs min-h-[38px] flex items-center justify-between cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex flex-wrap gap-1">
                    {selected.length === 0 ? <span className="text-gray-500">{placeholder}</span> :
                        selected.length > 2 ? <span className="text-white">{selected.length} selected</span> :
                            selected.map((s: string) => (
                                <span key={s} className="bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded text-[10px]">{s}</span>
                            ))}
                </div>
                <ChevronDown className="h-3 w-3 text-gray-400" />
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                    {options.map((opt: string) => (
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
                    ))}
                </div>
            )}
        </div>
    );
}
