'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, Maximize2, Minimize2, User, ArrowRight, BookOpen, Clock, Smartphone } from 'lucide-react';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: '800', display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500'], display: 'swap' });

export default function Home() {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Sync initial fullscreen state if possible
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
      console.error("Fullscreen error:", err);
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
    <div className={`min-h-[100dvh] bg-[#0A0F24] text-[#F8FAFF] relative overflow-hidden flex flex-col items-center selection:bg-[#8B5CF6]/30 ${inter.className} ${isNavigating ? 'page-fade-out' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --brand-gradient: linear-gradient(120deg, #22D3EE 0%, #3B82F6 35%, #8B5CF6 70%, #EC4899 100%);
        }
        
        .fade-up {
          opacity: 0;
          animation: fadeUp 450ms forwards ease-out;
        }
        .delay-1 { animation-delay: 70ms; }
        .delay-2 { animation-delay: 140ms; }
        .delay-3 { animation-delay: 210ms; }
        .delay-4 { animation-delay: 280ms; }
        .delay-5 { animation-delay: 350ms; }
        .delay-6 { animation-delay: 420ms; }

        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }

        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        .animate-drift { animation: drift 20s ease-in-out infinite; }

        @keyframes shine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .btn-shine::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          background-size: 200% 100%;
          animation: shine 5s linear infinite;
          pointer-events: none;
        }

        @keyframes gradSlide {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .grad-text {
          background: var(--brand-gradient);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: gradSlide 6s ease infinite;
        }
        
        .page-fade-out {
          opacity: 0;
          transition: opacity 200ms ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-up, .animate-float, .animate-drift, .btn-shine::after, .grad-text {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
          .page-fade-out {
            transition: opacity 150ms ease-out;
          }
        }
        
        .math-bg {
          font-family: serif;
          position: absolute;
          color: #F8FAFF;
          opacity: 0.08;
          user-select: none;
          pointer-events: none;
        }
        
        .dot-grid {
          background-image: radial-gradient(rgba(248, 250, 255, 0.04) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}} />

      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden dot-grid">
        <div className="absolute top-[-10%] left-[-20%] w-[70vw] h-[70vw] max-w-[400px] max-h-[400px] rounded-full bg-[#8B5CF6] blur-[80px] opacity-[0.35] animate-drift" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[70vw] h-[70vw] max-w-[400px] max-h-[400px] rounded-full bg-[#22D3EE] blur-[80px] opacity-[0.35] animate-drift" style={{ animationDelay: '-10s' }} />
        
        {/* Math Symbols */}
        <div className="math-bg text-6xl top-[15%] left-[10%] rotate-12" aria-hidden="true">∑</div>
        <div className="math-bg text-8xl top-[40%] right-[5%] -rotate-12" aria-hidden="true">∫</div>
        <div className="math-bg text-7xl bottom-[25%] left-[8%] rotate-45" aria-hidden="true">√</div>
        <div className="math-bg text-5xl top-[60%] left-[20%] -rotate-6" aria-hidden="true">π</div>
        <div className="math-bg text-6xl bottom-[15%] right-[15%] rotate-12" aria-hidden="true">∞</div>
      </div>

      <div className="w-full max-w-[420px] flex flex-col min-h-[100dvh] relative z-10 px-[20px]">
        
        {/* Top Strip */}
        <header className="h-[48px] shrink-0 flex items-center justify-end">
          <div className="flex items-center">
            {mounted && (
              <button 
                onClick={toggleFullscreen}
                className="w-[44px] h-[44px] flex items-center justify-center text-[#A9B6DC] hover:text-[#F8FAFF] transition-colors"
                title="Toggle Fullscreen"
                aria-label="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
            )}
            <Link 
              href="/admin/login" 
              className="w-[44px] h-[44px] flex items-center justify-center text-[#A9B6DC] hover:text-[#F8FAFF] transition-colors"
              title="Admin Login"
              aria-label="Admin Login"
            >
              <Lock className="h-5 w-5" />
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center w-full py-4">
          
          {/* Logo */}
          <div className="fade-up delay-1 mb-6 animate-float">
            <Image 
              src="/rb-logo.png" 
              alt="RB Maths Academy Logo" 
              width={112} 
              height={112}
              className="w-auto h-[112px] object-contain rounded-[20px]"
              style={{ boxShadow: '0 0 48px rgba(139,92,246,0.45)' }}
              priority
            />
          </div>

          {/* Badge */}
          <div className="fade-up delay-2 flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(148,163,255,0.18)] bg-[#111A3A]/50 mb-5 text-center mx-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] shadow-[0_0_8px_rgba(251,191,36,0.8)] shrink-0" />
            <span className="text-[11px] min-[390px]:text-[12px] leading-[16px] font-medium text-[#A9B6DC] uppercase tracking-wide">RB Maths Portal - where Practice makes you perfect!</span>
          </div>

          {/* Title */}
          <h1 className={`fade-up delay-3 text-center ${jakarta.className} text-[30px] leading-[36px] min-[400px]:text-[32px] min-[400px]:leading-[38px] mb-4`}>
            Practice smarter.<br />
            <span className="grad-text">Score higher.</span>
          </h1>

          {/* Subtitle */}
          <p className="fade-up delay-4 text-center text-[16px] leading-[24px] text-[#A9B6DC] mb-8 max-w-[320px]">
            Your RB Maths Academy question bank, ready whenever you are. Log in and start practising.
          </p>

          {/* Student Login Card */}
          <Link 
            href="/student/login" 
            onClick={handleNavigation}
            className="fade-up delay-5 group block w-full bg-[#111A3A] rounded-[24px] p-[24px] border border-[rgba(148,163,255,0.18)] relative overflow-hidden transition-all duration-200 active:scale-[0.97] hover:brightness-[1.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:ring-offset-[3px] focus-visible:ring-offset-[#0A0F24]"
            style={{ boxShadow: '0 20px 60px rgba(59,130,246,0.18)' }}
          >
            {/* Top 1px gradient edge simulation */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-[rgba(148,163,255,0.1)] via-[rgba(148,163,255,0.4)] to-[rgba(148,163,255,0.1)]" />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-[56px] h-[56px] rounded-[16px] bg-[#18224A] border border-[rgba(148,163,255,0.18)] flex items-center justify-center shrink-0">
                <User className="h-7 w-7 text-[#22D3EE]" />
              </div>
              <div>
                <h2 className={`text-[20px] leading-[26px] font-bold ${jakarta.className} text-[#F8FAFF]`}>Student Login</h2>
                <p className="text-[12px] leading-[16px] text-[#A9B6DC] mt-0.5">Access your learning dashboard</p>
              </div>
            </div>

            <div 
              className="w-full h-[56px] rounded-[16px] flex items-center justify-center gap-2 relative overflow-hidden btn-shine"
              style={{ 
                background: 'var(--brand-gradient)', 
                boxShadow: '0 8px 24px rgba(99,102,241,0.45)'
              }}
            >
              <span className="text-[17px] leading-[24px] font-bold text-white relative z-10">Enter Portal</span>
              <ArrowRight className="h-5 w-5 text-white relative z-10 transition-transform duration-300 group-hover:translate-x-[4px]" />
            </div>
          </Link>

          {/* Optional Chips */}
          <div className="fade-up delay-6 flex flex-wrap justify-center gap-2 mt-8">
            <div className="h-[32px] px-3 rounded-full bg-[#111A3A] border border-[rgba(148,163,255,0.18)] flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-[#A9B6DC]" />
              <span className="text-[13px] font-medium text-[#A9B6DC]">Chapter-wise practice</span>
            </div>
            <div className="h-[32px] px-3 rounded-full bg-[#111A3A] border border-[rgba(148,163,255,0.18)] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#A9B6DC]" />
              <span className="text-[13px] font-medium text-[#A9B6DC]">Previous-year papers</span>
            </div>
            <div className="h-[32px] px-3 rounded-full bg-[#111A3A] border border-[rgba(148,163,255,0.18)] flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-[#A9B6DC]" />
              <span className="text-[13px] font-medium text-[#A9B6DC]">Mobile friendly</span>
            </div>
          </div>
          
        </main>

        {/* Footer */}
        <footer className="shrink-0 py-5 flex flex-col items-center gap-1">
          <p className="text-[12px] font-semibold grad-text">
            Coded and developed by Dr. Ritwick Banerjee
          </p>
          <p className="text-[12px] text-[#A9B6DC] opacity-70">
            &copy; {new Date().getFullYear()} RB Maths Academy
          </p>
        </footer>

      </div>
    </div>
  );
}
