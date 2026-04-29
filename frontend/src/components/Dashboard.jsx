import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { useMedicines } from '../hooks/useMedicines';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { Network } from '@capacitor/network';
import { Check, AlertCircle, Clock, Circle, Bell, Users } from "lucide-react";
import PendingReviewModal from './PendingReviewModal';
import AiChatbot from './AiChatbot';
import ProfilePopup from './ProfilePopup';
import { useTranslation } from 'react-i18next';

// --- HELPERS ---
const openAppDetails = async () => {
    try {
        await NativeSettings.open({
            optionAndroid: AndroidSettings.ApplicationDetails,
            optionIOS: IOSSettings.App
        });
    } catch (err) {
        alert("Please go to Settings > Apps > MedMind > Permissions.");
    }
};

// Formats ISODate to safe locale time
const formatTimeSafe = (dateObj) => {
    if (!dateObj) return "";
    try {
        const d = new Date(dateObj);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
        return "";
    }
};

// Formats "HH:mm" (24h) string to beautiful 12h object
const format12Hour = (time24) => {
    if (!time24) return { time: "", ampm: "" };
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return {
        time: `${hours}:${m}`,
        ampm: suffix,
        full: `${hours}:${m} ${suffix}`
    };
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();
    
    const { medicines, logs, syncOfflineData, lastSyncTime, updateLogStatus, loading } = useMedicines();
    const { permission } = useNotifications();
    
    const [nextDose, setNextDose] = useState(null);
    const [todayStats, setTodayStats] = useState({ taken: 0, total: 0, percentage: 0 });
    const [todaysDoses, setTodaysDoses] = useState([]); 
    const [isOnline, setIsOnline] = useState(true);
    const [now, setNow] = useState(new Date()); 
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [overdueLogs, setOverdueLogs] = useState([]);
    const [processedLogIds, setProcessedLogIds] = useState(new Set());
    const hasClosedModalRef = useRef(false);

    const handleCloseModal = () => {
        hasClosedModalRef.current = true; 
        setShowReviewModal(false);
    };

    useEffect(() => {
        checkPermissions();
        checkNetwork();
        
        const listener = Network.addListener('networkStatusChange', status => {
            setIsOnline(status.connected);
        });
        
        syncOfflineData();

        const timer = setInterval(() => setNow(new Date()), 60000);

        return () => { 
            listener.remove && listener.remove(); 
            clearInterval(timer);
         };
    }, []);

    useEffect(() => {
        calculateDashboardStats();
    }, [medicines, logs, now]); 

    const checkNetwork = async () => {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
    };

    const checkPermissions = async () => {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
            await LocalNotifications.requestPermissions();
        }
    };

    const calculateDashboardStats = () => {
        const currentNow = new Date();
        const todayStr = currentNow.toISOString().split('T')[0];
        
        const todayStart = new Date(); 
        todayStart.setHours(0,0,0,0);
        
        const todayEnd = new Date(); 
        todayEnd.setHours(23,59,59,999);

        let totalScheduledCount = 0;
        let takenCount = 0;
        let dailySchedule = [];
        let pendingOverdue = [];

        medicines.forEach(med => {
            if (!med.isActive || med.isPaused) return;

            const startDate = new Date(med.duration.startDate);
            startDate.setHours(0,0,0,0);
            
            const endDate = new Date(med.duration.endDate);
            endDate.setHours(23,59,59,999);

            if (todayEnd < startDate || todayStart > endDate) return;

            med.times.forEach(time => {
                totalScheduledCount++;

                const existingLog = logs.find(log => {
                    const logMedId = log.medicineId?._id || log.medicineId;
                    const targetMedId = med._id;
                    return logMedId === targetMedId && log.date.startsWith(todayStr) && log.time === time;
                });

                let status = 'pending';
                let logId = null;
                if (existingLog) {
                    status = existingLog.status;
                    logId = existingLog._id;
                    if (status === 'taken') takenCount++;
                }

                if (logId && processedLogIds.has(logId)) {
                    if (status === 'pending') status = 'taken'; 
                }

                const [h, m] = time.split(':').map(Number);
                const doseTime = new Date();
                doseTime.setHours(h, m, 0, 0);

                dailySchedule.push({
                    id: `${med._id}-${time}`,
                    medicineId: med._id,
                    name: med.name,
                    dose: med.dose,
                    time: time,
                    dateObj: doseTime,
                    status: status
                });

                if (existingLog && status === 'pending' && doseTime < currentNow) {
                    if (!processedLogIds.has(existingLog._id)) {
                        pendingOverdue.push(existingLog);
                    }
                }
            });
        });

        const percentage = totalScheduledCount > 0 ? Math.round((takenCount / totalScheduledCount) * 100) : 0;
        setTodayStats({ taken: takenCount, total: totalScheduledCount, percentage });

        dailySchedule.sort((a, b) => a.dateObj - b.dateObj);
        setTodaysDoses(dailySchedule);

        const upcoming = dailySchedule.find(d => d.dateObj > currentNow && d.status === 'pending');
        setNextDose(upcoming || null);

        if (!hasClosedModalRef.current && pendingOverdue.length > 0 && !loading) {
            setOverdueLogs(pendingOverdue);
            setShowReviewModal(true);
        } else if (pendingOverdue.length === 0) {
            setShowReviewModal(false);
            setOverdueLogs([]);
        }
    };

   const handleReviewAction = async (logId, status) => {
        setOverdueLogs(prevLogs => {
            const newList = prevLogs.filter(log => log._id !== logId);
            if (newList.length === 0) setShowReviewModal(false);
            return newList;
        });

        setProcessedLogIds(prev => new Set(prev).add(logId));
        await updateLogStatus(logId, status);
    };

    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (todayStats.percentage / 100) * circumference;

    if (loading && medicines.length === 0) {
        return (
            <div className="bg-slate-50 min-h-full pb-24">
                <div className="bg-gradient-to-b from-green-200 to-green-100 px-6 pt-12 pb-8 rounded-b-[2.5rem] mb-6 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="h-8 w-40 bg-green-300/50 rounded-lg animate-pulse mb-3"/>
                            <div className="h-4 w-48 bg-green-300/50 rounded-lg animate-pulse"/>
                        </div>
                        <div className="w-14 h-14 bg-green-300/50 rounded-2xl animate-pulse"/>
                    </div>
                    <div className="mt-6 h-6 w-32 bg-green-300/50 rounded-full animate-pulse"/>
                </div>

                <div className="px-5 space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 flex items-center justify-between shadow-sm">
                        <div>
                            <div className="h-5 w-24 bg-slate-100 rounded animate-pulse mb-3"/>
                            <div className="h-8 w-32 bg-slate-100 rounded animate-pulse"/>
                        </div>
                        <div className="w-20 h-20 bg-slate-100 rounded-full animate-pulse"/>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl p-6 flex justify-between items-center shadow-md">
                        <div>
                            <div className="h-3 w-16 bg-white/20 rounded animate-pulse mb-4"/>
                            <div className="h-10 w-36 bg-white/20 rounded animate-pulse mb-3"/>
                            <div className="h-5 w-48 bg-white/20 rounded animate-pulse"/>
                        </div>
                        <div className="w-16 h-16 bg-white/10 rounded-2xl animate-pulse"/>
                    </div>

                    <div>
                        <div className="h-5 w-36 bg-slate-200 rounded animate-pulse mb-5"/>
                        {[1,2,3].map(i => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 mb-3 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-[65px] h-[55px] bg-slate-100 rounded-xl animate-pulse"/>
                                    <div>
                                        <div className="h-5 w-32 bg-slate-100 rounded animate-pulse mb-2"/>
                                        <div className="h-3 w-20 bg-slate-100 rounded animate-pulse"/>
                                    </div>
                                </div>
                                <div className="w-10 h-10 bg-slate-100 rounded-full animate-pulse"/>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        // 🟢 THE FIX: Replaced min-h-full with h-[100dvh] w-full overflow-y-auto
            <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 font-sans pb-32">
                        
                {/* --- MODERN HEADER --- */}
                {/* 🟢 THE FIX: Changed pt-12 to pt-14 (for notch clearance) and added flex-shrink-0 */}
                <div className="flex-shrink-0 bg-gradient-to-b from-green-200 to-green-100/90 px-6 pt-14 pb-8 rounded-b-[2.5rem] shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-6 sticky top-0 z-40 border-b border-slate-100/50 backdrop-blur-xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
                                {t('dashboard.greeting', { name: user?.name?.split(' ')[0] || 'Friend' })}
                            </h1>
                            <p className="text-slate-600 text-sm mt-1.5 font-medium">{t('dashboard.subtitle')}</p>
                        </div>

                    {/* NEW CAREGIVER / FAMILY HUB BUTTON */}
                    <button 
                        onClick={() => navigate('/family')}
                        className="relative w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-white/60 active:scale-95 transition-transform"
                    >
                        {/* Optional: You can add a red dot if they have a pending invite */}
                        <Users size={24} strokeWidth={2.5} />
                    </button>
                </div>

                {/* SYNC STATUS */}
                <div className="mt-6 flex items-center space-x-2 text-xs font-bold text-slate-600 bg-white/60 backdrop-blur-md px-3.5 py-2 rounded-full inline-flex shadow-sm border border-white/50">
                    <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'} shadow-sm`}></span>
                    <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
                    <span className="text-slate-300 mx-1">•</span>
                    <span className="opacity-80">
                        {lastSyncTime ? `Synced: ${formatTimeSafe(lastSyncTime)}` : 'Sync Pending...'}
                    </span>
                </div>
            </div>

            <div className="px-5 space-y-7">
                
                {/* PERMISSIONS WARNING */}
                {permission !== 'granted' && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                        <div className="text-red-700 text-sm font-bold flex items-center">
                            <Bell className="mr-2 text-red-500" size={18} /> Enable Notifications
                        </div>
                        <button onClick={openAppDetails} className="bg-white text-red-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm border border-red-100 active:scale-95">
                            Fix Now
                        </button>
                    </div>
                )}

                {/* --- DAILY PROGRESS CARD --- */}
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center justify-between relative overflow-hidden">
                    <div className="z-10">
                        <h3 className="font-extrabold text-slate-800 text-lg">{t('dashboard.dailyGoal')}</h3>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="font-black text-blue-600 text-3xl">{todayStats.taken}</span>
                            <span className="text-slate-400 font-bold text-sm">/ {todayStats.total} {t('dashboard.dosesTaken', { taken: "", total: "" }).trim()}</span>
                        </div>
                    </div>
                    <div className="relative w-20 h-20 z-10 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="40" cy="40" r={radius} stroke="#f1f5f9" strokeWidth="7" fill="transparent" />
                            <circle cx="40" cy="40" r={radius} stroke="#3b82f6" strokeWidth="7" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-700">
                            {todayStats.percentage}%
                        </div>
                    </div>
                </div>

                {/* --- UP NEXT CARD (MODERN) --- */}
                <div className="bg-gradient-to-br from-indigo-500 via-blue-600 to-blue-700 rounded-[2rem] p-6 text-white shadow-[0_10px_30px_rgba(37,99,235,0.25)] relative overflow-hidden">
                    {/* Decorative background blur */}
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                        <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Clock size={12} /> {t('dashboard.upNext')}
                        </p>
                        {nextDose ? (
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="flex items-baseline gap-1.5 mb-1.5">
                                        <span className="text-5xl font-black tracking-tighter leading-none">
                                            {format12Hour(nextDose.time).time}
                                        </span>
                                        <span className="text-sm font-bold text-blue-200 uppercase">
                                            {format12Hour(nextDose.time).ampm}
                                        </span>
                                    </div>
                                    <p className="text-xl font-extrabold tracking-tight opacity-95">{nextDose.name}</p>
                                    <div className="mt-2 inline-flex">
                                        <span className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">
                                            {nextDose.dose}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-16 h-16 bg-white/10 rounded-[1.25rem] backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                                    <span className="text-3xl">💊</span>
                                </div>
                            </div>
                        ) : (
                            <div className="py-2">
                                <p className="text-3xl font-black tracking-tight mb-2">{t('dashboard.allCaughtUp')}</p>
                                <span className="bg-white/20 px-3 py-1.5 rounded-lg text-sm font-bold backdrop-blur-md inline-block">
                                    {t('dashboard.noPending')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- SCHEDULE LIST --- */}
                <div>
                    <div className="flex justify-between items-end mb-5 px-1">
                        <h3 className="font-extrabold text-slate-800 text-xl">{t('dashboard.todaySchedule')}</h3>
                    </div>
                    
                    {todaysDoses.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                            <span className="text-5xl block mb-3 opacity-40">☕</span>
                            <p className="text-slate-400 text-sm font-bold">{t('dashboard.noMedicines')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {todaysDoses.map((dose) => {
                                const isTaken = dose.status === 'taken';
                                const isLate = !isTaken && dose.dateObj < now;
                                const time12 = format12Hour(dose.time);
                                
                                return (
                                    <div key={dose.id} className={`flex items-center justify-between p-4 rounded-[1.25rem] border transition-all duration-300 ${
                                        isTaken 
                                            ? 'bg-emerald-50/60 border-emerald-100/50' 
                                            : isLate 
                                                ? 'bg-red-50/80 border-red-100/80'
                                                : 'bg-white border-slate-100 shadow-[0_4px_15px_rgb(0,0,0,0.02)]'
                                    }`}>
                                        
                                        {/* Left Side: Massive Time & Details */}
                                        <div className="flex items-center gap-4">
                                            {/* Time Block */}
                                            <div className={`flex flex-col items-center justify-center min-w-[70px] h-[60px] rounded-xl ${
                                                isTaken ? 'bg-emerald-100/60 text-emerald-700' : 
                                                isLate ? 'bg-red-100/60 text-red-700' :
                                                'bg-slate-100/80 text-slate-700'
                                            }`}>
                                                <span className="text-xl font-black leading-none tracking-tight">{time12.time}</span>
                                                <span className="text-[10px] font-extrabold mt-0.5 uppercase opacity-80">{time12.ampm}</span>
                                            </div>
                                            
                                            {/* Name & Dose */}
                                            <div>
                                                <h4 className={`text-base font-extrabold leading-tight ${
                                                    isTaken ? 'text-emerald-900 line-through decoration-emerald-900/30 opacity-70' : 
                                                    isLate ? 'text-red-900' :
                                                    'text-slate-800'
                                                }`}>
                                                    {dose.name}
                                                </h4>
                                                <p className={`text-xs font-bold mt-1 ${
                                                    isTaken ? 'text-emerald-700/60' : 
                                                    isLate ? 'text-red-600/70' : 
                                                    'text-slate-400'
                                                }`}>
                                                    {dose.dose}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Side: Status Icon */}
                                        <div className="pr-1 flex-shrink-0">
                                            {isTaken ? (
                                                <div className="w-10 h-10 flex items-center justify-center bg-emerald-100 rounded-full text-emerald-600 shadow-sm">
                                                    <Check size={20} strokeWidth={3} />
                                                </div>
                                            ) : isLate ? (
                                                <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-full text-red-500 shadow-sm">
                                                    <AlertCircle size={20} strokeWidth={2.5} />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-300 border-2 border-slate-200">
                                                    <Circle size={20} strokeWidth={2.5} className="opacity-0" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                <div className="h-4"></div>
            </div>

            {/* POPUP: Only shows if there are overdue logs */}
            {showReviewModal && overdueLogs.length > 0 && (
                <PendingReviewModal 
                    logs={overdueLogs}
                    onAction={handleReviewAction}
                    onClose={handleCloseModal} 
                />
            )}
            
            <AiChatbot/>

            <div className="h-32 w-full flex-shrink-0 block"></div>

        </div>
    );
};

export default Dashboard;
