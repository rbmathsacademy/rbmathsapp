'use client';

import { useEffect, useRef } from 'react';

interface LatexRendererProps {
    content: string;
    className?: string;
}

export default function LatexRenderer({ content, className = '' }: LatexRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || !content) return;

        // Dynamically import KaTeX to avoid SSR issues
        import('katex').then((katex) => {
            if (!containerRef.current) return;

            let processedContent = content;

            // Replace block math $$...$$ first
            processedContent = processedContent.replace(/\$\$([\s\S]*?)\$\$/g, function (match, math) {
                try {
                    return `<div class="katex-block my-4">${katex.default.renderToString(math.trim(), {
                        displayMode: true,
                        throwOnError: false,
                        trust: true
                    })}</div>`;
                } catch (e) {
                    return `<div class="text-red-400">[Math Error: ${math}]</div>`;
                }
            });

            // Replace inline math $...$
            processedContent = processedContent.replace(/\$([^\$\n]+?)\$/g, function (match, math) {
                try {
                    return katex.default.renderToString(math.trim(), {
                        displayMode: false,
                        throwOnError: false,
                        trust: true
                    });
                } catch (e) {
                    return `<span class="text-red-400">[Math Error]</span>`;
                }
            });

            // Replace \( ... \) inline delimiters
            processedContent = processedContent.replace(/\\\(([^)]*?)\\\)/g, function (match, math) {
                try {
                    return katex.default.renderToString(math.trim(), {
                        displayMode: false,
                        throwOnError: false,
                        trust: true
                    });
                } catch (e) {
                    return `<span class="text-red-400">[Math Error]</span>`;
                }
            });

            // Replace \[ ... \] block delimiters
            processedContent = processedContent.replace(/\\\[([^\]]*?)\\\]/g, function (match, math) {
                try {
                    return `<div class="katex-block my-4">${katex.default.renderToString(math.trim(), {
                        displayMode: true,
                        throwOnError: false,
                        trust: true
                    })}</div>`;
                } catch (e) {
                    return `<div class="text-red-400">[Math Error]</div>`;
                }
            });

            // Convert newlines to <br> for regular text
            processedContent = processedContent.replace(/\n/g, '<br>');

            containerRef.current.innerHTML = processedContent;
        }).catch((err) => {
            console.error('Failed to load KaTeX:', err);
            if (containerRef.current) {
                containerRef.current.textContent = content;
            }
        });
    }, [content]);

    return <div ref={containerRef} className={`latex-content ${className}`} />;
}
