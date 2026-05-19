'use client';

import { useRef, useEffect } from 'react';

interface BatchTabSwitcherProps {
    batches: string[];
    selectedBatch: string;
    onSelect: (batch: string) => void;
}

const FREE_BATCH = 'class xi (free batch) 2026-27';

export default function BatchTabSwitcher({ batches, selectedBatch, onSelect }: BatchTabSwitcherProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLButtonElement>(null);

    // Auto-scroll the active tab into view
    useEffect(() => {
        if (activeRef.current && scrollRef.current) {
            const container = scrollRef.current;
            const active = activeRef.current;
            const containerRect = container.getBoundingClientRect();
            const activeRect = active.getBoundingClientRect();
            if (activeRect.left < containerRect.left || activeRect.right > containerRect.right) {
                active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [selectedBatch]);

    // Filter out free batch and only render when >1 batch remains
    const filteredBatches = batches.filter(b => b.trim().toLowerCase() !== FREE_BATCH);
    if (filteredBatches.length <= 1) return null;

    return (
        <div className="w-full overflow-hidden">
            <div
                ref={scrollRef}
                className="flex gap-1.5 overflow-x-auto no-scrollbar p-1 bg-[#0f1420] ring-1 ring-white/5 rounded-xl"
            >
                {filteredBatches.map(batch => {
                    const isActive = batch === selectedBatch;
                    return (
                        <button
                            key={batch}
                            ref={isActive ? activeRef : undefined}
                            onClick={() => onSelect(batch)}
                            className={`
                                relative whitespace-nowrap px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider
                                transition-all duration-300 ease-out shrink-0
                                ${isActive
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 scale-[1.02]'
                                    : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 active:scale-[0.97]'
                                }
                            `}
                        >
                            {batch}
                            {isActive && (
                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-white/30 rounded-full" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
