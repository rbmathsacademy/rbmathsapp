'use client';

import React, { useEffect, useRef, useState } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

interface MathInputProps {
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: (e: any) => void;
    placeholder?: string;
    className?: string;
    style?: React.CSSProperties;
    mathFieldRef?: React.MutableRefObject<any>;
}

export default function MathInput({ value, onChange, onKeyDown, placeholder, className, style, mathFieldRef }: MathInputProps) {
    const [isMounted, setIsMounted] = useState(false);
    const internalRef = useRef<any>(null);
    const mfRef = mathFieldRef || internalRef;

    useEffect(() => {
        setIsMounted(true);
        import('mathlive').then((mathlive) => {
            // Customize mathlive config if needed
            if (mfRef.current) {
                mfRef.current.mathVirtualKeyboardPolicy = "manual";
                mfRef.current.addEventListener('input', (e: any) => {
                    onChange(e.target.value);
                });
            }
        });
    }, []);

    useEffect(() => {
        if (mfRef.current && isMounted && mfRef.current.value !== value) {
            mfRef.current.value = value;
        }
    }, [value, isMounted]);

    if (!isMounted) return <div className={className} style={{...style, display: 'flex', alignItems: 'center', opacity: 0.5}}>Loading math editor...</div>;

    return (
        <math-field
            ref={mfRef}
            className={className}
            style={{
                ...style, 
                /* Add overrides for styling math-field similarly to textarea */
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '12px 20px',
                borderRadius: '16px',
                fontSize: '16px'
            }}
            onKeyDown={onKeyDown}
        >
            {value}
        </math-field>
    );
}
