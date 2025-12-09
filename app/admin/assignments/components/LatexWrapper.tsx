'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function LatexWrapper({ children }: { children: string }) {
    const containerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!containerRef.current || !children) return;

        let processedContent = children;

        // Replace block math $$...$$ first
        processedContent = processedContent.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
            try {
                return `<div class="katex-block my-2">${katex.renderToString(math.trim(), {
                    displayMode: true,
                    throwOnError: false,
                    trust: true,
                })}</div>`;
            } catch (e) {
                return `<div class="text-red-400">[Math Error: ${math}]</div>`;
            }
        });

        // Replace inline math $...$
        processedContent = processedContent.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
            try {
                return katex.renderToString(math.trim(), {
                    displayMode: false,
                    throwOnError: false,
                    trust: true,
                });
            } catch (e) {
                return `<span class="text-red-400">[Math Error]</span>`;
            }
        });

        // Convert newlines to <br>
        processedContent = processedContent.replace(/\n/g, '<br>');

        containerRef.current.innerHTML = processedContent;
    }, [children]);

    return <span ref={containerRef} className="latex-content" />;
}
