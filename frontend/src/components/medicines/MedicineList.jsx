import React, { useState } from 'react';
import { useMedicines } from '../../hooks/useMedicines';
import LoadingSpinner from '../LoadingSpinner'; 
import { scheduleMedicineReminder, cancelAllAlarms } from '../../utils/LocalNotificationManager';
import ConfirmationModal from '../ConfirmationModal'; // 👈 IMPORT YOUR MODAL

// 🎨 PRO ICONS
import { 
    LuPill, LuClock, LuCalendarDays, LuBell, LuBellOff, 
    LuPencil, LuTrash2, LuPlay, LuPause, LuRefreshCw, 
    LuX, LuWifiOff
} from "react-icons/lu";

const MedicineList = ({ onEdit }) => {
    const { medicines, loading, deleteMedicine, toggleMuteMedicine, togglePauseMedicine, syncAlarms } = useMedicines();
    const [isSyncing, setIsSyncing] = useState(false);

    // --- 1. MODAL STATE CONFIGURATION ---
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        isDanger: false,
        onConfirm: () => {}, // The function to run when "Yes" is clicked
    });

    // Helper to close modal
    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    // --- 2. ACTION HANDLERS (Now utilizing the Modal) ---

    const handleResyncAlarms = () => {
        // 🟢 Filter: Count only Active & Not Paused medicines
        const activeMedsCount = medicines.filter(m => 
            m.isActive && 
            !m.isPaused && 
            !isExpired(m.duration?.endDate)
        ).length;

        if (activeMedsCount === 0) {
            return alert("No active medicines to sync reminders for.");
        }

        setModalConfig({
            isOpen: true,
            title: "Sync Alarms",
            message: `This will reschedule reminders for your ${activeMedsCount} active medicines. Paused or expired medicines will be skipped.`,
            confirmText: "Sync Now",
            isDanger: false,
            onConfirm: async () => {
                setIsSyncing(true);
                closeModal(); // Close immediately so we can show syncing state
              
                // 🛑 USE THE SHARED FUNCTION (Cleaner & Consistent)
                const result = await syncAlarms();
                
                setIsSyncing(false);
                
                // Optional: Show result alert
                if (result.success) alert("Alarms synchronized");
                else alert("Failed to sync alarms");
            }
        });
    };

    const handleDelete = (id, name) => {
        setModalConfig({
            isOpen: true,
            title: "Delete Medicine?",
            message: `Are you sure you want to permanently delete ${name}? This action cannot be undone.`,
            confirmText: "Delete",
            isDanger: true, // Red Button
            onConfirm: async () => {
                await deleteMedicine(id);
                closeModal();
            }
        });
    };

    const handlePauseResume = (id, isPaused, name) => {
        if (!isPaused) {
            // PAUSE FLOW
            setModalConfig({
                isOpen: true,
                title: `Pause ${name}?`,
                message: "You won't receive any notifications for this medicine until you resume it.",
                confirmText: "Pause Reminders",
                isDanger: false,
                onConfirm: async () => {
                    await togglePauseMedicine(id);
                    closeModal();
                }
            });
        } else {
            // RESUME FLOW
            setModalConfig({
                isOpen: true,
                title: `Resume ${name}?`,
                message: "Do you want to resume reminders? This will also extend the end date by the time you were paused.",
                confirmText: "Resume & Extend",
                isDanger: false,
                onConfirm: async () => {
                    await togglePauseMedicine(id, true); // true = extend duration
                    closeModal();
                }
            });
        }
    };

    // --- HELPERS (Unchanged) ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try { return new Date(dateString).toLocaleDateString(); } catch { return 'N/A'; }
    };

    const isExpired = (endDate) => {
        if (!endDate) return false;
        return new Date(endDate) < new Date();
    };

    const isActive = (startDate, endDate) => {
        if (!startDate || !endDate) return false;
        const now = new Date();
        return new Date(startDate) <= now && new Date(endDate) >= now;
    };

    if (loading && medicines.length === 0) return <LoadingSpinner text="Loading medicines..." />;

    // --- EMPTY STATE ---
    if (medicines.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-6 opacity-70">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <LuPill className="text-4xl text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Medicines Yet</h3>
                <p className="text-slate-500 text-center max-w-xs leading-relaxed">
                    Tap the <span className="font-bold text-blue-600">+</span> button to add your first prescription.
                </p>
            </div>
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className="space-y-6 pb-24">
            
            {/* Header / Tools */}
            <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-slate-800">Your List ({medicines.length})</h2>
                <div className="flex space-x-2">
                    <button 
                        onClick={handleResyncAlarms} 
                        disabled={isSyncing} 
                        className="text-[11px] bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold active:scale-95 transition-transform flex items-center border border-slate-200"
                    >
                        <LuRefreshCw className={`mr-1.5 text-base ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Alarms'}
                    </button>
                    {/* Note: cancelAllAlarms is instant, so we might not need a modal, but you can add one if you like! */}
                    <button 
                        onClick={() => {
                            if(window.confirm("Stop ALL alarms?")) cancelAllAlarms();
                        }} 
                        className="text-[11px] bg-red-50 text-red-600 px-3 py-2 rounded-lg font-bold active:scale-95 transition-transform border border-red-100 flex items-center"
                    >
                        <LuX className="mr-1.5 text-base" />
                        Clear
                    </button>
                </div>
            </div>
            
            <div className="space-y-4">
                {medicines.map((medicine) => {
                    const times = medicine.times || [];
                    const startDate = medicine.duration?.startDate;
                    const endDate = medicine.duration?.endDate;
                    const expired = isExpired(endDate);
                    const active = isActive(startDate, endDate);
                    const isOffline = medicine.pendingSync === true;
                    const isPaused = medicine.isPaused === true;
                    const isMuted = medicine.isMuted === true;

                    return (
                        <div 
                            key={medicine._id} 
                            className={`bg-white rounded-2xl p-5 shadow-[0_2px_15px_rgb(0,0,0,0.04)] border border-slate-100 relative transition-all ${isPaused ? 'opacity-60 grayscale' : ''}`}
                        >
                            {/* TOP ROW */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-start space-x-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
                                        isPaused ? 'bg-slate-100 text-slate-400' :
                                        expired ? 'bg-red-50 text-red-500' :
                                        active ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        <LuPill />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 leading-tight">
                                            {medicine.name || 'Unknown Medicine'}
                                        </h3>
                                        <p className="text-sm text-slate-500 font-medium mt-0.5">
                                            {medicine.dose || 'No dose info'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end space-y-1">
                                    {isOffline && (
                                        <span className="bg-amber-50 text-amber-600 text-[10px] px-2 py-1 rounded-md font-bold border border-amber-100 flex items-center">
                                            <LuWifiOff className="mr-1" /> Syncing
                                        </span>
                                    )}
                                    {!isOffline && (
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center ${
                                            isPaused ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                            expired ? 'bg-red-50 text-red-600 border-red-100' :
                                            active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            'bg-blue-50 text-blue-600 border-blue-100'
                                        }`}>
                                            {isPaused ? 'Paused' : expired ? 'Expired' : active ? 'Active' : 'Future'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* MIDDLE ROW */}
                            <div className="mb-5 pl-[4rem]">
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {times.length > 0 ? times.map((time, index) => (
                                        <div key={index} className="flex items-center bg-slate-50 text-slate-600 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-100">
                                            <LuClock className="mr-1.5 text-slate-400 text-[10px]" />
                                            {time}
                                        </div>
                                    )) : <span className="text-xs text-slate-400 italic">No times set</span>}
                                </div>
                                <div className="flex items-center text-[11px] text-slate-400 font-medium">
                                    <LuCalendarDays className="mr-1.5" />
                                    {startDate && endDate ? `${formatDate(startDate)} — ${formatDate(endDate)}` : 'N/A'}
                                </div>
                            </div>

                            {/* BOTTOM ROW (Actions) */}
                            <div className="grid grid-cols-4 gap-3 border-t border-slate-50 pt-4">
                                <button 
                                    onClick={() => handlePauseResume(medicine._id, isPaused, medicine.name)}
                                    className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 group ${
                                        isPaused ? 'bg-emerald-50' : 'bg-slate-50'
                                    }`}
                                >
                                    {isPaused ? 
                                        <LuPlay className="text-xl text-emerald-600 mb-1" /> : 
                                        <LuPause className="text-xl text-slate-500 group-hover:text-slate-700 mb-1" />
                                    }
                                    <span className={`text-[10px] font-bold uppercase ${isPaused ? 'text-emerald-700' : 'text-slate-500'}`}>
                                        {isPaused ? 'Resume' : 'Pause'}
                                    </span>
                                </button>

                                <button 
                                    onClick={() => toggleMuteMedicine(medicine._id)}
                                    className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 group ${
                                        isMuted ? 'bg-amber-50' : 'bg-slate-50'
                                    }`}
                                >
                                    {isMuted ? 
                                        <LuBellOff className="text-xl text-amber-600 mb-1" /> : 
                                        <LuBell className="text-xl text-slate-500 group-hover:text-blue-600 mb-1" />
                                    }
                                    <span className={`text-[10px] font-bold uppercase ${isMuted ? 'text-amber-700' : 'text-slate-500'}`}>
                                        {isMuted ? 'Muted' : 'Sound'}
                                    </span>
                                </button>

                                <button 
                                    onClick={() => onEdit(medicine)} 
                                    className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 transition-all active:scale-95 group"
                                >
                                    <LuPencil className="text-xl text-slate-500 group-hover:text-indigo-600 mb-1" />
                                    <span className="text-[10px] font-bold uppercase text-slate-500">Edit</span>
                                </button>

                                <button 
                                    onClick={() => handleDelete(medicine._id, medicine.name)} 
                                    className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 transition-all active:scale-95 group"
                                >
                                    <LuTrash2 className="text-xl text-slate-500 group-hover:text-red-500 mb-1" />
                                    <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-red-600">Delete</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 🔥 RENDER THE MODAL AT THE END */}
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

// // 🎨 IMPORTING PRO ICONS (Like Instagram/WhatsApp)
// import { 
//    LuPill,
//   LuClock,
//   LuCalendarDays,
//   LuBell,
//   LuBellOff,
//   LuPencil,
//   LuTrash2,
//   LuPlay,
//   LuPause,
//   LuRefreshCw,
//   LuX,
//   LuWifiOff
// } from "react-icons/lu";

// const MedicineList = ({ onEdit }) => {
//     const { medicines, loading, deleteMedicine, toggleMuteMedicine, togglePauseMedicine } = useMedicines();
//     const [isSyncing, setIsSyncing] = useState(false);

//     const handleResyncAlarms = async () => {
//         if (medicines.length === 0) return alert("No medicines to sync.");
//         if (!window.confirm(`Reset alarms for all ${medicines.length} medicines?`)) return;
//         setIsSyncing(true);
//         try {
//             let count = 0;
//             for (const med of medicines) {
//                 await scheduleMedicineReminder(med);
//                 count++;
//             }
//             alert(`✅ Success! Scheduled alarms for ${count} medicines.`);
//         } catch (err) { alert("Error syncing alarms."); } 
//         finally { setIsSyncing(false); }
//     };

//     const handleDelete = async (id, name) => {
//         if (window.confirm(`Are you sure you want to delete ${name}?`)) {
//             await deleteMedicine(id);
//         }
//     };

//     const handlePauseResume = async (id, isPaused, name) => {
//         if (!isPaused) {
//             if (window.confirm(`Pause reminders for ${name}? You won't receive notifications until you resume.`)) {
//                 await togglePauseMedicine(id);
//             }
//         } else {
//             const extend = window.confirm(`Resume ${name}? \n\nClick OK to EXTEND duration by pause time.\nClick Cancel to RESUME without extending.`);
//             await togglePauseMedicine(id, extend);
//         }
//     };

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

//     if (loading && medicines.length === 0) return <LoadingSpinner text="Loading medicines..." />;

//     // --- EMPTY STATE UI ---
//     if (medicines.length === 0) {
//         return (
//             <div className="flex flex-col items-center justify-center py-20 px-6 opacity-70">
//                 <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
//                     <LuPill className="text-4xl text-slate-300" />
//                 </div>
//                 <h3 className="text-xl font-bold text-slate-800 mb-2">No Medicines Yet</h3>
//                 <p className="text-slate-500 text-center max-w-xs leading-relaxed">
//                     Tap the <span className="font-bold text-blue-600">+</span> button to add your first prescription.
//                 </p>
//             </div>
//         );
//     }

//     // --- MAIN LIST UI ---
//     return (
//         <div className="space-y-6 pb-24">
            
//             {/* Header / Tools */}
//             <div className="flex justify-between items-center px-1">
//                 <h2 className="text-lg font-bold text-slate-800">Your List ({medicines.length})</h2>
//                 <div className="flex space-x-2">
//                     <button 
//                         onClick={handleResyncAlarms} 
//                         disabled={isSyncing} 
//                         className="text-[11px] bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold active:scale-95 transition-transform flex items-center border border-slate-200"
//                     >
//                         <LuRefreshCw className={`mr-1.5 text-base ${isSyncing ? 'animate-spin' : ''}`} />
//                         {isSyncing ? 'Syncing...' : 'Sync Alarms'}
//                     </button>
//                     <button 
//                         onClick={cancelAllAlarms} 
//                         className="text-[11px] bg-red-50 text-red-600 px-3 py-2 rounded-lg font-bold active:scale-95 transition-transform border border-red-100 flex items-center"
//                     >
//                         <LuX className="mr-1.5 text-base" />
//                         Clear
//                     </button>
//                 </div>
//             </div>
            
//             <div className="space-y-4">
//                 {medicines.map((medicine) => {
//                     // Logic helpers
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
                            
//                             {/* --- TOP ROW: Icon + Name + Status --- */}
//                             <div className="flex justify-between items-start mb-4">
//                                 <div className="flex items-start space-x-4">
//                                     {/* Icon Box */}
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
                                
//                                 {/* Status Chip */}
//                                 <div className="flex flex-col items-end space-y-1">
//                                     {isOffline && (
//                                         <span className="bg-amber-50 text-amber-600 text-[10px] px-2 py-1 rounded-md font-bold border border-amber-100 flex items-center">
//                                             <LuWifiOff className="mr-1" /> Syncing
//                                         </span>
//                                     )}
//                                     {!isOffline && (
//                                         <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center ${
//                                             isPaused ? 'bg-slate-100 text-slate-500 border-slate-200' :
//                                             expired ? 'bg-red-50 text-red-600 border-red-100' :
//                                             active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
//                                             'bg-blue-50 text-blue-600 border-blue-100'
//                                         }`}>
//                                             {isPaused ? 'Paused' : expired ? 'Expired' : active ? 'Active' : 'Future'}
//                                         </span>
//                                     )}
//                                 </div>
//                             </div>

//                             {/* --- MIDDLE ROW: Info --- */}
//                             <div className="mb-5 pl-[4rem]"> {/* Indent to align with text */}
//                                 {/* Times */}
//                                 <div className="flex flex-wrap gap-2 mb-2">
//                                     {times.length > 0 ? times.map((time, index) => (
//                                         <div key={index} className="flex items-center bg-slate-50 text-slate-600 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-100">
//                                             <LuClock className="mr-1.5 text-slate-400 text-[10px]" />
//                                             {time}
//                                         </div>
//                                     )) : <span className="text-xs text-slate-400 italic">No times set</span>}
//                                 </div>
//                                 {/* Duration */}
//                                 <div className="flex items-center text-[11px] text-slate-400 font-medium">
//                                     <LuCalendarDays className="mr-1.5" />
//                                     {startDate && endDate ? `${formatDate(startDate)} — ${formatDate(endDate)}` : 'N/A'}
//                                 </div>
//                             </div>

//                             {/* --- BOTTOM ROW: Actions Grid (The "Instagram" Look) --- */}
//                             <div className="grid grid-cols-4 gap-3 border-t border-slate-50 pt-4">
//                                 {/* 1. Pause/Resume */}
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

//                                 {/* 2. Mute/Unmute */}
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

//                                 {/* 3. Edit */}
//                                 <button 
//                                     onClick={() => onEdit(medicine)} 
//                                     className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 transition-all active:scale-95 group"
//                                 >
//                                     <LuPencil className="text-xl text-slate-500 group-hover:text-indigo-600 mb-1" />
//                                     <span className="text-[10px] font-bold uppercase text-slate-500">Edit</span>
//                                 </button>

//                                 {/* 4. Delete */}
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
//         </div>
//     );
// };

// export default MedicineList;







// import React, { useState } from 'react';
// import { useMedicines } from '../../hooks/useMedicines';
// import LoadingSpinner from '../LoadingSpinner'; 
// import { scheduleMedicineReminder, cancelAllAlarms } from '../../utils/LocalNotificationManager';

// const MedicineList = ({ onEdit }) => {
//     const { medicines, loading, deleteMedicine, toggleMuteMedicine, togglePauseMedicine } = useMedicines();
//     const [isSyncing, setIsSyncing] = useState(false);

//     const handleResyncAlarms = async () => {
//         if (medicines.length === 0) return alert("No medicines to sync.");
//         if (!window.confirm(`Reset alarms for all ${medicines.length} medicines?`)) return;
//         setIsSyncing(true);
//         try {
//             let count = 0;
//             for (const med of medicines) {
//                 await scheduleMedicineReminder(med);
//                 count++;
//             }
//             alert(`✅ Success! Scheduled alarms for ${count} medicines.`);
//         } catch (err) { alert("Error syncing alarms."); } 
//         finally { setIsSyncing(false); }
//     };

//     const handleDelete = async (id, name) => {
//         if (window.confirm(`Are you sure you want to delete ${name}?`)) {
//             await deleteMedicine(id);
//         }
//     };

//     const handlePauseResume = async (id, isPaused, name) => {
//         if (!isPaused) {
//             // Currently Active -> Pausing
//             if (window.confirm(`Pause reminders for ${name}? You won't receive notifications until you resume.`)) {
//                 await togglePauseMedicine(id);
//             }
//         } else {
//             // Currently Paused -> Resuming
//             const extend = window.confirm(`Resume ${name}? \n\nClick OK to EXTEND duration by pause time.\nClick Cancel to RESUME without extending.`);
//             await togglePauseMedicine(id, extend);
//         }
//     };

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

//     if (loading && medicines.length === 0) return <LoadingSpinner text="Loading medicines..." />;

//     if (medicines.length === 0) {
//         return (
//             <div className="text-center py-12">
//                 <h3 className="text-lg font-medium text-gray-900 mb-2">No medicines added yet</h3>
//                 <p className="text-gray-600">Add your first medicine to start getting reminders</p>
//             </div>
//         );
//     }

//     return (
//         <div className="space-y-4 pb-20">
//             <div className="flex justify-between items-center mb-4">
//                 <h2 className="text-xl font-semibold text-gray-900">Your Medicines</h2>
//                 <div className="flex space-x-2">
//                     <button onClick={handleResyncAlarms} disabled={isSyncing} className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-200 flex items-center">
//                         {isSyncing ? '⏳ Syncing...' : '🔄 Resync Alarms'}
//                     </button>
//                     <button onClick={cancelAllAlarms} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-md">⚠️ Clear All</button>
//                 </div>
//             </div>
            
//             {medicines.map((medicine) => {
//                 const times = medicine.times || [];
//                 const startDate = medicine.duration?.startDate;
//                 const endDate = medicine.duration?.endDate;
//                 const expired = isExpired(endDate);
//                 const active = isActive(startDate, endDate);
//                 const isOffline = medicine.pendingSync === true;
//                 const isPaused = medicine.isPaused === true;
//                 const isMuted = medicine.isMuted === true;

//                 return (
//                     <div key={medicine._id} className={`bg-white rounded-lg shadow-md p-6 border-l-4 relative ${isPaused ? 'border-gray-400 opacity-80' : isOffline ? 'border-gray-400 bg-gray-50' : expired ? 'border-red-400' : 'border-green-400'}`}>
                        
//                         {/* Status Badges */}
//                         <div className="absolute top-2 right-2 flex space-x-1">
//                             {isPaused && <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full font-bold">⏸️ PAUSED</span>}
//                             {isMuted && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full font-bold">🔇 SILENT</span>}
//                             {isOffline && (
//                                 <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center shadow-sm font-medium border border-yellow-200">
//                                     ⏳ Waiting for Internet
//                                 </div>
//                             )}
//                         </div>

//                         <div className="flex justify-between items-start">
//                             <div className="flex-1">
//                                 <div className="flex items-center space-x-3">
//                                     <h3 className="text-lg font-semibold text-gray-900">{medicine.name || 'Unknown Medicine'}</h3>
//                                     {!isOffline && !isPaused && (
//                                         <span className={`px-2 py-1 rounded-full text-xs font-medium ${expired ? 'bg-red-100 text-red-800' : active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
//                                             {expired ? 'Expired' : active ? 'Active' : 'Upcoming'}
//                                         </span>
//                                     )}
//                                 </div>
//                                 <p className="text-gray-600 mt-1"><span className="font-medium">Dose:</span> {medicine.dose || 'N/A'}</p>
//                                 <div className="mt-2">
//                                     <span className="font-medium text-gray-700">Times:</span>
//                                     <div className="flex flex-wrap gap-2 mt-1">
//                                         {times.length > 0 ? times.map((time, index) => (
//                                             <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{time}</span>
//                                         )) : <span className="text-sm text-gray-500">No times set</span>}
//                                     </div>
//                                 </div>
//                                 <div className="mt-2 text-sm text-gray-600">
//                                     <span className="font-medium">Duration:</span>{' '}
//                                     {(startDate && endDate) ? `${formatDate(startDate)} - ${formatDate(endDate)}` : 'N/A'}
//                                 </div>
//                             </div>
                            
//                             <div className="flex flex-col space-y-2 ml-4 mt-6">
//                                 {/* Mute Button */}
//                                 <button 
//                                     onClick={() => toggleMuteMedicine(medicine._id)}
//                                     className={`px-3 py-1 font-medium text-sm border rounded flex items-center justify-center ${isMuted ? 'bg-purple-50 text-purple-700 border-purple-300' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
//                                 >
//                                     {isMuted ? '🔊 Unmute' : '🔇 Mute'}
//                                 </button>

//                                 {/* Pause/Resume Button */}
//                                 <button 
//                                     onClick={() => handlePauseResume(medicine._id, isPaused, medicine.name)}
//                                     className={`px-3 py-1 font-medium text-sm border rounded flex items-center justify-center ${isPaused ? 'bg-green-50 text-green-700 border-green-300' : 'text-orange-600 border-orange-300 hover:bg-orange-50'}`}
//                                 >
//                                     {isPaused ? '▶️ Resume' : '⏸️ Pause'}
//                                 </button>

//                                 <button 
//                                     onClick={() => onEdit(medicine)} 
//                                     className="px-3 py-1 font-medium text-sm border rounded text-blue-600 border-blue-300 hover:bg-blue-50"
//                                 >
//                                     Edit
//                                 </button>
//                                 <button 
//                                     onClick={() => handleDelete(medicine._id, medicine.name)} 
//                                     className="px-3 py-1 font-medium text-sm border rounded text-red-600 border-red-300 hover:bg-red-50"
//                                 >
//                                     Delete
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 );
//             })}
//         </div>
//     );
// };

// export default MedicineList;
