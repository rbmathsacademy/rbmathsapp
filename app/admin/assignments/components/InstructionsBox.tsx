import { Info } from 'lucide-react';

export default function InstructionsBox({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
            <div className="bg-gray-800/50 px-6 py-3 border-b border-gray-700 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-white">Instructions & Guidelines</h3>
            </div>
            <div className="p-6 text-sm text-gray-300 space-y-3 leading-relaxed">
                {children}
            </div>
        </div>
    );
}
