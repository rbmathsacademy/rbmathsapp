'use client';

import { useState } from 'react';
import { Bell, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface NotificationProps {
    notification: {
        _id: string;
        title: string;
        message: string;
    };
    onComplete: () => void;
}

export default function NotificationPopupModal({ notification, onComplete }: NotificationProps) {
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleOkay = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/student/notifications/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: notification._id })
            });

            if (!res.ok) throw new Error('Failed to mark read');
            
            setShowSuccess(true);
            setTimeout(() => {
                onComplete();
            }, 1000);
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
            setSubmitting(false);
        }
    };

    if (showSuccess) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
                <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center max-w-sm w-full">
                    <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white text-center">Got it!</h3>
                </div>
            </div>
        );
    }

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
                    onClick={handleOkay}
                    disabled={submitting}
                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20"
                >
                    {submitting ? 'Processing...' : 'Okay'}
                </button>
            </div>
        </div>
    );
}
