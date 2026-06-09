'use client';

import { useState } from 'react';
import { AlertTriangle, TrendingDown, Settings, ChevronDown, ChevronUp, Users, Target } from 'lucide-react';
import toast from 'react-hot-toast';

interface AnomalyDetectionPanelProps {
    batch: string;
}

export default function AnomalyDetectionPanel({ batch }: AnomalyDetectionPanelProps) {
    const [loading, setLoading] = useState(false);
    const [anomalies, setAnomalies] = useState<any>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [gapThreshold, setGapThreshold] = useState(25);
    const [savingSettings, setSavingSettings] = useState(false);
    
    // Expanded sections state
    const [expandedMalpractice, setExpandedMalpractice] = useState<Record<string, boolean>>({});
    const [expandedDeteriorating, setExpandedDeteriorating] = useState<Record<string, boolean>>({});

    const runDetection = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/analytics/anomalies?batch=${encodeURIComponent(batch)}`, {
                headers: { 'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' }
            });
            if (!res.ok) throw new Error('Failed to run detection');
            const data = await res.json();
            setAnomalies(data);
            setGapThreshold(data.settings?.gapThreshold || 25);
            toast.success('Anomaly detection complete');
        } catch (error: any) {
            toast.error(error.message || 'Detection failed');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch('/api/admin/config/anomaly-settings', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Email': localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : '' 
                },
                body: JSON.stringify({ gapThreshold })
            });
            if (!res.ok) throw new Error('Failed to save settings');
            toast.success('Settings saved. Re-running detection...');
            setShowSettings(false);
            runDetection();
        } catch (error: any) {
            toast.error(error.message || 'Failed to save settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const toggleMalpractice = (id: string) => setExpandedMalpractice(p => ({...p, [id]: !p[id]}));
    const toggleDeteriorating = (id: string) => setExpandedDeteriorating(p => ({...p, [id]: !p[id]}));

    return (
        <div className="mb-8 space-y-4">
            <div className="flex items-center gap-3">
                <button 
                    onClick={runDetection}
                    disabled={loading || !batch}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 disabled:opacity-50 transition-all"
                >
                    {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <AlertTriangle className="w-4 h-4" />}
                    Detect Anomalies
                </button>
                <button onClick={() => setShowSettings(!showSettings)} className="p-2.5 bg-[#1a1f2e] border border-white/10 rounded-xl hover:bg-white/5 transition-colors text-slate-400 hover:text-white">
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            {showSettings && (
                <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-4 max-w-sm animate-in fade-in slide-in-from-top-2">
                    <h3 className="text-sm font-bold text-white mb-3">Anomaly Settings</h3>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                        Malpractice Gap Threshold (%)
                    </label>
                    <div className="flex items-center gap-3">
                        <input 
                            type="range" min="10" max="50" step="1" 
                            value={gapThreshold} onChange={e => setGapThreshold(Number(e.target.value))}
                            className="flex-1 accent-orange-500"
                        />
                        <span className="text-sm font-bold text-white w-8">{gapThreshold}%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 mb-3">Flags students where (Online Avg - Offline Avg) &gt; {gapThreshold}%</p>
                    <button onClick={saveSettings} disabled={savingSettings} className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors">
                        {savingSettings ? 'Saving...' : 'Save & Re-run'}
                    </button>
                </div>
            )}

            {anomalies && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    
                    {/* Potential Malpractice Section */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl overflow-hidden">
                        <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex justify-between items-center">
                            <h3 className="text-red-400 font-bold flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> Potential Malpractice
                                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full ml-2">{anomalies.malpracticeAlerts.length}</span>
                            </h3>
                        </div>
                        <div className="p-4">
                            {anomalies.malpracticeAlerts.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No malpractice anomalies detected.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {anomalies.malpracticeAlerts.map((alert: any, i: number) => (
                                        <div key={i} className="bg-[#1a1f2e] border border-white/5 rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-white text-sm">{alert.student.name}</div>
                                                    <div className="text-[10px] text-slate-500">{alert.student.phone}</div>
                                                </div>
                                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                                                    {alert.severity}
                                                </span>
                                            </div>
                                            
                                            <div className="space-y-2 mb-3">
                                                <div className="flex items-center text-xs">
                                                    <span className="w-20 text-slate-400">Online Avg:</span>
                                                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full mr-2"><div className="h-full bg-blue-400 rounded-full" style={{width: `${alert.onlineAvg}%`}}></div></div>
                                                    <span className="w-10 text-right text-blue-400 font-bold">{alert.onlineAvg}%</span>
                                                </div>
                                                <div className="flex items-center text-xs">
                                                    <span className="w-20 text-slate-400">Offline Avg:</span>
                                                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full mr-2"><div className="h-full bg-orange-400 rounded-full" style={{width: `${alert.offlineAvg}%`}}></div></div>
                                                    <span className="w-10 text-right text-orange-400 font-bold">{alert.offlineAvg}%</span>
                                                </div>
                                                <div className="flex items-center text-xs border-t border-white/5 pt-1 mt-1">
                                                    <span className="w-20 font-bold text-red-400">Gap:</span>
                                                    <div className="flex-1"></div>
                                                    <span className="w-10 text-right text-red-400 font-black">+{alert.gap}%</span>
                                                </div>
                                            </div>

                                            <button onClick={() => toggleMalpractice(alert.student.phone)} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white transition-colors py-1 bg-white/5 rounded">
                                                {expandedMalpractice[alert.student.phone] ? <><ChevronUp className="w-3 h-3"/> Hide Details</> : <><ChevronDown className="w-3 h-3"/> View Recent Tests</>}
                                            </button>
                                            
                                            {expandedMalpractice[alert.student.phone] && (
                                                <div className="mt-3 pt-3 border-t border-white/5 space-y-2 text-[10px]">
                                                    <div className="font-bold text-slate-300">Online (Latest 3)</div>
                                                    {alert.onlineTests.map((t:any, idx:number) => (
                                                        <div key={idx} className="flex justify-between text-slate-400"><span className="truncate pr-2">{t.title}</span><span className="text-blue-400 font-bold">{t.percentage}%</span></div>
                                                    ))}
                                                    <div className="font-bold text-slate-300 mt-2">Offline (Latest 3)</div>
                                                    {alert.offlineTests.map((t:any, idx:number) => (
                                                        <div key={idx} className="flex justify-between text-slate-400"><span className="truncate pr-2">{t.chapter}</span><span className="text-orange-400 font-bold">{t.percentage}%</span></div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Deteriorating Performance Section */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl overflow-hidden">
                        <div className="bg-amber-500/10 p-4 border-b border-amber-500/20 flex justify-between items-center">
                            <h3 className="text-amber-400 font-bold flex items-center gap-2">
                                <TrendingDown className="w-5 h-5" /> Deteriorating Performance
                                <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full ml-2">{anomalies.deterioratingAlerts.length}</span>
                            </h3>
                        </div>
                        <div className="p-4">
                            {anomalies.deterioratingAlerts.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No deteriorating trends detected.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {anomalies.deterioratingAlerts.map((alert: any, i: number) => (
                                        <div key={i} className="bg-[#1a1f2e] border border-white/5 rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-white text-sm">{alert.student.name}</div>
                                                    <div className="text-[10px] text-slate-500">{alert.student.phone}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-amber-400 font-black text-sm">-{alert.dropPercentage}%</div>
                                                    <div className="text-[9px] text-slate-500 uppercase">Recent Drop</div>
                                                </div>
                                            </div>
                                            
                                            {/* CSS Sparkline */}
                                            <div className="h-12 flex items-end justify-between gap-1 mb-3 pt-4 border-b border-white/5 pb-1">
                                                {alert.recentScores.map((score: number, idx: number) => (
                                                    <div key={idx} className="flex flex-col justify-end items-center gap-1 group relative">
                                                        <div className="absolute -top-5 opacity-0 group-hover:opacity-100 text-[9px] bg-black px-1 rounded text-white transition-opacity">{score}%</div>
                                                        <div className="w-4 bg-amber-500/40 rounded-t-sm hover:bg-amber-400 transition-colors" style={{ height: `${Math.max(score, 5)}%` }}></div>
                                                    </div>
                                                ))}
                                            </div>

                                            <button onClick={() => toggleDeteriorating(alert.student.phone)} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white transition-colors py-1 bg-white/5 rounded">
                                                {expandedDeteriorating[alert.student.phone] ? <><ChevronUp className="w-3 h-3"/> Hide Details</> : <><ChevronDown className="w-3 h-3"/> View Tests</>}
                                            </button>
                                            
                                            {expandedDeteriorating[alert.student.phone] && (
                                                <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 text-[10px]">
                                                    {alert.tests.map((t:any, idx:number) => (
                                                        <div key={idx} className="flex justify-between items-center">
                                                            <span className="text-slate-400 truncate pr-2 flex-1">{t.title}</span>
                                                            <span className={`font-bold w-8 text-right ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{t.percentage}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Consistently Poor Section */}
                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl overflow-hidden">
                        <div className="bg-orange-500/10 p-4 border-b border-orange-500/20 flex justify-between items-center">
                            <h3 className="text-orange-400 font-bold flex items-center gap-2">
                                <Target className="w-5 h-5" /> Consistently Poor Performance
                                <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full ml-2">{anomalies.poorPerformanceAlerts.length}</span>
                            </h3>
                        </div>
                        <div className="p-4">
                            {anomalies.poorPerformanceAlerts.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No consistently poor performance detected.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {anomalies.poorPerformanceAlerts.map((alert: any, i: number) => (
                                        <div key={i} className="bg-[#1a1f2e] border border-white/5 rounded-lg p-3 flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full border-4 border-orange-500/20 flex items-center justify-center shrink-0">
                                                <span className="text-orange-400 font-black text-sm">{alert.avgPercentage}%</span>
                                            </div>
                                            <div>
                                                <div className="font-bold text-white text-xs line-clamp-1">{alert.student.name}</div>
                                                <div className="text-[9px] text-slate-400 mt-0.5">Attempted: {alert.testsAttempted}</div>
                                                <div className="text-[9px] text-red-400">Missed: {alert.testsMissed}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
