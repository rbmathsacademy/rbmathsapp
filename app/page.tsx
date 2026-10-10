'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, Maximize2, Minimize2, User, ArrowRight } from 'lucide-react';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['700', '800'], display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });

export default function Home() {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsNavigating(true);
    setTimeout(() => {
      router.push('/student/login');
    }, 200);
  };

  return (
    <div
      className={`min-h-[100dvh] bg-[#05070F] text-[#F4F6FF] relative overflow-hidden flex flex-col items-center selection:bg-[#8B5CF6]/30 ${inter.className} ${isNavigating ? 'page-fade-out' : ''}`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        :root {
          --brand: linear-gradient(120deg, #22D3EE 0%, #3B82F6 35%, #8B5CF6 70%, #EC4899 100%);
          /* Mirrored so the animated, 200%-wide gradient never shows a hard seam */
          --brand-loop: linear-gradient(90deg, #22D3EE 0%, #3B82F6 17%, #8B5CF6 35%, #EC4899 50%, #8B5CF6 65%, #3B82F6 83%, #22D3EE 100%);
        }

        /* Entrance. Never put another animation on the same element as .rise */
        .rise {
          opacity: 0;
          animation: rise 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .d1 { animation-delay: 80ms; }
        .d2 { animation-delay: 180ms; }
        .d3 { animation-delay: 280ms; }
        .d4 { animation-delay: 380ms; }
        .d5 { animation-delay: 480ms; }
        .d6 { animation-delay: 580ms; }

        @keyframes rise {
          0% { opacity: 0; transform: translateY(18px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .float { animation: float 7s ease-in-out infinite; }

        @keyframes breathe {
          0%, 100% { opacity: 0.75; transform: translateX(-50%) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.06); }
        }
        .spotlight { animation: breathe 9s ease-in-out infinite; }

        @keyframes slide {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .grad-text {
          background: var(--brand-loop);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: slide 10s ease-in-out infinite;
        }

        /* 1px gradient hairline border that follows the element's radius */
        .hairline { position: relative; }
        .hairline::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(145deg, rgba(255,255,255,0.28), rgba(139,92,246,0.35) 40%, rgba(34,211,238,0.12) 70%, rgba(255,255,255,0.08));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
          mask-composite: exclude;
          pointer-events: none;
        }

        /* Soft light sweep across the button, with a long pause between sweeps */
        @keyframes sweep {
          0%, 55% { transform: translateX(-130%) skewX(-18deg); }
          100% { transform: translateX(260%) skewX(-18deg); }
        }
        .sweep::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; left: 0;
          width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
          animation: sweep 6.5s ease-in-out infinite;
          pointer-events: none;
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 48px 48px;
          -webkit-mask-image: radial-gradient(ellipse 70% 55% at 50% 30%, #000 0%, transparent 75%);
          mask-image: radial-gradient(ellipse 70% 55% at 50% 30%, #000 0%, transparent 75%);
        }

        .page-fade-out {
          opacity: 0;
          transition: opacity 200ms ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .rise, .float, .spotlight, .grad-text, .sweep::after {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
          .sweep::after { display: none; }
          .page-fade-out { transition: opacity 150ms ease-out; }
        }
      `,
        }}
      />

      {/* Background: restrained, light-based, no clutter */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 grid-bg" />
        <div
          className="spotlight absolute left-1/2 top-[2%] h-[560px] w-[560px] max-w-[140vw] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(99,102,241,0.30), rgba(99,102,241,0) 100%)' }}
        />
        <div
          className="absolute bottom-[-18%] right-[-25%] h-[460px] w-[460px] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(34,211,238,0.12), rgba(34,211,238,0) 100%)' }}
        />
        <div
          className="absolute bottom-[-20%] left-[-25%] h-[420px] w-[420px] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(236,72,153,0.10), rgba(236,72,153,0) 100%)' }}
        />
      </div>

      <div className="w-full max-w-[420px] flex flex-col min-h-[100dvh] relative z-10 px-[20px]">
        {/* Top strip */}
        <header className="h-[56px] shrink-0 flex items-center justify-end gap-2 pt-2">
          {mounted && (
            <button
              onClick={toggleFullscreen}
              className="w-11 h-11 rounded-full flex items-center justify-center text-[#9AA8D0] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 transition-colors"
              title="Toggle Fullscreen"
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}
            </button>
          )}
          <Link
            href="/admin/login"
            className="w-11 h-11 rounded-full flex items-center justify-center text-[#9AA8D0] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 transition-colors"
            title="Admin Login"
            aria-label="Admin Login"
          >
            <Lock className="h-[18px] w-[18px]" />
          </Link>
        </header>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center justify-center w-full py-2">
          {/* Logo */}
          <div className="rise d1 mb-[clamp(20px,4vh,32px)]">
            <div className="float">
              <div
                className="hairline rounded-[22px]"
                style={{ boxShadow: '0 28px 80px -16px rgba(99,102,241,0.55), 0 0 0 1px rgba(255,255,255,0.04)' }}
              >
                <Image
                  src="/rb-logo.png"
                  alt="RB Maths Academy logo"
                  width={112}
                  height={112}
                  className="w-auto h-[clamp(84px,14vh,124px)] object-contain rounded-[22px] block"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1
            className={`rise d2 text-center ${jakarta.className} text-[30px] leading-[36px] min-[400px]:text-[34px] min-[400px]:leading-[40px] tracking-[-0.02em]`}
          >
            RB Maths <span className="grad-text">Portal</span>
          </h1>

          {/* Subtitle */}
          <p className="rise d3 text-center mt-3 text-[14px] min-[400px]:text-[15px] font-medium text-[#CFE8FF] tracking-wide max-w-[280px] opacity-90 italic">
            "If you are smart, the portal is smarter!"
          </p>

          <div
            className="rise d4 mt-5 mb-[clamp(24px,5vh,40px)] h-[2px] w-10 rounded-full"
            style={{ background: 'var(--brand)' }}
            aria-hidden="true"
          />

          {/* Login card */}
          <Link
            href="/student/login"
            onClick={handleNavigation}
            className="rise d5 hairline group block w-full rounded-[26px] p-[20px] backdrop-blur-xl transition-transform duration-200 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:ring-offset-[3px] focus-visible:ring-offset-[#05070F]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.025) 100%)',
              boxShadow: '0 40px 90px -30px rgba(0,0,0,0.8), 0 12px 40px -12px rgba(59,130,246,0.18)',
            }}
          >
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-[52px] h-[52px] rounded-[16px] flex items-center justify-center shrink-0 border border-white/10"
                style={{ background: 'linear-gradient(145deg, rgba(139,92,246,0.22), rgba(34,211,238,0.10))' }}
              >
                <User className="h-6 w-6 text-[#CFE8FF]" />
              </div>
              <div className="min-w-0">
                <h2 className={`text-[19px] leading-[24px] ${jakarta.className} font-bold text-white`}>Student Login</h2>
                <p className="text-[13px] leading-[18px] text-[#8E9BC4] mt-0.5">Access your learning dashboard</p>
              </div>
            </div>

            <div
              className="sweep relative overflow-hidden w-full h-[54px] rounded-[16px] flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #5B7CFF 0%, #8B5CF6 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 12px 32px -8px rgba(99,102,241,0.65)',
              }}
            >
              <span className="relative z-10 text-[16px] leading-[24px] font-semibold text-white tracking-[0.01em]">
                Enter Portal
              </span>
              <ArrowRight className="relative z-10 h-[18px] w-[18px] text-white transition-transform duration-300 group-hover:translate-x-[4px]" />
            </div>
          </Link>
        </main>

        {/* Footer */}
        <footer
          className="rise d6 shrink-0 pt-4 flex flex-col items-center gap-1 text-center"
          style={{ paddingBottom: 'max(18px, env(safe-area-inset-bottom))' }}
        >
          <p className="text-[12px] leading-[16px] text-[#7683AB]">
            Coded and developed by <span className="text-[#B4C0E6] font-medium">Dr. Ritwick Banerjee</span>
          </p>
          <p className="text-[11px] leading-[16px] text-[#56608299]">&copy; {new Date().getFullYear()} RB Maths Academy</p>
        </footer>
      </div>
    </div>
  );
}
