'use client';

import React, { useRef, useEffect } from 'react';

interface LineNumberTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
    errorLine?: number | null;
}

export default function LineNumberTextarea({ value, errorLine, className, ...props }: LineNumberTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    const lineCount = value.split('\n').length;
    const lines = Array.from({ length: lineCount }, (_, i) => i + 1);

    const handleScroll = () => {
        if (textareaRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    useEffect(() => {
        if (errorLine && textareaRef.current) {
            const lineHeight = 20; // Approximation, better to measure if possible
            // specific to the tailwind classes used (leading-relaxed is usually 1.625)
            // But for scrolling to line, simple calculation often works
            const targetScroll = (errorLine - 1) * lineHeight;
            // Try to center it
            // textareaRef.current.scrollTop = targetScroll - textareaRef.current.clientHeight / 2;
        }
    }, [errorLine]);

    return (
        <div className={`flex border border-gray-600 rounded overflow-hidden bg-gray-800 ${className}`}>
            <div
                ref={lineNumbersRef}
                className="bg-gray-900 text-gray-500 text-right p-4 select-none overflow-hidden font-mono text-sm leading-relaxed border-r border-gray-700 w-12 flex-shrink-0"
                style={{ fontFamily: 'monospace' }}
            >
                {lines.map((line) => (
                    <div
                        key={line}
                        className={`${errorLine === line ? 'bg-red-900/50 text-red-400 font-bold' : ''}`}
                    >
                        {line}
                    </div>
                ))}
            </div>
            <textarea
                ref={textareaRef}
                value={value}
                onScroll={handleScroll}
                className="flex-1 bg-gray-800 text-green-400 font-mono p-4 focus:outline-none text-sm leading-relaxed resize-none whitespace-pre-wrap border-none"
                style={{ fontFamily: 'monospace' }}
                {...props}
            />
        </div>
    );
}
