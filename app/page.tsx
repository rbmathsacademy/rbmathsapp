import Link from 'next/link';
import { BookOpen, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 selection:bg-blue-500 selection:text-white font-sans">
      {/* Portal Selection View */}
      <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
            Select Your Portal
          </h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Student Portal Card */}
            <Link
              href="/student"
              className="group block p-8 rounded-lg text-center cursor-pointer bg-gray-800/60 backdrop-blur-sm border border-gray-600/30 transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="flex justify-center mb-4">
                <BookOpen className="h-12 w-12 text-blue-400" />
              </div>
              <h3 className="text-2xl font-semibold text-white">
                Student Portal
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                View attendance, View assignments, and submit your work.
              </p>
            </Link>

            {/* Admin Portal Card */}
            <Link
              href="/admin/login"
              className="group block p-8 rounded-lg text-center cursor-pointer bg-gray-800/60 backdrop-blur-sm border border-gray-600/30 transition-all duration-300 hover:-translate-y-1 hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/10"
            >
              <div className="flex justify-center mb-4">
                <ShieldCheck className="h-12 w-12 text-green-400" />
              </div>
              <h3 className="text-2xl font-semibold text-white">
                Admin Portal
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                Manage students, attendance, and assignments.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
