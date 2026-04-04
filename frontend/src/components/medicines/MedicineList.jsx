import React, { useState } from 'react';
import { useMedicines } from '../../hooks/useMedicines';
import { cancelAllAlarms } from '../../utils/LocalNotificationManager';
import ConfirmationModal from '../ConfirmationModal'; 
import { useTranslation } from 'react-i18next';

// 🎨 PRO ICONS (Switched completely to lucide-react)
import { 
    Pill, Clock, CalendarDays, Bell, BellOff, 
    Pencil, Trash2, Play, Pause, RefreshCw, 
    X, WifiOff, AlertCircle
} from "lucide-react";

// --- HELPERS ---
const format12Hour = (time24) => {
    if (!time24) return { time: "", ampm: "" };
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return { time: `${hours}:${m}`, ampm: suffix };
};

const MedicineList = ({ onEdit }) => {
    const { t } = useTranslation();
    const { medicines, loading, deleteMedicine, toggleMuteMedicine, togglePauseMedicine, syncAlarms } = useMedicines();
    const [isSyncing, setIsSyncing] = useState(false);

    // --- MODAL STATE CONFIGURATION ---
    const [modalConfig, setModalConfig] = useState({
        isOpen: false, title: "", message: "", confirmText: "Confirm", cancelText: "Cancel", isDanger: false, onConfirm: () => {}, 
    });

    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    // --- 🟢 ACCURATE STATUS LOGIC (Fixes the Expiration Bug down to the minute) ---
    const getMedicineStatus = (medicine) => {
        if (medicine.isPaused) return 'paused';
        
        const now = new Date();
        const start = new Date(medicine.duration?.startDate);
        start.setHours(0,0,0,0);
        
        const end = new Date(medicine.duration?.endDate);
        end.setHours(23,59,59,999);

        // 1. Is it in the future?
        if (now < start) return 'future';

        // 2. Exact Expiration Check
        const today = new Date(now);
        today.setHours(0,0,0,0);
        const endDay = new Date(end);
        endDay.setHours(0,0,0,0);

        if (today > endDay) return 'expired'; // Day has completely passed
        
        // 🔥 IF TODAY IS THE LAST DAY, CHECK THE EXACT LAST TIME SLOT
        if (today.getTime() === endDay.getTime()) {
             if (!medicine.times || medicine.times.length === 0) return 'expired';
             
             // Get the latest time in the array (e.g. "20:00")
             const sortedTimes = [...medicine.times].sort();
             const latestTime = sortedTimes[sortedTimes.length - 1]; 
             
             const [h, m] = latestTime.split(':').map(Number);
             const lastDoseTime = new Date(now);
             lastDoseTime.setHours(h, m, 0, 0);

             if (now > lastDoseTime) return 'expired'; // Final dose time has passed today!
        }

        return 'active';
    };

    // --- ACTION HANDLERS ---
    const handleResyncAlarms = () => {
        const activeMedsCount = medicines.filter(m => getMedicineStatus(m) === 'active').length;
        if (activeMedsCount === 0) return alert("No active medicines to sync reminders for.");

        setModalConfig({
            isOpen: true,
            title: t('medicines.list.syncAlarms'),
            message: `This will reschedule reminders for your ${activeMedsCount} active medicines. Paused or expired medicines will be skipped.`,
            confirmText: "Sync Now",
            isDanger: false,
            onConfirm: async () => {
                setIsSyncing(true);
                closeModal(); 
                const result = await syncAlarms();
                setIsSyncing(false);
                if (result.success) alert("Alarms synchronized");
                else alert("Failed to sync alarms");
            }
        });
    };

    const handleDelete = (id, name) => {
        setModalConfig({
            isOpen: true, title: "Delete Medicine?", message: `Are you sure you want to permanently delete ${name}? This action cannot be undone.`, confirmText: "Delete", isDanger: true,
            onConfirm: async () => { await deleteMedicine(id); closeModal(); }
        });
    };

    const handlePauseResume = (id, isPaused, name) => {
        if (!isPaused) {
            setModalConfig({
                isOpen: true, title: `Pause ${name}?`, message: "You won't receive any notifications for this medicine until you resume it.", confirmText: "Pause Reminders", isDanger: false,
                onConfirm: async () => { await togglePauseMedicine(id); closeModal(); }
            });
        } else {
            setModalConfig({
                isOpen: true, title: `Resume ${name}?`, message: "Do you want to resume reminders? This will also extend the end date by the time you were paused.", confirmText: "Resume & Extend", isDanger: false,
                onConfirm: async () => { await togglePauseMedicine(id, true); closeModal(); }
            });
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try { return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return 'N/A'; }
    };

    // --- SKELETON LOADER ---
    if (loading && medicines.length === 0) {
        return (
            <div className="space-y-3 pb-24 animate-pulse">
                <div className="flex justify-between items-center px-1 mb-3">
                    <div className="h-6 w-32 bg-slate-200 rounded-lg"/>
                    <div className="h-8 w-24 bg-slate-200 rounded-lg"/>
                </div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl"/>
                                <div><div className="h-4 w-28 bg-slate-100 rounded mb-1.5"/><div className="h-3 w-16 bg-slate-100 rounded"/></div>
                            </div>
                        </div>
                        <div className="h-10 w-full bg-slate-50 rounded-lg mb-3"/>
                        <div className="h-8 w-full bg-slate-50 rounded-lg"/>
                    </div>
                ))}
            </div>
        );
    }

    // --- EMPTY STATE ---
    if (medicines.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-6 opacity-80 mt-6 bg-white rounded-3xl border border-dashed border-slate-200 mx-2">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <Pill className="w-10 h-10 text-blue-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-800 mb-2">{t('medicines.noMedicines')}</h3>
                <p className="text-slate-500 text-center max-w-xs text-sm font-medium leading-relaxed">
                    Tap the <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mx-1">+</span> button below to add your first prescription.
                </p>
            </div>
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className="space-y-4 pb-24">
            
            {/* Header / Tools */}
            <div className="flex justify-between items-end px-2 mb-1">
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                    {/* FIXED TRANSLATION MAPPING HERE */}
                    {t('medicines.list.yourList', { count: medicines.length })}
                </h2>
                <div className="flex space-x-2">
                    <button onClick={handleResyncAlarms} disabled={isSyncing} className="bg-white text-slate-600 px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:scale-95 transition-transform flex items-center border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                        <RefreshCw className={`mr-1 w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
                        {isSyncing ? t('medicines.list.syncing') : t('medicines.list.syncAlarms')}
                    </button>
                    <button onClick={() => { if(window.confirm("Stop ALL alarms?")) cancelAllAlarms(); }} className="bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:scale-95 transition-transform border border-red-100 flex items-center">
                        <X className="mr-1 w-3.5 h-3.5" /> {t('medicines.list.clear')}
                    </button>
                </div>
            </div>
            
            {/* COMPACT MEDICINE CARDS */}
            <div className="space-y-3">
                {medicines.map((medicine) => {
                    const times = medicine.times || [];
                    const status = getMedicineStatus(medicine);
                    const isOffline = medicine.pendingSync === true;

                    const isPaused = status === 'paused';
                    const isExpired = status === 'expired';
                    
                    return (
                        <div key={medicine._id} className={`bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 relative transition-all ${isPaused ? 'opacity-60 grayscale' : isExpired ? 'opacity-80' : ''}`}>
                            
                            {/* TOP ROW: Super Compact Title & Badge */}
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-3 w-full">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm border flex-shrink-0 ${
                                        isPaused ? 'bg-slate-100 text-slate-400 border-slate-200' :
                                        isExpired ? 'bg-red-50 text-red-500 border-red-100' :
                                        'bg-blue-50 text-blue-600 border-blue-100/50'
                                    }`}>
                                        <Pill className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 truncate pr-2">
                                        <h3 className="text-base font-extrabold text-slate-900 leading-tight truncate">
                                            {medicine.name || 'Unknown Medicine'}
                                        </h3>
                                        <p className="text-[11px] font-bold text-slate-500 mt-0.5 flex items-center gap-2">
                                            {medicine.dose || 'No dose info'}
                                            {isOffline && (
                                                <span className="bg-amber-50 text-amber-600 text-[8px] px-1.5 py-0.5 rounded border border-amber-100 flex items-center uppercase tracking-wider">
                                                    <WifiOff className="mr-1 w-2.5 h-2.5" /> {t('common.syncing')}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    
                                    <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border flex items-center shadow-sm flex-shrink-0 ${
                                        status === 'paused' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                        status === 'expired' ? 'bg-red-50 text-red-600 border-red-100' :
                                        status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}>
                                        {status === 'expired' && <AlertCircle className="w-2.5 h-2.5 mr-1" />}
                                        {t(`medicines.status.${status}`) || status}
                                    </div>
                                </div>
                            </div>

                            {/* MIDDLE ROW: Big Compact Times & Dates */}
                            <div className="bg-slate-50 rounded-xl p-2.5 mb-3 border border-slate-100 flex flex-col justify-center">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <Clock className="w-3.5 h-3.5 text-blue-400 mr-1" />
                                    {times.length > 0 ? times.map((time, index) => {
                                        const { time: tTime, ampm } = format12Hour(time);
                                        return (
                                            <div key={index} className="bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-lg flex items-baseline gap-0.5">
                                                <span className="font-black text-slate-800 text-[15px] tracking-tight leading-none">{tTime}</span>
                                                <span className="font-extrabold text-slate-400 text-[9px]">{ampm}</span>
                                            </div>
                                        );
                                    }) : <span className="text-xs font-bold text-slate-400 italic">No times</span>}
                                </div>
                                
                                <div className="mt-2.5 flex items-center text-[10px] font-bold text-slate-400 pt-2 border-t border-slate-200/60 w-full">
                                    <CalendarDays className="w-3 h-3 mr-1" />
                                    <span>{formatDate(medicine.duration?.startDate)}</span>
                                    <span className="mx-1.5 font-normal opacity-50">→</span>
                                    <span className={isExpired ? 'text-red-400' : ''}>{formatDate(medicine.duration?.endDate)}</span>
                                </div>
                            </div>

                            {/* BOTTOM ROW: Sleek Horizontal Action Bar */}
                            <div className="flex justify-between items-center gap-2 pt-1">
                                <button 
                                    onClick={() => handlePauseResume(medicine._id, isPaused, medicine.name)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors active:scale-95 ${isPaused ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
                                >
                                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                    <span className="text-[9px] font-extrabold uppercase tracking-wide">{isPaused ? 'Resume' : 'Pause'}</span>
                                </button>

                                <button 
                                    onClick={() => toggleMuteMedicine(medicine._id)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors active:scale-95 ${medicine.isMuted ? 'text-amber-500 bg-amber-50' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
                                >
                                    {medicine.isMuted ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                                    <span className="text-[9px] font-extrabold uppercase tracking-wide">{medicine.isMuted ? 'Muted' : 'Sound'}</span>
                                </button>

                                <button 
                                    onClick={() => onEdit(medicine)} 
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors active:scale-95 text-slate-500 bg-slate-50 hover:text-indigo-500 hover:bg-indigo-50"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-extrabold uppercase tracking-wide">Edit</span>
                                </button>

                                <button 
                                    onClick={() => handleDelete(medicine._id, medicine.name)} 
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors active:scale-95 text-slate-500 bg-slate-50 hover:text-red-500 hover:bg-red-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-extrabold uppercase tracking-wide">Delete</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 🔥 MODAL */}
            <ConfirmationModal 
                isOpen={modalConfig.isOpen}
                title={modalConfig.title}
                message={modalConfig.message}
                confirmText={modalConfig.confirmText}
                cancelText={modalConfig.cancelText}
                isDanger={modalConfig.isDanger}
                onConfirm={modalConfig.onConfirm}
                onCancel={closeModal}
            />

        </div>
    );
};

export default MedicineList;
























// import React, { useState } from 'react';
// import { useMedicines } from '../../hooks/useMedicines';
// import LoadingSpinner from '../LoadingSpinner'; 
// import { scheduleMedicineReminder, cancelAllAlarms } from '../../utils/LocalNotificationManager';
// import ConfirmationModal from '../ConfirmationModal'; // 👈 IMPORT YOUR MODAL
// import { useTranslation } from 'react-i18next';

// // 🎨 PRO ICONS
// import { 
//     LuPill, LuClock, LuCalendarDays, LuBell, LuBellOff, 
//     LuPencil, LuTrash2, LuPlay, LuPause, LuRefreshCw, 
//     LuX, LuWifiOff
// } from "react-icons/lu";

// const MedicineList = ({ onEdit }) => {
//     const { t } = useTranslation();
//     const { medicines, loading, deleteMedicine, toggleMuteMedicine, togglePauseMedicine, syncAlarms } = useMedicines();
//     const [isSyncing, setIsSyncing] = useState(false);

//     // --- 1. MODAL STATE CONFIGURATION ---
//     const [modalConfig, setModalConfig] = useState({
//         isOpen: false,
//         title: "",
//         message: "",
//         confirmText: "Confirm",
//         cancelText: "Cancel",
//         isDanger: false,
//         onConfirm: () => {}, // The function to run when "Yes" is clicked
//     });

//     // Helper to close modal
//     const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

//     // --- 2. ACTION HANDLERS (Now utilizing the Modal) ---

//     const handleResyncAlarms = () => {
//         // 🟢 Filter: Count only Active & Not Paused medicines
//         const activeMedsCount = medicines.filter(m => 
//             m.isActive && 
//             !m.isPaused && 
//             !isExpired(m.duration?.endDate)
//         ).length;

//         if (activeMedsCount === 0) {
//             return alert("No active medicines to sync reminders for.");
//         }

//         setModalConfig({
//             isOpen: true,
//             title: "Sync Alarms",
//             message: `This will reschedule reminders for your ${activeMedsCount} active medicines. Paused or expired medicines will be skipped.`,
//             confirmText: "Sync Now",
//             isDanger: false,
//             onConfirm: async () => {
//                 setIsSyncing(true);
//                 closeModal(); // Close immediately so we can show syncing state
              
//                 // 🛑 USE THE SHARED FUNCTION (Cleaner & Consistent)
//                 const result = await syncAlarms();
                
//                 setIsSyncing(false);
                
//                 // Optional: Show result alert
//                 if (result.success) alert("Alarms synchronized");
//                 else alert("Failed to sync alarms");
//             }
//         });
//     };

//     const handleDelete = (id, name) => {
//         setModalConfig({
//             isOpen: true,
//             title: "Delete Medicine?",
//             message: `Are you sure you want to permanently delete ${name}? This action cannot be undone.`,
//             confirmText: "Delete",
//             isDanger: true, // Red Button
//             onConfirm: async () => {
//                 await deleteMedicine(id);
//                 closeModal();
//             }
//         });
//     };

//     const handlePauseResume = (id, isPaused, name) => {
//         if (!isPaused) {
//             // PAUSE FLOW
//             setModalConfig({
//                 isOpen: true,
//                 title: `Pause ${name}?`,
//                 message: "You won't receive any notifications for this medicine until you resume it.",
//                 confirmText: "Pause Reminders",
//                 isDanger: false,
//                 onConfirm: async () => {
//                     await togglePauseMedicine(id);
//                     closeModal();
//                 }
//             });
//         } else {
//             // RESUME FLOW
//             setModalConfig({
//                 isOpen: true,
//                 title: `Resume ${name}?`,
//                 message: "Do you want to resume reminders? This will also extend the end date by the time you were paused.",
//                 confirmText: "Resume & Extend",
//                 isDanger: false,
//                 onConfirm: async () => {
//                     await togglePauseMedicine(id, true); // true = extend duration
//                     closeModal();
//                 }
//             });
//         }
//     };

//     // --- HELPERS (Unchanged) ---
//     const formatDate = (dateString) => {
//         if (!dateString) return 'N/A';
//         try { return new Date(dateString).toLocaleDateString(); } catch { return 'N/A'; }
//     };

//     const isExpired = (endDate) => {
//         if (!endDate) return false;
//         return new Date(endDate) < new Date();
//     };

//     const isActive = (startDate, endDate) => {
//         if (!startDate || !endDate) return false;
//         const now = new Date();
//         return new Date(startDate) <= now && new Date(endDate) >= now;
//     };

// // ✅ BAAD MEIN — skeleton:
// if (loading && medicines.length === 0) {
//     return (
//         <div className="space-y-4 pb-24">
//             <div className="flex justify-between items-center px-1">
//                 <div className="h-5 w-28 bg-slate-200 rounded animate-pulse"/>
//                 <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse"/>
//             </div>
//             {[1, 2, 3].map(i => (
//                 <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100">
//                     {/* Top row */}
//                     <div className="flex justify-between items-start mb-4">
//                         <div className="flex items-start gap-4">
//                             <div className="w-12 h-12 bg-slate-100 rounded-2xl animate-pulse"/>
//                             <div>
//                                 <div className="h-5 w-32 bg-slate-100 rounded animate-pulse mb-2"/>
//                                 <div className="h-3 w-20 bg-slate-100 rounded animate-pulse"/>
//                             </div>
//                         </div>
//                         <div className="h-6 w-14 bg-slate-100 rounded-md animate-pulse"/>
//                     </div>
//                     {/* Times */}
//                     <div className="flex gap-2 mb-4 pl-16">
//                         <div className="h-6 w-16 bg-slate-100 rounded-md animate-pulse"/>
//                         <div className="h-6 w-16 bg-slate-100 rounded-md animate-pulse"/>
//                     </div>
//                     {/* Actions */}
//                     <div className="grid grid-cols-4 gap-3 border-t border-slate-50 pt-4">
//                         {[1,2,3,4].map(j => (
//                             <div key={j} className="h-12 bg-slate-50 rounded-xl animate-pulse"/>
//                         ))}
//                     </div>
//                 </div>
//             ))}
//         </div>
//     );
// }


//     // --- EMPTY STATE ---
//     if (medicines.length === 0) {
//         return (
//             <div className="flex flex-col items-center justify-center py-20 px-6 opacity-70">
//                 <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
//                     <LuPill className="text-4xl text-slate-300" />
//                 </div>
//                 <h3 className="text-xl font-bold text-slate-800 mb-2">{t('medicines.noMedicines')}</h3>
//                 <p className="text-slate-500 text-center max-w-xs leading-relaxed">
//                     Tap the <span className="font-bold text-blue-600">+</span> button to add your first prescription.
//                 </p>
//             </div>
//         );
//     }

//     // --- MAIN RENDER ---
//     return (
//         <div className="space-y-6 pb-24">
            
//             {/* Header / Tools */}
//             <div className="flex justify-between items-center px-1">
//                 <h2 className="text-lg font-bold text-slate-800">{t('medicines.yourList')} ({medicines.length})</h2>
//                 <div className="flex space-x-2">
//                     <button 
//                         onClick={handleResyncAlarms} 
//                         disabled={isSyncing} 
//                         className="text-[11px] bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold active:scale-95 transition-transform flex items-center border border-slate-200"
//                     >
//                         <LuRefreshCw className={`mr-1.5 text-base ${isSyncing ? 'animate-spin' : ''}`} />
//                         {isSyncing ? t('medicines.syncing') : t('medicines.syncAlarms')}
//                     </button>
//                     {/* Note: cancelAllAlarms is instant, so we might not need a modal, but you can add one if you like! */}
//                     <button 
//                         onClick={() => {
//                             if(window.confirm("Stop ALL alarms?")) cancelAllAlarms();
//                         }} 
//                         className="text-[11px] bg-red-50 text-red-600 px-3 py-2 rounded-lg font-bold active:scale-95 transition-transform border border-red-100 flex items-center"
//                     >
//                         <LuX className="mr-1.5 text-base" />
//                         {t('medicines.clear')}
//                     </button>
//                 </div>
//             </div>
            
//             <div className="space-y-4">
//                 {medicines.map((medicine) => {
//                     const times = medicine.times || [];
//                     const startDate = medicine.duration?.startDate;
//                     const endDate = medicine.duration?.endDate;
//                     const expired = isExpired(endDate);
//                     const active = isActive(startDate, endDate);
//                     const isOffline = medicine.pendingSync === true;
//                     const isPaused = medicine.isPaused === true;
//                     const isMuted = medicine.isMuted === true;

//                     return (
//                         <div 
//                             key={medicine._id} 
//                             className={`bg-white rounded-2xl p-5 shadow-[0_2px_15px_rgb(0,0,0,0.04)] border border-slate-100 relative transition-all ${isPaused ? 'opacity-60 grayscale' : ''}`}
//                         >
//                             {/* TOP ROW */}
//                             <div className="flex justify-between items-start mb-4">
//                                 <div className="flex items-start space-x-4">
//                                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
//                                         isPaused ? 'bg-slate-100 text-slate-400' :
//                                         expired ? 'bg-red-50 text-red-500' :
//                                         active ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
//                                     }`}>
//                                         <LuPill />
//                                     </div>
//                                     <div>
//                                         <h3 className="text-lg font-bold text-slate-900 leading-tight">
//                                             {medicine.name || 'Unknown Medicine'}
//                                         </h3>
//                                         <p className="text-sm text-slate-500 font-medium mt-0.5">
//                                             {medicine.dose || 'No dose info'}
//                                         </p>
//                                     </div>
//                                 </div>
//                                 <div className="flex flex-col items-end space-y-1">
//                                     {isOffline && (
//                                         <span className="bg-amber-50 text-amber-600 text-[10px] px-2 py-1 rounded-md font-bold border border-amber-100 flex items-center">
//                                             <LuWifiOff className="mr-1" /> {t('medicines.syncing')}
//                                         </span>
//                                     )}
//                                     {!isOffline && (
//                                         <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center ${
//                                             isPaused ? 'bg-slate-100 text-slate-500 border-slate-200' :
//                                             expired ? 'bg-red-50 text-red-600 border-red-100' :
//                                             active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
//                                             'bg-blue-50 text-blue-600 border-blue-100'
//                                         }`}>
//                                             {isPaused ? t('medicines.paused') : expired ? t('medicines.expired') : active ? t('medicines.active') : t('medicines.future')}
//                                         </span>
//                                     )}
//                                 </div>
//                             </div>

//                             {/* MIDDLE ROW */}
//                             <div className="mb-5 pl-[4rem]">
//                                 <div className="flex flex-wrap gap-2 mb-2">
//                                     {times.length > 0 ? times.map((time, index) => (
//                                         <div key={index} className="flex items-center bg-slate-50 text-slate-600 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-100">
//                                             <LuClock className="mr-1.5 text-slate-400 text-[10px]" />
//                                             {time}
//                                         </div>
//                                     )) : <span className="text-xs text-slate-400 italic">No times set</span>}
//                                 </div>
//                                 <div className="flex items-center text-[11px] text-slate-400 font-medium">
//                                     <LuCalendarDays className="mr-1.5" />
//                                     {startDate && endDate ? `${formatDate(startDate)} — ${formatDate(endDate)}` : 'N/A'}
//                                 </div>
//                             </div>

//                             {/* BOTTOM ROW (Actions) */}
//                             <div className="grid grid-cols-4 gap-3 border-t border-slate-50 pt-4">
//                                 <button 
//                                     onClick={() => handlePauseResume(medicine._id, isPaused, medicine.name)}
//                                     className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 group ${
//                                         isPaused ? 'bg-emerald-50' : 'bg-slate-50'
//                                     }`}
//                                 >
//                                     {isPaused ? 
//                                         <LuPlay className="text-xl text-emerald-600 mb-1" /> : 
//                                         <LuPause className="text-xl text-slate-500 group-hover:text-slate-700 mb-1" />
//                                     }
//                                     <span className={`text-[10px] font-bold uppercase ${isPaused ? 'text-emerald-700' : 'text-slate-500'}`}>
//                                         {isPaused ? 'Resume' : 'Pause'}
//                                     </span>
//                                 </button>

//                                 <button 
//                                     onClick={() => toggleMuteMedicine(medicine._id)}
//                                     className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 group ${
//                                         isMuted ? 'bg-amber-50' : 'bg-slate-50'
//                                     }`}
//                                 >
//                                     {isMuted ? 
//                                         <LuBellOff className="text-xl text-amber-600 mb-1" /> : 
//                                         <LuBell className="text-xl text-slate-500 group-hover:text-blue-600 mb-1" />
//                                     }
//                                     <span className={`text-[10px] font-bold uppercase ${isMuted ? 'text-amber-700' : 'text-slate-500'}`}>
//                                         {isMuted ? 'Muted' : 'Sound'}
//                                     </span>
//                                 </button>

//                                 <button 
//                                     onClick={() => onEdit(medicine)} 
//                                     className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 transition-all active:scale-95 group"
//                                 >
//                                     <LuPencil className="text-xl text-slate-500 group-hover:text-indigo-600 mb-1" />
//                                     <span className="text-[10px] font-bold uppercase text-slate-500">Edit</span>
//                                 </button>

//                                 <button 
//                                     onClick={() => handleDelete(medicine._id, medicine.name)} 
//                                     className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 transition-all active:scale-95 group"
//                                 >
//                                     <LuTrash2 className="text-xl text-slate-500 group-hover:text-red-500 mb-1" />
//                                     <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-red-600">Delete</span>
//                                 </button>
//                             </div>
//                         </div>
//                     );
//                 })}
//             </div>

//             {/* 🔥 RENDER THE MODAL AT THE END */}
//             <ConfirmationModal 
//                 isOpen={modalConfig.isOpen}
//                 title={modalConfig.title}
//                 message={modalConfig.message}
//                 confirmText={modalConfig.confirmText}
//                 cancelText={modalConfig.cancelText}
//                 isDanger={modalConfig.isDanger}
//                 onConfirm={modalConfig.onConfirm}
//                 onCancel={closeModal}
//             />

//         </div>
//     );
// };

// export default MedicineList;
