'use client';

import React from 'react';
import Latex from 'react-latex-next';

interface LatexWithImagesProps {
    children: string;
    className?: string;
}

/**
 * Component that renders LaTeX content while also detecting and rendering base64 image strings
 * Supports formats like: data:image/png;base64,... or ![alt](data:image/...)
 */
export default function LatexWithImages({ children, className = '' }: LatexWithImagesProps) {
    if (!children) return null;

    // Regex to match base64 image strings in various formats
    // Format 1: data:image/png;base64,iVBORw0KG...
    // Format 2: ![description](data:image/png;base64,iVBORw0KG...)
    const imagePattern = /(!?\[([^\]]*)\])?\s*(data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+)/g;

    const parts: Array<{ type: 'text' | 'image', content: string, alt?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = imagePattern.exec(children)) !== null) {
        // Add text before the image
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: children.substring(lastIndex, match.index)
            });
        }

        // Add the image
        parts.push({
            type: 'image',
            content: match[3], // The data:image/... part
            alt: match[2] || 'Embedded image' // The alt text from ![alt] or default
        });

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < children.length) {
        parts.push({
            type: 'text',
            content: children.substring(lastIndex)
        });
    }

    // If no images found, just render as Latex
    if (parts.length === 0) {
        return <div className={className}><Latex>{children}</Latex></div>;
    }

    // Render mixed content
    return (
        <div className={className}>
            {parts.map((part, index) => {
                if (part.type === 'image') {
                    return (
                        <img
                            key={index}
                            src={part.content}
                            alt={part.alt}
                            className="max-w-full h-auto my-2 rounded border border-gray-700"
                            style={{ maxHeight: '400px' }}
                        />
                    );
                } else {
                    return part.content ? <Latex key={index}>{part.content}</Latex> : null;
                }
            })}
        </div>
    );
}
