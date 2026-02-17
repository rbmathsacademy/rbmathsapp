'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, AlertCircle, CheckCircle, Calendar, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from 'react-hot-toast';
import FeesReceiptModal from './FeesReceiptModal';

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
    studentName: string; // Changed from name to match API
    phoneNumber: string;
    courses: string[];
    createdAt: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FeesPayment() {
    const router = useRouter();
    const [student, setStudent] = useState<Student | null>(null);
    const [records, setRecords] = useState<FeeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<FeeRecord | null>(null);

    useEffect(() => {
        // Initial detection
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();

        // Listener
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. Fetch Profile
            const profileRes = await fetch('/api/student/me');
            if (!profileRes.ok) throw new Error('Unauthorized');
            const profileData = await profileRes.json();
            setStudent(profileData);

            // 2. Fetch Fees
            const feesRes = await fetch('/api/student/fees');
            if (feesRes.ok) {
                const data = await feesRes.json();
                setRecords(data.records || []);
            }
        } catch (error) {
            console.error(error);
            router.push('/student/login');
        } finally {
            setLoading(false);
        }
    };

    const getStatusForMonth = (year: number, monthIndex: number) => {
        if (!selectedBatch) return { status: 'PENDING', record: null };

        // Find records for this specific month AND selected batch
        // Using year/monthIndex from DB instead of date object to avoid timezone issues
        const monthRecords = records.filter(r => r.year === year && r.monthIndex === monthIndex && r.batch === selectedBatch);

        // Check for Payment
        const payment = monthRecords.find(r => r.recordType === 'PAYMENT' || !r.recordType);
        if (payment) return { status: 'PAID', record: payment };

        // Check for Exemption
        const exempted = monthRecords.find(r => r.recordType === 'EXEMPTED');
        if (exempted) return { status: 'EXEMPTED', record: exempted };

        // Check for New Admission
        const newAdmission = monthRecords.find(r => r.recordType === 'NEW_ADMISSION');
        if (newAdmission) return { status: 'NEW_ADMISSION', record: newAdmission };

        // Logic for "Before Admission"
        // Logic for "Before Admission"
        // Find the admission record (specific to batch)
        const admissionRecord = records.find(r => r.recordType === 'NEW_ADMISSION' && r.batch === selectedBatch);

        let admissionMonthIndex = 0; // Default Jan
        let admissionYear = 2025; // Default

        if (admissionRecord) {
            admissionMonthIndex = admissionRecord.monthIndex;
            admissionYear = admissionRecord.year;
        } else if (student?.createdAt) {
            // Fallback
            const d = new Date(student.createdAt);
            admissionMonthIndex = d.getMonth();
            admissionYear = d.getFullYear();
        }

        // Compare (year, monthIndex) vs (admissionYear, admissionMonthIndex)
        if (year < admissionYear || (year === admissionYear && monthIndex < admissionMonthIndex)) {
            return { status: 'BEFORE_ADMISSION', record: null };
        }

        return { status: 'PENDING', record: null };



        return { status: 'PENDING', record: null };
    };

    const handleReceiptClick = async (record: FeeRecord) => {
        if (!student) return;

        // Mobile: Open Modal
        if (isMobile) {
            setSelectedReceipt(record);
            return;
        }

        // Desktop: Generate PDF (Existing Logic)
        const doc = new jsPDF();

        // Load Logo
        const logoUrl = '/rb-logo.png';

        try {
            const img = new Image();
            img.src = logoUrl;
            await new Promise((resolve) => {
                img.onload = resolve;
            });

            // Stretch more horizontally while keeping aspect ratio? 
            // User says stretch horizontally but keep aspect ratio -> maybe they mean just make it wider but not too tall.
            // Original was 40x40. Let's try 60 x 20 or similar if it's a wide logo.
            // Or just larger. Let's try 50 width.
            const logoW = 50;
            const logoH = 20; // Adjusted for "stretched" look
            doc.addImage(logoUrl, 'PNG', 15, 10, logoW, logoH); // x, y, w, h

            // Institute Name Below Logo
            doc.setFontSize(18);
            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.text('R.B MATHS ACADEMY', 15 + (logoW / 2), 10 + logoH + 10, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Discover the Mathamagic!', 15 + (logoW / 2), 10 + logoH + 15, { align: 'center' });
        } catch (e) {
            console.error("Could not load logo", e);
        }

        // Horizontal Line
        doc.setDrawColor(200, 200, 200);
        doc.line(10, 55, 200, 55);

        // Receipt Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('FEE RECEIPT', 105, 65, { align: 'center' });

        const startY = 80;
        const lineHeight = 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        // Invoice No
        doc.text(`Invoice No:`, 20, startY);
        doc.setFont('helvetica', 'bold');
        doc.text(`${record.invoiceNo}`, 50, startY);

        // Remove Date Entry and Add "Paid In" entry
        const entryDate = new Date(record.entryDate);
        const paidInMonth = MONTHS[entryDate.getMonth()];
        const paidInYear = entryDate.getFullYear();

        doc.setFont('helvetica', 'normal');
        doc.text(`This fee was paid in:`, 120, startY);
        doc.setFont('helvetica', 'bold');
        doc.text(`${paidInMonth} ${paidInYear}`, 160, startY);

        // Info Block
        const infoY = startY + 20;

        doc.setFillColor(245, 247, 250);
        doc.rect(15, infoY - 5, 180, 50, 'F');

        doc.setFont('helvetica', 'normal');
        doc.text(`Student Name:`, 20, infoY);
        doc.setFont('helvetica', 'bold');
        doc.text(`${student.studentName}`, 60, infoY);

        doc.setFont('helvetica', 'normal');
        doc.text(`Batch:`, 20, infoY + lineHeight);
        doc.setFont('helvetica', 'bold');
        doc.text(`${record.batch}`, 60, infoY + lineHeight);

        doc.setFont('helvetica', 'normal');
        doc.text(`Fee Month:`, 20, infoY + lineHeight * 2);
        doc.setFont('helvetica', 'bold');
        doc.text(`${MONTHS[record.monthIndex]} ${record.year}`, 60, infoY + lineHeight * 2);

        doc.setFont('helvetica', 'normal');
        doc.text(`Amount Paid:`, 20, infoY + lineHeight * 3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 150, 0);
        doc.text(`₹ ${record.amount}/-`, 60, infoY + lineHeight * 3);
        doc.setTextColor(40, 40, 40);

        // Disclaimer
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Disclaimer: This is a computer generated receipt. If there is any discrepancy, please contact the admin.', 105, 280, { align: 'center' });

        // Generate Blob and Open in New Window (Better for App Browsers/WebViews)
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
        toast.success('Receipt Opened!');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-blue-400 animate-pulse">Loading...</div>
            </div>
        );
    }

    // Years for dropdown
    const years = [selectedYear - 1, selectedYear, selectedYear + 1];

    return (
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 relative overflow-hidden">
            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#050b14]/70 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => selectedBatch ? setSelectedBatch(null) : router.push('/student')} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-all">
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <h1 className="text-sm font-bold text-white">My <span className="text-pink-400">Fees</span></h1>
                    </div>
                </div>
            </header>

            {!selectedBatch ? (
                <main className="max-w-md mx-auto px-4 py-12 relative z-10">
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
                        <h1 className="text-2xl font-bold text-white mb-2">Select Batch</h1>
                        <p className="text-slate-400 text-sm mb-6">Choose a batch to view fee details</p>

                        <div className="space-y-3">
                            {student?.courses && student.courses.length > 0 ? (
                                student.courses.map(batch => (
                                    <button
                                        key={batch}
                                        onClick={() => setSelectedBatch(batch)}
                                        className="w-full text-left p-4 rounded-xl bg-slate-800/50 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 transition-all group"
                                    >
                                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400">{batch}</h3>
                                        <p className="text-xs text-slate-500">Click to view fees</p>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    No batches assigned.
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            ) : (
                <main className="max-w-7xl mx-auto px-4 py-12 relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Fee Calendar</h2>
                            <p className="text-xs text-slate-400 mt-1">{selectedBatch}</p>
                        </div>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="bg-slate-800 border-white/10 rounded-lg px-4 py-2 text-sm focus:ring-pink-500"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
                        {MONTHS.map((monthName, index) => {
                            const { status, record } = getStatusForMonth(selectedYear, index);

                            let cardClass = "bg-slate-900/60 border-white/10";

                            if (status === 'PAID') {
                                cardClass = "bg-green-950/30 border-green-500/30 hover:border-green-500 hover:bg-green-900/20 cursor-pointer group";
                            } else if (status === 'NEW_ADMISSION' || status === 'BEFORE_ADMISSION' || status === 'EXEMPTED') {
                                cardClass = "bg-slate-900/40 border-white/5 opacity-60";
                            } else {
                                // Pending
                                cardClass = "bg-red-950/20 border-red-500/20";
                            }

                            return (
                                <div
                                    key={monthName}
                                    className={`relative rounded-xl md:rounded-2xl p-2 md:p-6 border transition-all duration-300 ${cardClass} flex flex-col justify-between min-h-[100px] md:min-h-auto`}
                                    onClick={() => status === 'PAID' && record ? handleReceiptClick(record) : null}
                                >
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-start mb-2 md:mb-4">
                                        <div className="text-xs md:text-lg font-bold text-slate-200 truncate w-full">{monthName}</div>
                                        <div className="text-[10px] md:text-xs font-mono text-slate-500">{selectedYear}</div>
                                    </div>

                                    {status === 'PAID' && record ? (
                                        <>
                                            <div className="flex flex-col gap-0.5 md:gap-1 mb-1 md:mb-4">
                                                <div className="text-[10px] md:text-xs text-green-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                                    <CheckCircle className="h-2 w-2 md:h-3 md:w-3" /> <span className="hidden md:inline">Paid</span>
                                                </div>
                                                <div className="text-sm md:text-2xl font-bold text-white">₹{record.amount}</div>
                                                <div className="hidden md:block text-[10px] text-slate-400 truncate">Inv: {record.invoiceNo}</div>
                                                <div className="md:hidden text-[9px] text-green-400/80 mt-0.5 font-medium">Click to view</div>
                                            </div>
                                            <div className="hidden md:flex items-center gap-2 text-xs text-green-300 font-medium group-hover:underline">
                                                <Download className="h-3 w-3" /> Click to view receipt
                                            </div>
                                        </>
                                    ) : status === 'NEW_ADMISSION' ? (
                                        <div className="h-10 md:h-20 flex items-center justify-center text-slate-500 text-[8px] md:text-xs text-center px-1 md:px-4 leading-tight">
                                            New<br className="md:hidden" />Adm
                                        </div>
                                    ) : status === 'EXEMPTED' ? (
                                        <div className="h-10 md:h-20 flex items-center justify-center text-slate-500 text-[8px] md:text-xs text-center px-1 md:px-4 leading-tight">
                                            Exempt
                                        </div>
                                    ) : status === 'BEFORE_ADMISSION' ? (
                                        <div className="h-10 md:h-20 flex items-center justify-center text-slate-600 text-[8px] md:text-xs text-center px-1 md:px-4">
                                            --
                                        </div>
                                    ) : (
                                        <div className="h-10 md:h-20 flex flex-col items-center justify-center gap-1 md:gap-2 text-red-400/80">
                                            <AlertCircle className="h-4 w-4 md:h-6 md:w-6 opacity-50" />
                                            <span className="text-[8px] md:text-xs">Unpaid</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-12 text-center text-xs text-slate-600">
                        <p>Designed and Developed by Dr. Ritwick Banerjee</p>
                    </div>
                </main>
            )
            }


            {/* Start of Modal Render Logic */}
            {selectedReceipt && student && (
                <FeesReceiptModal
                    record={selectedReceipt}
                    student={student}
                    onClose={() => setSelectedReceipt(null)}
                />
            )}
            {/* End of Modal Render Logic */}
        </div >
    );
}
