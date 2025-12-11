'use client';

import { useEffect, useState } from 'react';

export default function PiHero() {
    return (
        <div className="relative flex flex-col items-center justify-center h-48 sm:h-64 w-full">
            <svg
                viewBox="0 0 200 200"
                className="w-32 h-32 sm:w-48 sm:h-48 overflow-visible"
            >
                <defs>
                    <linearGradient id="piGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" /> {/* Cyan-400 */}
                        <stop offset="100%" stopColor="#3b82f6" /> {/* Blue-500 */}
                    </linearGradient>
                    <filter id="neonGlow">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Pi Symbol Path */}
                <path
                    d="M 45 60 Q 40 45 25 55 M 25 55 L 175 55 M 70 55 L 70 140 Q 70 155 85 150 M 130 55 L 130 140 Q 130 150 140 145"
                    fill="none"
                    stroke="url(#piGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-pi-draw"
                />
            </svg>

            {/* Welcome Text */}
            <div className="absolute -bottom-2 opacity-0 animate-text-reveal">
                <span className="text-xl sm:text-2xl font-bold tracking-[0.2em] text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                    WELCOME
                </span>
            </div>

            <style jsx>{`
                .animate-pi-draw {
                    stroke-dasharray: 400; /* Approximate length of the path */
                    stroke-dashoffset: 400;
                    animation: drawAndGlow 6s ease-in-out infinite;
                }

                .animate-text-reveal {
                    animation: textFade 6s ease-in-out infinite;
                }

                @keyframes drawAndGlow {
                    0% {
                        stroke-dashoffset: 400;
                        filter: drop-shadow(0 0 0px rgba(34, 211, 238, 0));
                    }
                    30% {
                        stroke-dashoffset: 0;
                        filter: drop-shadow(0 0 2px rgba(34, 211, 238, 0.5));
                    }
                    50% {
                        stroke-dashoffset: 0;
                        filter: drop-shadow(0 0 15px rgba(34, 211, 238, 0.8));
                    }
                    80% {
                        stroke-dashoffset: 0;
                        opacity: 1;
                    }
                    100% {
                        stroke-dashoffset: 0;
                        opacity: 0; /* Fade out before restart */
                    }
                }

                @keyframes textFade {
                    0%, 40% {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    50% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    85% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                }
            `}</style>
        </div>
    );
}
