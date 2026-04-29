import React, { useState, useMemo } from 'react';
import { useMedicines } from '../../hooks/useMedicines'; 
import { useAuth } from '../../contexts/AuthContext';
import { generateDoctorReport } from '../../utils/pdfGenerator';
import { 
    Check, 
    X, 
    Clock, 
    Calendar, 
    ChevronDown, 
    FileText, 
    Download, 
    Share2,
    Activity,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { useTranslation } from 'react-i18next';

const HistorySection = () => {
    const { t } = useTranslation();
    const { logs, medicines, updateLogStatus } = useMedicines();
    const { user } = useAuth();

    // NEW: Pagination State
    const [displayLimit, setDisplayLimit] = useState(15);
    const [isExporting, setIsExporting] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportDays, setReportDays] = useState(7);

    const now = new Date();

    // 1. FILTER: Show Past Logs + Due Pending Logs
    const allValidLogs = useMemo(() => {
        return logs.filter(log => {
            if (log.status !== 'pending') return true; 
            const logDate = new Date(log.date);
            return logDate <= now; 
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [logs, now]);

    // Calculate Quick Stats
    const stats = useMemo(() => {
        return {
            taken: allValidLogs.filter(l => l.status === 'taken').length,
            missed: allValidLogs.filter(l => l.status === 'missed' || l.status === 'skipped').length,
            total: allValidLogs.filter(l => l.status !== 'pending').length
        };
    }, [allValidLogs]);

    // Slice for pagination
    const visibleLogs = allValidLogs.slice(0, displayLimit);
    const hasMoreLogs = displayLimit < allValidLogs.length;

    // 2. GROUP BY DATE HELPER
    const groupLogsByDate = (logsArray) => {
        const groups = {};
        logsArray.forEach(log => {
            const dateObj = new Date(log.date);
            const dateStr = dateObj.toLocaleDateString([], { 
                weekday: 'long', month: 'short', day: 'numeric' 
            });
            
            const todayStr = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

            let header = dateStr;
            if (dateStr === todayStr) header = "Today";
            else if (dateStr === yesterdayStr) header = "Yesterday";

            if (!groups[header]) groups[header] = [];
            groups[header].push(log);
        });
        return groups;
    };

    const groupedLogs = groupLogsByDate(visibleLogs);

    const handleLoadMore = () => {
        // Instantly show 15 more logs from local state
        setDisplayLimit(prev => prev + 15);
    };

    // 3. TRIGGER EXPORT
    const triggerExport = async (action) => {
        setIsExporting(true);
        setShowReportModal(false); 
        try {
            const result = await generateDoctorReport(user, medicines, logs, reportDays, action);
            if (action === 'download' && result.success) {
                alert(`✅ ${result.message}`);
            }
        } catch (error) {
            console.error("PDF Generation failed", error);
            alert("Failed to generate report.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 pb-32 font-sans">
            
            {/* PREMIUM HEADER */}
            <div className="flex-shrink-0 bg-gradient-to-b from-blue-600 to-blue-700 px-6 pt-14 pb-8 rounded-b-[2.5rem] shadow-md sticky top-0 z-30">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
                            <Activity size={26} className="text-blue-200" /> 
                            {t('history.title', 'Log History')}
                        </h1>
                        <p className="text-blue-200 text-sm font-medium mt-1">Track your medication journey</p>
                    </div>
                    
                    <button 
                        onClick={() => setShowReportModal(true)}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-sm font-bold text-white transition-all active:scale-95 border border-white/20 shadow-sm"
                    >
                        {isExporting ? <span className="animate-spin">⌛</span> : <FileText size={18} />}
                        {t('history.report', 'Report')}
                    </button>
                </div>

                {/* Quick Stats Cards */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-blue-100 mb-1">
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            <span className="text-xs font-bold uppercase tracking-wider">Taken</span>
                        </div>
                        <p className="text-2xl font-black text-white">{stats.taken}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-blue-100 mb-1">
                            <XCircle size={16} className="text-red-400" />
                            <span className="text-xs font-bold uppercase tracking-wider">Missed</span>
                        </div>
                        <p className="text-2xl font-black text-white">{stats.missed}</p>
                    </div>
                </div>
            </div>

            {/* 🟢 TIMELINE CONTENT */}
            <div className="px-4 -mt-2 relative z-10">
                {Object.keys(groupedLogs).length > 0 ? (
                    <div className="space-y-6 pt-6">
                        {Object.entries(groupedLogs).map(([dateLabel, dayLogs]) => (
                            <div key={dateLabel} className="relative">
                                
                                {/* Timeline Line (Visual) */}
                                <div className="absolute left-[23px] top-8 bottom-0 w-0.5 bg-slate-200 z-0 hidden sm:block"></div>

                                {/* Date Badge */}
                                <div className="sticky top-[100px] z-20 mb-4 inline-flex items-center gap-2 bg-slate-100 border border-slate-200 px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 uppercase tracking-wider shadow-sm ml-2">
                                    <Calendar size={14} />
                                    {dateLabel}
                                </div>

                                {/* Logs Cards */}
                                <div className="space-y-3 sm:ml-12 ml-2">
                                    {dayLogs.map((log) => {
                                        const isPending = log.status === 'pending';
                                        const isTaken = log.status === 'taken';
                                        const isMissed = log.status === 'missed' || log.status === 'skipped';

                                        return (
                                            <div key={log._id} className={`relative bg-white rounded-2xl p-4 border shadow-sm transition-all flex items-center justify-between ${isPending ? 'border-orange-200 shadow-orange-100/50' : 'border-slate-100 hover:border-blue-200'}`}>
                                                
                                                <div className="flex items-center gap-4">
                                                    {/* Time Block */}
                                                    <div className="text-center min-w-[50px]">
                                                        <p className="text-sm font-black text-slate-800">{log.time}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Time</p>
                                                    </div>

                                                    {/* Divider */}
                                                    <div className="w-px h-8 bg-slate-100"></div>

                                                    {/* Medicine Info */}
                                                    <div>
                                                        <p className={`font-bold text-base ${isPending ? 'text-slate-900' : 'text-slate-700'}`}>
                                                            {log.medicineId?.name || t('common.unknown')}
                                                        </p>
                                                        {isPending && <span className="text-xs font-bold text-orange-500 flex items-center gap-1 mt-0.5"><Clock size={12}/> Due Now</span>}
                                                    </div>
                                                </div>

                                                {/* Status / Actions */}
                                                <div>
                                                    {isPending ? (
                                                        <div className="flex gap-2">
                                                            <button onClick={() => updateLogStatus(log._id, 'taken')} className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 active:scale-90 transition-all shadow-sm border border-emerald-100">
                                                                <Check size={20} strokeWidth={3} />
                                                            </button>
                                                            <button onClick={() => updateLogStatus(log._id, 'missed')} className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 active:scale-90 transition-all shadow-sm border border-red-100">
                                                                <X size={20} strokeWidth={3} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${isTaken ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                            {isTaken ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                                            {log.status.toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                            <FileText className="text-slate-300" size={36} />
                        </div>
                        <p className="text-slate-600 font-bold text-lg">{t('history.noHistory', 'No History Yet')}</p>
                        <p className="text-slate-400 text-sm mt-1 max-w-[250px]">
                            {t('history.noHistoryDesc', 'Your medication logs will appear here once you start taking them.')}
                        </p>
                    </div>
                )}

                {/*  LOAD MORE BUTTON */}
                {hasMoreLogs && (
                    <div className="mt-8 mb-10 flex justify-center">
                        <button 
                            onClick={handleLoadMore} 
                            className="bg-white border-2 border-blue-100 text-blue-600 px-6 py-3 rounded-2xl font-bold hover:bg-blue-50 active:scale-95 transition-all flex items-center gap-2 shadow-sm"
                        >
                            {t('history.loadOlder', 'Load Older History')} <ChevronDown size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* REPORT MODAL */}
            {showReportModal && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800">{t('history.exportReport', 'Export Report')}</h3>
                            <button onClick={() => setShowReportModal(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-500 mb-4 font-bold">{t('history.selectRange', 'Select Time Range')}</p>
                        
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <button 
                                onClick={() => setReportDays(7)}
                                className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${
                                    reportDays === 7 ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                                }`}
                            >
                                {t('history.last7Days', 'Last 7 Days')}
                            </button>
                            <button 
                                onClick={() => setReportDays(30)}
                                className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${
                                    reportDays === 30 ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                                }`}
                            >
                                {t('history.last30Days', 'Last 30 Days')}
                            </button>
                        </div>

                        <div className="space-y-3">
                            <button onClick={() => triggerExport('share')} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-blue-200">
                                <Share2 size={20} /> {t('history.shareReport', 'Share Report')}
                            </button>
                            <button onClick={() => triggerExport('download')} className="w-full py-4 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-slate-100">
                                <Download size={20} /> {t('history.saveToDevice', 'Save to Device')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="h-32 w-full flex-shrink-0 block"></div>

        </div>
    );
};

export default HistorySection;