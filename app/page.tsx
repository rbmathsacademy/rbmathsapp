'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, User } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050b14] text-white flex flex-col justify-center relative overflow-hidden selection:bg-purple-500/30">

      {/* Ambient Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

        {/* Logo Section */}
        <div className="mb-12 animate-in fade-in zoom-in duration-700">
          <div className="relative inline-block group cursor-default">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-black rounded-lg p-2">
              {/* Assuming the user wants exactly the new logo here. Size adjusted for visual balance */}
              <img
                src="/rb-logo.png"
                alt="RB Maths Academy"
                className="h-32 md:h-48 w-auto mx-auto object-contain drop-shadow-2xl"
              />
            </div>
          </div>
          <p className="mt-6 text-slate-400 text-lg md:text-xl font-medium tracking-wide">
            Question Bank Portal
          </p>
        </div>

        {/* Portal Entry Points */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">

          {/* Student Portal Card */}
          <Link href="/student/login" className="group relative block p-8 bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="h-16 w-16 mb-6 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 border border-blue-500/20">
                <User className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">Student Portal</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">Access your course materials, questions, and resources.</p>
              <span className="inline-flex items-center text-blue-400 font-semibold text-sm group-hover:tracking-wide transition-all">
                Student Login <ArrowRight className="ml-2 h-4 w-4" />
              </span>
            </div>
          </Link>

          {/* Admin Portal Card */}
          <Link href="/admin/login" className="group relative block p-8 bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="h-16 w-16 mb-6 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300 border border-purple-500/20">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">Admin Portal</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">Manage questions, courses, and student deployments.</p>
              <span className="inline-flex items-center text-purple-400 font-semibold text-sm group-hover:tracking-wide transition-all">
                Admin Login <ArrowRight className="ml-2 h-4 w-4" />
              </span>
            </div>
          </Link>

        </div>

        <div className="mt-16 text-slate-500 text-xs">
          &copy; {new Date().getFullYear()} RB Maths Academy. All rights reserved.
        </div>
      </div>
    </div>
  );
}
