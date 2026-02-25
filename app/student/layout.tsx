import { StudentProfileProvider } from './StudentProfileContext';

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col bg-[#0a0f1a]">
            <StudentProfileProvider>
                <div className="flex-1 w-full">
                    {children}
                </div>
            </StudentProfileProvider>
            <footer className="py-4 text-center bg-[#0a0f1a] text-gray-500 border-t border-white/5 mt-auto z-10 relative">
                <p className="text-[10px] md:text-sm">&copy; 2026, RB Maths Academy || Coded and developed by Dr. Ritwick Banerjee</p>
            </footer>
        </div>
    );
}
