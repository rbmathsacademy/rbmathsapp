import { X, CheckCircle, Download } from 'lucide-react';
import React from 'react';

interface FeeRecord {
    _id: string;
    invoiceNo: string;
    amount: number;
    paymentMode: string;
    entryDate: string;
    feesMonth: string; // ISO Date
    year: number;
    monthIndex: number;
    recordType: 'PAYMENT' | 'NEW_ADMISSION' | 'EXEMPTED';
    remarks?: string;
    student: string; // ID
    batch: string;
}

interface Student {
    studentName: string;
    phoneNumber: string;
    courses: string[];
    createdAt: string;
}

interface FeesReceiptModalProps {
    record: FeeRecord;
    student: Student;
    onClose: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FeesReceiptModal({ record, student, onClose }: FeesReceiptModalProps) {
    if (!record || !student) return null;

    const entryDate = new Date(record.entryDate);
    const paidInMonth = MONTHS[entryDate.getMonth()];
    const paidInYear = entryDate.getFullYear();

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white text-slate-900 w-full max-w-sm rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header / Logo Area */}
                <div className="p-4 flex flex-col items-center border-b border-slate-100 bg-slate-50 relative">
                    <button
                        onClick={onClose}
                        className="absolute right-3 top-3 p-1 rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="h-10 w-auto mb-2 relative">
                        <img src="/rb-logo.png" alt="Logo" className="h-full object-contain" />
                    </div>

                    <h2 className="text-lg font-bold text-slate-800 text-center leading-tight">R.B MATHS ACADEMY</h2>
                    <p className="text-[10px] text-slate-500 text-center">Discover the Mathamagic!</p>
                </div>

                {/* Receipt Body */}
                <div className="p-5 overflow-y-auto">
                    <div className="text-center mb-6">
                        <span className="inline-block px-3 py-1 rounded border border-slate-200 text-xs font-bold tracking-widest text-slate-600 bg-slate-50 shadow-sm">
                            FEE RECEIPT
                        </span>
                    </div>

                    <div className="flex justify-between items-end mb-6 text-xs border-b border-dashed border-slate-300 pb-4">
                        <div>
                            <p className="text-slate-500 mb-0.5">Invoice No</p>
                            <p className="font-bold font-mono text-slate-700 text-sm">{record.invoiceNo}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-500 mb-0.5">Paid In</p>
                            <p className="font-bold text-slate-700">{paidInMonth} {paidInYear}</p>
                        </div>
                    </div>

                    <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Student Name</p>
                            <p className="font-bold text-slate-800 text-sm">{student.studentName}</p>
                        </div>

                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Batch</p>
                            <p className="font-bold text-slate-800 text-sm">{record.batch}</p>
                        </div>

                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Fee Month</p>
                                <p className="font-bold text-slate-800 text-sm">{MONTHS[record.monthIndex]} {record.year}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Amount Paid</p>
                                <p className="font-bold text-emerald-600 text-lg">₹ {record.amount}/-</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 text-center">
                        <p className="text-[9px] text-slate-400 leading-relaxed">
                            Disclaimer: This is a computer generated receipt. If there is any discrepancy, please contact the admin.
                        </p>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                    >
                        Close Receipt
                    </button>
                </div>
            </div>
        </div>
    );
}
