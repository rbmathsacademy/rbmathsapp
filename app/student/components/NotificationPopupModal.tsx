'use client';

import { Bell } from 'lucide-react';

interface NotificationProps {
    notification: {
        _id: string;
        title: string;
        message: string;
    };
    onComplete: () => void;
}

export default function NotificationPopupModal({ notification, onComplete }: NotificationProps) {
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-xl w-full flex flex-col max-h-[90vh]">
                <div className="flex-1 overflow-y-auto mb-6 pr-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-12 w-12 rounded-2xl bg-orange-500/20 flex items-center justify-center shrink-0">
                            <Bell className="h-6 w-6 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">{notification.title}</h2>
                            <p className="text-sm font-medium text-orange-400">Important Update</p>
                        </div>
                    </div>
                    
                    <div className="bg-black/40 rounded-xl p-5 border border-white/5">
                        <p className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                            {notification.message}
                        </p>
                    </div>
                </div>

                <button
                    onClick={onComplete}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20"
                >
                    Okay
                </button>
            </div>
        </div>
    );
}
