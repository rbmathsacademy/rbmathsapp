'use client';

import Image from 'next/image';

export default function LogoHero() {
    return (
        <div className="relative flex items-center justify-center w-64 h-64 sm:w-80 sm:h-80">
            {/* 1. Animated Light Ray Ring (Outer Boundary) with Electric Head */}
            <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full animate-spin-fast" viewBox="0 0 100 100">
                    <defs>
                        <linearGradient id="rayGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="transparent" />
                            <stop offset="20%" stopColor="#22d3ee" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#22d3ee" /> {/* Cyan tail */}
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* The Streak Tail */}
                    <circle
                        cx="50"
                        cy="50"
                        r="48"
                        fill="none"
                        stroke="url(#rayGradient)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="animate-ray-draw"
                        filter="url(#glow)"
                        transform="rotate(-15 50 50)"
                    />

                    {/* The Electric Bubble Head */}
                    {/* Positioned at the end of the streak (approx 0 degrees in SVG coord system if stroke ends there) */}
                    {/* We rotate this group to match the streak's leading edge */}
                    <circle
                        cx="98"
                        cy="50"
                        r="3"
                        fill="#ecfeff"
                        className="animate-pulse-fast shadow-[0_0_15px_rgba(34,211,238,1)]"
                        filter="drop-shadow(0 0 4px #22d3ee)"
                    />
                </svg>
            </div>

            {/* 2. Main Logo Image */}
            <div className="relative w-48 h-48 sm:w-60 sm:h-60 z-10">
                <Image
                    src="/hero-logo.png"
                    alt="Education Portal"
                    fill
                    className="object-contain"
                    priority
                />

                {/* 3. Bulb Glow Animation (Intensified) */}
                <div
                    className="absolute top-[25%] left-[28%] w-[20%] h-[25%] rounded-full bg-orange-400 mix-blend-screen animate-pulse-glow pointer-events-none blur-[15px]"
                    style={{ animationDuration: '2.5s' }}
                ></div>
                {/* Core hot center for extra intensity */}
                <div
                    className="absolute top-[32%] left-[35%] w-[6%] h-[10%] rounded-full bg-yellow-200 mix-blend-screen animate-pulse pointer-events-none blur-[5px]"
                ></div>

                {/* Optional: Second subtle glow */}
                <div
                    className="absolute bottom-[20%] left-[20%] w-[60%] h-[20%] rounded-full bg-blue-500/20 blur-[30px] mix-blend-screen animate-pulse pointer-events-none delay-700"
                ></div>
            </div>

            <style jsx>{`
                .animate-spin-fast {
                    animation: spin 6.5s linear infinite; /* 8s / 1.2 ~= 6.6s */
                }
                
                .animate-ray-draw {
                    stroke-dasharray: 120 200; /* Longer tail */
                }

                .animate-pulse-fast {
                    animation: pulse-bubble 1s ease-in-out infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.6; transform: scale(1); filter: blur(15px); }
                    50% { opacity: 1; transform: scale(1.3); filter: blur(20px); }
                }

                @keyframes pulse-bubble {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.8; }
                }
            `}</style>
        </div>
    );
}
