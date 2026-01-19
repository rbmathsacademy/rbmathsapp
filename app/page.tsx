'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, User, Youtube, Globe, Lock } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050b14] text-white flex flex-col justify-center relative overflow-hidden selection:bg-purple-500/30 font-sans">

      {/* Admin Login - Discreet Button Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <Link href="/admin/login" className="p-2 text-slate-600 hover:text-purple-400 transition-colors opacity-50 hover:opacity-100">
          <Lock className="h-4 w-4" />
        </Link>
      </div>

      {/* Ambient Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 max-w-sm mx-auto px-4 text-center flex flex-col items-center justify-center min-h-screen py-6">

        {/* Logo Section */}
        <div className="mb-5 animate-in fade-in zoom-in duration-700">
          <div className="relative inline-block group cursor-default">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-black rounded-lg p-2">
              <img
                src="/rb-logo.png"
                alt="RB Maths Academy"
                className="h-24 w-auto mx-auto object-contain drop-shadow-2xl"
              />
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse">
            Question Bank Portal
          </h1>
        </div>

        {/* Social Links */}
        <div className="flex gap-4 mb-6 w-full justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <a
            href="https://www.youtube.com/@rbmaths"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600/10 border border-red-600/20 rounded-full text-red-500 hover:bg-red-600 hover:text-white transition-all duration-300 text-sm font-semibold hover:shadow-[0_0_15px_rgba(220,38,38,0.5)]"
          >
            <Youtube className="h-4 w-4" /> YouTube
          </a>
          <a
            href="https://www.rbmathsacademy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-600/20 rounded-full text-blue-500 hover:bg-blue-600 hover:text-white transition-all duration-300 text-sm font-semibold hover:shadow-[0_0_15px_rgba(37,99,235,0.5)]"
          >
            <Globe className="h-4 w-4" /> Website
          </a>
        </div>

        {/* Student Portal Card */}
        <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          <Link href="/student/login" className="group relative block p-5 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl hover:border-blue-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:-translate-y-1 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="h-12 w-12 mb-3 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <User className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white mb-0.5 group-hover:text-blue-300 transition-colors">Student Login</h2>
              <p className="text-slate-400 text-[10px] mb-3 max-w-xs mx-auto">Access your learning dashboard</p>
              <span className="inline-flex items-center text-blue-400 font-semibold text-xs group-hover:tracking-wide transition-all shadow-blue-500/50">
                Enter Portal <ArrowRight className="ml-2 h-3 w-3" />
              </span>
            </div>
          </Link>
        </div>

        {/* Credits */}
        <div className="mt-5 text-center animate-in fade-in duration-1000 delay-500">
          <p className="text-xs font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 drop-shadow-[0_0_8px_rgba(192,132,252,0.6)] animate-pulse">
            Coded and developed by Dr. Ritwick Banerjee
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            &copy; {new Date().getFullYear()} RB Maths Academy
          </p>
        </div>

      </div>
    </div>
  );
}
