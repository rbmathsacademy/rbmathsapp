'use client';

export default function PiHero() {
    return (
        <div className="relative flex flex-col items-center justify-center h-48 sm:h-64 w-full">
            <svg
                viewBox="0 0 200 200"
                className="w-40 h-40 sm:w-56 sm:h-56 overflow-visible"
            >
                <defs>
                    {/* Gradient for Pi (Cyan to Blue) */}
                    <linearGradient id="piGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>

                    {/* Rainbow Gradient for Circle (Cyan -> Pink -> Green) */}
                    <linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan */}
                        <stop offset="50%" stopColor="#ec4899" /> {/* Pink */}
                        <stop offset="100%" stopColor="#22c55e" /> {/* Green */}
                    </linearGradient>

                    {/* Glow Filter */}
                    <filter id="neonGlow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Stylish Curvy Pi Path */}
                {/* Top: Wave, Left: Curled, Right: Curved */}
                <path
                    d="M 50 65 Q 40 45 20 55 Q 10 60 15 70 M 15 70 L 185 70 Q 195 70 190 60 Q 185 50 170 55 M 65 70 Q 65 100 60 130 Q 55 150 75 150 Q 85 150 90 140 M 135 70 Q 135 120 135 140 Q 135 155 150 150"
                    fill="none"
                    stroke="url(#piGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-pi-draw"
                />

                {/* Rainbow Circle */}
                <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="url(#rainbowGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="animate-circle-draw"
                    transform="rotate(-90 100 100)"
                />
            </svg>

            {/* Glassy Text */}
            <div className="absolute -bottom-4 opacity-0 animate-text-reveal">
                <span className="text-xl sm:text-2xl font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-b from-white/90 to-white/40 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    WELCOME
                </span>
                {/* Reflection/Glass Shine Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"></div>
            </div>

            <style jsx>{`
                /* Total Animation Duration: 3s (2x speed) */
                
                .animate-pi-draw {
                    stroke-dasharray: 500;
                    stroke-dashoffset: 500;
                    animation: drawPi 3s ease-in-out infinite;
                }

                .animate-circle-draw {
                    stroke-dasharray: 600; /* 2 * pi * 90 ≈ 565 */
                    stroke-dashoffset: 600;
                    opacity: 0;
                    animation: drawCircle 3s ease-in-out infinite;
                }

                .animate-text-reveal {
                    animation: revealText 3s ease-in-out infinite;
                }

                @keyframes drawPi {
                    0% { stroke-dashoffset: 500; filter: drop-shadow(0 0 0px #22d3ee); }
                    25% { stroke-dashoffset: 0; filter: drop-shadow(0 0 5px #22d3ee); } /* Finished drawing Pi */
                    85% { stroke-dashoffset: 0; opacity: 1; }
                    100% { stroke-dashoffset: 0; opacity: 0; }
                }

                @keyframes drawCircle {
                    0%, 20% { stroke-dashoffset: 600; opacity: 1; }
                    50% { stroke-dashoffset: 0; opacity: 1; filter: drop-shadow(0 0 8px rgba(236, 72, 153, 0.6)); } /* Finished drawing Circle */
                    85% { stroke-dashoffset: 0; opacity: 1; }
                    100% { stroke-dashoffset: 0; opacity: 0; }
                }

                @keyframes revealText {
                    0%, 45% { opacity: 0; transform: translateY(5px) scale(0.95); }
                    55% { opacity: 1; transform: translateY(0) scale(1); filter: drop-shadow(0 0 10px rgba(255,255,255,0.5)); }
                    85% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-5px) scale(1.05); }
                }
            `}</style>
        </div>
    );
}
