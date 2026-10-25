'use client';

import { Bell } from 'lucide-react';

interface NotificationProps {
    notification: {
        _id: string;
        title: string;
        message: string;
        link?: string;
        oncePerStudent?: boolean;
    };
    onComplete: () => void;
}

export default function NotificationPopupModal({ notification, onComplete }: NotificationProps) {
    // Personal alerts (homework warning / redo request) get a red look and a shortcut to the assignments
    const personal = !!notification.oncePerStudent;
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-end sm:items-center justify-center p-3 sm:p-4">
            <div className={`bg-[#140d27] rounded-2xl p-4 sm:p-6 max-w-xl w-full flex flex-col max-h-[85vh] pb-[max(1rem,env(safe-area-inset-bottom))] ${personal ? 'border border-rose-400/50 shadow-[0_0_40px_-8px_rgba(244,63,94,0.6)]' : 'border border-white/10'}`}>
                <div className="flex-1 overflow-y-auto mb-4 sm:mb-6 pr-1">
                    <div className="flex items-center gap-3 mb-4 sm:mb-6">
                        <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center shrink-0 ${personal ? 'bg-rose-500/20' : 'bg-orange-500/20'}`}>
                            <Bell className={`h-5 w-5 sm:h-6 sm:w-6 ${personal ? 'text-rose-400' : 'text-orange-500'}`} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-2xl font-black text-white leading-tight break-words">{notification.title}</h2>
                            <p className={`text-xs sm:text-sm font-medium ${personal ? 'text-rose-300' : 'text-orange-400'}`}>{personal ? 'For you' : 'Important Update'}</p>
                        </div>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 sm:p-5 border border-white/5">
                        <p className="text-gray-300 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
                            {notification.message}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    {personal && notification.link && (
                        <a
                            href={notification.link}
                            onClick={onComplete}
                            className="w-full text-center bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-rose-500/20"
                        >
                            View my assignments
                        </a>
                    )}
                    <button
                        onClick={onComplete}
                        className={`w-full font-bold py-3.5 rounded-xl transition-all ${personal ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-500/20'}`}
                    >
                        Okay
                    </button>
                </div>
            </div>
        </div>
    );
}
