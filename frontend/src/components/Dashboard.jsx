import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useMedicines } from '../hooks/useMedicines';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { Network } from '@capacitor/network';
import { Check, AlertCircle, Clock, Circle } from "lucide-react";
import PendingReviewModal from './PendingReviewModal';

// Helper to open settings
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

// 🔥 SAFETY HELPER: Prevents "toLocaleTimeString of undefined" crash
const formatTimeSafe = (dateObj) => {
    if (!dateObj) return "";
    try {
        const d = new Date(dateObj);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "";
    }
};

const Dashboard = () => {
    const { user } = useAuth();
    
    // Get data and actions from hook
    const { medicines, logs, syncOfflineData, lastSyncTime, updateLogStatus } = useMedicines();
    
    const { permission } = useNotifications();
    const [nextDose, setNextDose] = useState(null);
    const [todayStats, setTodayStats] = useState({ taken: 0, total: 0, percentage: 0 });
    const [todaysDoses, setTodaysDoses] = useState([]); 
    const [isOnline, setIsOnline] = useState(true);
    const [now, setNow] = useState(new Date()); // State for live time updates

// Modal State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [overdueLogs, setOverdueLogs] = useState([]);

// 🛑 NEW: Prevents modal from re-opening if user manually closed it this session
    const hasClosedModalRef = useRef(false);

    const handleCloseModal = () => {
        hasClosedModalRef.current = true; // Don't show again until refresh
        setShowReviewModal(false);
    };

    // --- 1. INITIAL SETUP ---
    useEffect(() => {
        checkPermissions();
        checkNetwork();
        
        // Listen for network status
        const listener = Network.addListener('networkStatusChange', status => {
            setIsOnline(status.connected);
        });
        
        // Initial Sync (Try-catch handled inside hook)
        syncOfflineData();

        // Update "now" every minute to refresh Red/Grey status
        const timer = setInterval(() => setNow(new Date()), 60000);

        return () => { listener.remove && listener.remove(); 
            clearInterval(timer);
         };
    }, []);

    // Recalculate whenever data changes (Instantly updates UI even offline)
    useEffect(() => {
        if (medicines.length > 0 || logs.length >= 0) {
            calculateDashboardStats();
        }
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

    // --- 2. ACTION HANDLER (Tap to Take) ---
    // const handleQuickAction = async (dose) => {
    //     if (dose.status === 'taken') return; 
        
    //     // Optimistic Update
    //     const updatedDoses = todaysDoses.map(d => 
    //         d.id === dose.id ? { ...d, status: 'taken' } : d
    //     );
    //     setTodaysDoses(updatedDoses);

    //     // Save Log (Hook handles offline queue)
    //     await addManualLog(dose.medicineId, 'taken', dose.name);
    // };

    // --- 3. CORE LOGIC (Stats & Schedule) ---
    const calculateDashboardStats = () => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        // Normalize Today to Midnight for accurate comparisons
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

            // 🔥 FIX: Normalize Start Date to Midnight
            // This ensures medicines added "just now" (e.g. 2 PM) are still counted for "Today"
            const startDate = new Date(med.duration.startDate);
            startDate.setHours(0,0,0,0);
            
            const endDate = new Date(med.duration.endDate);
            endDate.setHours(23,59,59,999);

            // Strict Date Check: Is Today inside the range?
            if (todayEnd < startDate || todayStart > endDate) return;

            med.times.forEach(time => {
                totalScheduledCount++;

                const existingLog = logs.find(log => {
                    const logMedId = log.medicineId?._id || log.medicineId;
                    const targetMedId = med._id;
                    return logMedId === targetMedId && log.date.startsWith(todayStr) && log.time === time;
                });

                let status = 'pending';
                if (existingLog) {
                    status = existingLog.status;
                    if (status === 'taken') takenCount++;
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

                // Check for Overdue (Popup Logic)
                // 1. Must exist (generated)
                // 2. Must be pending
                // 3. Time must be in the past
                if (existingLog && status === 'pending' && doseTime < now) {
                    // Add extra check to prevent popup for just-scheduled items (optional 1 min buffer)
                        pendingOverdue.push(existingLog);
                }
            });
        });

        const percentage = totalScheduledCount > 0 ? Math.round((takenCount / totalScheduledCount) * 100) : 0;
        setTodayStats({ taken: takenCount, total: totalScheduledCount, percentage });

        dailySchedule.sort((a, b) => a.dateObj - b.dateObj);
        setTodaysDoses(dailySchedule);

        const upcoming = dailySchedule.find(d => d.dateObj > now && d.status === 'pending');
        setNextDose(upcoming || null);

        // Update Modal Data
        setOverdueLogs(pendingOverdue);
        if (pendingOverdue.length > 0) {
            setShowReviewModal(true);
        }
    };

    // --- 3. HANDLE MODAL ACTIONS ---
    const handleReviewAction = async (logId, status) => {
        // This updates the EXISTING log. It does NOT create a duplicate.
        // It preserves the original scheduled time.
        await updateLogStatus(logId, status);
        
        // UI updates automatically via useEffect
    };

    // SVG Math
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (todayStats.percentage / 100) * circumference;

    return (
        <div className="bg-slate-50 min-h-full pb-24">
            
            {/* HEADER */}
            <div className="bg-green-200 px-6 pt-8 pb-6 rounded-b-[2rem] shadow-sm mb-6 sticky top-0 z-100 border-b border-slate-100">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                            Hi, {user?.name?.split(' ')[0] || 'Friend'}!
                        </h1>
                        <p className="text-slate-500 text-sm mt-1 font-medium">Let's stay healthy today.</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-tr from-blue-100 to-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold shadow-sm border border-blue-100">
                        {user?.name?.[0] || 'U'}
                    </div>
                </div>

                {/* SYNC STATUS */}
                <div className="mt-5 flex items-center space-x-2 text-[11px] font-semibold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full inline-flex border border-slate-100">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-400'} shadow-sm`}></span>
                    <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
                    <span className="text-slate-300">|</span>
                    <span>
                        {/* 🔥 SAFE TIME RENDERING */}
                        {lastSyncTime ? `Synced: ${formatTimeSafe(lastSyncTime)}` : 'Sync Pending...'}
                    </span>
                </div>
            </div>

            {/* CONTENT */}
            <div className="px-5 space-y-6">
                
                {/* Permissions */}
                {permission !== 'granted' && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                        <div className="text-red-700 text-sm font-semibold flex items-center">
                            <span className="mr-2 text-lg">🔔</span> Enable Notifications
                        </div>
                        <button onClick={openAppDetails} className="bg-white text-red-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm border border-red-100">
                            Fix Now
                        </button>
                    </div>
                )}

                {/* Daily Progress */}
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center justify-between relative overflow-hidden">
                    <div className="z-10">
                        <h3 className="font-bold text-slate-700 text-lg">Daily Goal</h3>
                        <p className="text-slate-400 text-xs mt-1 font-medium">
                            <span className="font-bold text-blue-600 text-xl">{todayStats.taken}</span> 
                            <span className="text-slate-400 mx-1">/</span> 
                            {todayStats.total} doses taken
                        </p>
                    </div>
                    <div className="relative w-16 h-16 z-10">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="32" cy="32" r={radius} stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                            <circle cx="32" cy="32" r={radius} stroke="#3b82f6" strokeWidth="6" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-600">
                            {todayStats.percentage}%
                        </div>
                    </div>
                </div>

                {/* UP NEXT */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-3xl p-6 text-white shadow-lg shadow-blue-200/50 flex justify-between items-center relative overflow-hidden">
                    <div className="z-10">
                        <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mb-1">UP NEXT</p>
                        {nextDose ? (
                            <>
                                <p className="text-2xl font-bold tracking-tight">{nextDose.name}</p>
                                <div className="flex items-center mt-2 space-x-2">
                                    <span className="bg-white/20 px-2 py-1 rounded-md text-xs font-medium backdrop-blur-sm">
                                        {/* 🔥 SAFE TIME RENDERING */}
                                        {nextDose.doseTime ? formatTimeSafe(nextDose.doseTime) : nextDose.time}
                                    </span>
                                    <span className="text-blue-100 text-xs">{nextDose.dose}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-2xl font-bold tracking-tight">All Caught Up!</p>
                                <p className="text-blue-100 text-xs mt-1">No pending meds.</p>
                            </>
                        )}
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10 z-10">
                        <span className="text-2xl">{nextDose ? '💊' : '🌙'}</span>
                    </div>
                </div>

               {/* SCHEDULE (READ ONLY) */}
                <div>
                    <div className="flex justify-between items-end mb-4 px-1">
                        <h3 className="font-bold text-slate-800 text-lg">Today's Schedule</h3>
                    </div>
                    
                    {todaysDoses.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200">
                            <span className="text-4xl block mb-2 opacity-50">☕</span>
                            <p className="text-slate-400 text-sm font-medium">No medicines today!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {todaysDoses.map((dose) => {
                                const isTaken = dose.status === 'taken';
                                // It is Late if not taken AND the time has passed
                                const isLate = !isTaken && dose.dateObj < now;
                                
                                return (
                                    <div key={dose.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                                        isTaken 
                                            ? 'bg-emerald-50/50 border-emerald-100 opacity-60' 
                                            : isLate 
                                                ? 'bg-red-50/50 border-red-100'
                                                : 'bg-white border-slate-100 shadow-[0_2px_8px_rgb(0,0,0,0.02)]'
                                    }`}>
                                        
                                        {/* Left Side: Time & Name */}
                                        <div className="flex items-center space-x-4">
                                            <div className={`text-xs font-bold px-3 py-2 rounded-xl min-w-[60px] text-center ${
                                                isTaken ? 'bg-emerald-100 text-emerald-700' : 
                                                isLate ? 'bg-red-100 text-red-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {dose.time}
                                            </div>
                                            <div>
                                                <h4 className={`font-bold text-base ${
                                                    isTaken ? 'text-emerald-800 line-through decoration-emerald-800/30' : 
                                                    isLate ? 'text-red-800' :
                                                    'text-slate-700'
                                                }`}>
                                                    {dose.name}
                                                </h4>
                                                <p className={`text-xs font-medium ${isLate ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {dose.dose}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Side: Status Indicator (Non-clickable) */}
                                        <div className="pr-1">
                                            {isTaken ? (
                                                <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-full text-emerald-600 shadow-sm">
                                                    <Check size={18} strokeWidth={3} />
                                                </div>
                                            ) : isLate ? (
                                                <div className="w-8 h-8 flex items-center justify-center bg-red-100 rounded-full text-red-500 shadow-sm">
                                                    <AlertCircle size={18} strokeWidth={2.5} />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full text-slate-300 border border-slate-200">
                                                    <Circle size={18} strokeWidth={2.5} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                <div className="h-8"></div>
            </div>
           {/* 🔥 POPUP: Only shows if there are overdue logs */}
            {showReviewModal && overdueLogs.length > 0 && (
                <PendingReviewModal 
                    logs={overdueLogs}
                    onAction={handleReviewAction}
                    onClose={handleCloseModal} 
                />
            )}
        </div>
    );
};

export default Dashboard;









// import React, { useEffect, useState } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { useNotifications } from '../hooks/useNotifications';
// import { useMedicines } from '../hooks/useMedicines'; 
// import { Capacitor } from '@capacitor/core';
// import { LocalNotifications } from '@capacitor/local-notifications';
// import { rescheduleSnooze } from '../utils/LocalNotificationManager'; 
// import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';

// // --- IMPORTS ---
// import MedicineForm from './medicines/MedicineForm';
// import MedicineList from './medicines/MedicineList';
// import ActiveMedicines from './pages/ActiveMedicines';
// import Reminders from './pages/Reminders';
// import HealthTracking from './pages/HealthTraking';
// import HistorySection from './pages/HistorySection';
// import ContactPage from './pages/ContactPage';
// import AiChatbot from './AiChatbot'; 


// const openAppDetails = async () => {
//         try {
//             // Attempt 1: The standard "open" method
//             await NativeSettings.open({
//                 optionAndroid: AndroidSettings.ApplicationDetails, 
//                 optionIOS: IOSSettings.App
//             });
//         } catch (err1) {
//             console.warn("Standard open failed, trying fallback...", err1);
//             try {
//                 // Attempt 2: The Android-specific fallback
//                 await NativeSettings.openAndroid({
//                     option: AndroidSettings.ApplicationDetails
//                 });
//             } catch (err2) {
//                 console.error("All attempts failed:", err2);
//                 // Final Fallback: Alert the user
//                 alert("We couldn't open settings automatically. Please go to Settings > Apps > MedMind > Permissions.");
//             }
//         }
//     };


// const Dashboard = () => {
//     const { user } = useAuth();
//     // Get updateLogStatus to handle notification buttons
//     const medicinesHook = useMedicines();
// const {
//   medicines,
//   logs,
//   syncOfflineData,
//   updateLogStatus,
//   handleNotificationAction,
//   lastSyncTime
// } = medicinesHook;

//     const { permission, requestPermission } = useNotifications();

//     const [showMedicineForm, setShowMedicineForm] = useState(false);
//     const [editingMedicine, setEditingMedicine] = useState(null);
//     const [notificationStatus, setNotificationStatus] = useState('');
//     const [currentPage, setCurrentPage] = useState('dashboard');

//     // 🔥 State to force HistorySection to reload when notification is clicked
//     const [historyUpdateKey, setHistoryUpdateKey] = useState(0); 
    
//     // --- 1. INITIAL SETUP & SYNC ---
//     useEffect(() => {
//         syncOfflineData();

//         let actionListenerHandle;

//         const initializeApp = async () => {
//             // A. REGISTER BUTTONS (Taken, Missed, Snooze)
//             await LocalNotifications.registerActionTypes({
//                 types: [{
//                     id: 'MEDICINE_ACTIONS',
//                     actions: [
//                         { id: 'taken', title: '✅ Taken', foreground: true },
//                         { id: 'missed', title: '❌ Missed', foreground: true, destructive: true },
//                         { id: 'snooze', title: '💤 Snooze 10m', foreground: false }
//                     ]
//                 }]
//             });

//             // B. CHECK PERMISSIONS
//             const perm = await LocalNotifications.checkPermissions();
//             if (perm.display === 'granted') {
//                 setNotificationStatus("Notifications Active ✅");
//             } else {
//                 const request = await LocalNotifications.requestPermissions();
//                 if (request.display === 'granted') {
//                     setNotificationStatus("Notifications Active ✅");
//                 }
//             }

//             // C. REQUEST BATTERY OPTIMIZATION (Prevent OS killing app)
//             if (window.cordova && window.cordova.plugins && window.cordova.plugins.BatteryOptimization) {
//                 window.cordova.plugins.BatteryOptimization.isOptimized(function(isOptimized) {
//                     if (isOptimized) {
//                         console.log("⚠️ App is throttled. Requesting unrestricted access...");
//                         window.cordova.plugins.BatteryOptimization.requestOptimization(
//                             function() { console.log("✅ Battery optimization disabled!"); },
//                             function(error) { console.error("❌ Battery permission denied:", error); }
//                         );
//                     }
//                 }, function(error) { console.error("Battery check failed:", error); });
//             }

//             // D. SETUP LISTENER
//             actionListenerHandle = await LocalNotifications.addListener('localNotificationActionPerformed', async (payload) => {
//                 console.log('Action Performed:', payload);
                
//                 const actionId = payload.actionId; 
//                 const notificationObject = payload.notification; 
//                 const logId = notificationObject.id; 
//                 const { medicineName } = notificationObject.extra || {};

//                 // 1. Handle Buttons (Taken / Missed)
//                 if (actionId === 'taken' || actionId === 'missed') {
//                     const result = await updateLogStatus(logId, actionId); 
                    
//                     if (result.success) {
//                         // 🔥 This triggers the history section to reload
//                         setHistoryUpdateKey(prev => prev + 1); 
//                         setCurrentPage('history-section'); 
//                     } else {
//                         alert(`Error logging status: ${result.message}`);
//                     }
//                 } 
//                 // 2. Handle Snooze
//                 else if (actionId === 'snooze') {
//                      await rescheduleSnooze(notificationObject);
//                      alert(`💤 Snoozed ${medicineName} for 10 minutes`);
//                 }
//                 // 3. Handle Normal Tap
//                 else if (actionId === 'tap') {
//                     setCurrentPage('history-section'); 
//                 }
//             });

//             actionListenerHandle = await LocalNotifications.addListener('localNotificationActionPerformed', async (payload) => {
//         const actionId = payload.actionId; 
//         const notificationObject = payload.notification; 
        
//         // Extract Medicine Details from the "extra" data we attached
//         const { medicineId, medicineName } = notificationObject.extra || {};

//         if (actionId === 'taken' || actionId === 'missed') {
//             // 🔥 Use the new handler that creates a fresh log entry
//             const result = await handleNotificationAction(medicineId, actionId, medicineName);
            
//             if (result.success) {
//                 setHistoryUpdateKey(prev => prev + 1); 
//                 setCurrentPage('history-section'); 
//             }
//         } 
//         else if (actionId === 'snooze') {
//              await rescheduleSnooze(notificationObject);
//         }
//     });
//         };
        
//         initializeApp();

//         // Cleanup
//         return () => {
//             if (actionListenerHandle) {
//                 actionListenerHandle.remove();
//             }
//             LocalNotifications.removeAllListeners();
//         };
//     }, []);

//     // --- 2. HANDLERS ---
//     const handleEnableNotifications = async () => {
//         const granted = await requestPermission();
//         if (granted) {
//             setNotificationStatus('Notifications Active ✅');
//             alert("Permissions Granted!");
//         } else {
//             setNotificationStatus('Permission Denied ❌');
//             alert("We need permission to play alarms.");
//         }
//     };

//     const handleTestNotification = async () => {
//         await LocalNotifications.createChannel({
//             id: 'medmind_alarm_v3', 
//             name: 'Medicine Alarms',
//             importance: 5,
//             visibility: 1,
//             vibration: true,
//             sound: 'alarm_sound.wav', 
//         });

//         await LocalNotifications.schedule({
//             notifications: [{
//                 title: "Test Alarm 🔔",
//                 body: "Testing background alarm (v3)",
//                 id: 99999,
//                 schedule: { at: new Date(Date.now() + 5000),
//                     allowWhileIdle: true
//                  },
//                 channelId: 'medmind_alarm_v3',
//                 sound: 'alarm_sound.wav', 
//                 actionTypeId: "MEDICINE_ACTIONS", // Add buttons to test too
//                 extra: { medicineName: "Test Pill" }
//             }]
//         });
//         alert("Wait 5 seconds... (Close app to test background)");
//     };

//     const handleAddMedicine = () => {
//         setEditingMedicine(null);
//         setShowMedicineForm(true);
//         setCurrentPage('medicines');
//     };

//     const handleEditMedicine = (medicine) => {
//         setEditingMedicine(medicine);
//         setShowMedicineForm(true);
//         setCurrentPage('medicines');
//     };

//     const handleFormSuccess = () => {
//         setShowMedicineForm(false);
//         setEditingMedicine(null);
//     };

//     const handleFormCancel = () => {
//         setShowMedicineForm(false);
//         setEditingMedicine(null);
//     };

//     // --- 3. NAVIGATION UI ---
//     const navigationItems = [
//         { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
//         { id: 'active-medicines', label: 'Active Medicines', icon: '💊' },
//         { id: 'reminders', label: 'Reminders', icon: '⏰' },
//         { id: 'health-tracking', label: 'Health Tracking', icon: '📊' },
//         { id: 'medicines', label: 'Manage Medicines', icon: '⚕️' },
//         { id: 'contact', label: 'Contact Us', icon: '✉️' }
//     ];

//     const renderNavigation = () => (
//         <div className="bg-white shadow-sm border-b border-gray-200 mb-6 sticky top-0 z-10">
//             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//                 <nav className="flex justify-evenly py-4 overflow-x-auto">
//                     {navigationItems.map((item) => (
//                         <button
//                             key={item.id}
//                             onClick={() => setCurrentPage(item.id)}
//                             className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${currentPage === item.id
//                                 ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm'
//                                 : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
//                                 }`}
//                         >
//                             <span className="text-lg mr-2">{item.icon}</span>
//                             {item.label}
//                         </button>
//                     ))}
//                 </nav>
//             </div>
//         </div>
//     );

//     const renderCurrentPage = () => {
//         switch (currentPage) {
//             case 'active-medicines': return <ActiveMedicines />;
//             case 'reminders': return <Reminders />;
//             case 'health-tracking': return <HealthTracking />;
//             case 'medicines': return renderMedicineManagement();
//             case 'contact': return <ContactPage />;
            
//             // 🔥 ADDED CASE FOR HISTORY REDIRECT
//             case 'history-section': return (
//                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
//                     <div className="mb-4">
//                         <button onClick={() => setCurrentPage('dashboard')} className="text-blue-600 mb-2">← Back to Dashboard</button>
//                     </div>
//                     {/* Pass the key here to force reload */}
//                     <HistorySection forceUpdateKey={historyUpdateKey}/>
//                 </div>
//             );

//             default: return renderDashboardHome();
//         }
//     };

//     const renderMedicineManagement = () => (
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//             <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
//                 <div className="flex justify-between items-center mb-6">
//                     <div>
//                         <h2 className="text-2xl font-bold text-gray-900">Medicine Management</h2>
//                         <p className="text-gray-600 mt-1">Add, edit, and manage your medications</p>
//                     </div>
//                     <button onClick={handleAddMedicine} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center">
//                         <span className="text-lg mr-2">+</span>
//                         Add Medicine
//                     </button>
//                 </div>
//                 {showMedicineForm ? (
//                     <MedicineForm medicine={editingMedicine} onCancel={handleFormCancel} onSuccess={handleFormSuccess} />
//                 ) : (
//                     <MedicineList onEdit={handleEditMedicine} />
//                 )}
//             </div>
//         </div>
//     );

//     const renderDashboardHome = () => (
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
//             {/* STATUS CARD */}
//             <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
//                 <div className="flex justify-between items-center mb-2">
//                     <div>
//                         <h3 className="text-green-900 font-bold">{notificationStatus || "Checking Permissions..."}</h3>
//                         <p className="text-green-700 text-sm">Your phone will ring for scheduled medicines.</p>
//                     </div>
//                     <div className="flex flex-col space-y-2">
//                         <button 
//                             onClick={handleEnableNotifications}
//                             className="bg-blue-600 text-white px-4 py-2 rounded text-sm shadow hover:bg-blue-700"
//                         >
//                             Check Permissions
//                         </button>
//                     </div>
//                 </div>
                
//                 {/* Last Sync Indicator */}
//                 <div className="flex justify-between items-center pt-2 border-t border-green-200 text-xs text-green-700 font-medium">
//                     <span>☁️ Cloud Sync: {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Waiting...'}</span>
//                     <button onClick={() => syncOfflineData()} className="underline hover:text-green-900">
//                         Sync Now
//                     </button>
//                 </div>
//             </div>

//             {permission !== 'granted' ? (
//                 <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
//                     <div className="flex items-center">
//                         <div className="text-4xl mr-4">🔔</div>
//                         <div className="flex-1">
//                             <h3 className="text-xl font-semibold text-blue-900 mb-2">Enable Mobile Alarms</h3>
//                             <button
//                                 onClick={handleEnableNotifications}
//                                 className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md"
//                             >
//                                 Enable Notifications
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             ) : (
//                 <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex justify-between items-center">
//                     <div>
//                         <h3 className="text-green-900 font-bold">✅ Alarms Active</h3>
//                         <p className="text-green-700 text-sm">Your phone will ring for scheduled medicines.</p>
//                     </div>
//                     <button 
//                         onClick={handleTestNotification}
//                         className="bg-green-600 text-white px-4 py-2 rounded text-sm shadow hover:bg-green-700"
//                     >
//                         Test Alarm (5s)
//                     </button>
//                 </div>
//             )}

//             <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
//                <div onClick={() => setCurrentPage('active-medicines')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-pink-300">
//                    <div className="text-center">
//                        <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
//                            <span className="text-white text-3xl">💊</span>
//                        </div>
//                        <h3 className="text-xl font-bold text-gray-900 mb-2">Active Medicines</h3>
//                    </div>
//                </div>
//                <div onClick={() => setCurrentPage('reminders')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-orange-300">
//                    <div className="text-center">
//                        <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
//                            <span className="text-white text-3xl">⏰</span>
//                        </div>
//                        <h3 className="text-xl font-bold text-gray-900 mb-2">Reminders</h3>
//                    </div>
//                </div>
//                <div onClick={() => setCurrentPage('health-tracking')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-purple-300">
//                    <div className="text-center">
//                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
//                            <span className="text-white text-3xl">📊</span>
//                        </div>
//                        <h3 className="text-xl font-bold text-gray-900 mb-2">Health Tracking</h3>
//                    </div>
//                </div>
//                <div onClick={() => setCurrentPage('medicines')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-green-300">
//                    <div className="text-center">
//                        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
//                            <span className="text-white text-3xl">⚕️</span>
//                        </div>
//                        <h3 className="text-xl font-bold text-gray-900 mb-2">Manage Medicines</h3>
//                    </div>
//                </div>
//             </div>

//             {/* 🔥 FIXED: Pass the key so history reloads when notification is clicked */}
//             <HistorySection forceUpdateKey={historyUpdateKey}/>

//             <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mt-8">
//                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Health Overview</h2>
//                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//                     <div className="flex items-center p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
//                         <div className="text-4xl text-blue-600 mr-4">🎯</div>
//                         <div>
//                             <h3 className="text-lg font-semibold text-gray-900">Today's Goals</h3>
//                             <p className="text-gray-600">Stay consistent</p>
//                         </div>
//                     </div>
//                     <div className="flex items-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
//                         <div className="text-4xl text-green-600 mr-4">✅</div>
//                         <div>
//                             <h3 className="text-lg font-semibold text-gray-900">Health Progress</h3>
//                             <p className="text-gray-600">Track your adherence</p>
//                         </div>
//                     </div>
//                     <div className="flex items-center p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
//                         <div className="text-4xl text-purple-600 mr-4">🏆</div>
//                         <div>
//                             <h3 className="text-lg font-semibold text-gray-900">Achievements</h3>
//                             <p className="text-gray-600">Celebrate milestones</p>
//                         </div>
//                     </div>
//                  </div>
//             </div>
//         </div>
//     );

//     return (
//         <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
//             {/* {renderNavigation()} */}
            
//       {/* ------------------- START PERMISSION ALERT ------------------- */}
//  <div className="flex justify-between items-center pt-2 border-t border-yellow-200 text-xs text-yellow-700 font-medium mt-2">
//     <span className="flex items-center">
//         <span className="mr-1">⚠️</span> 
//         <span>Reliability: Check Autostart</span>
//     </span>
//     <button onClick={openAppDetails} className="underline hover:text-yellow-900">
//         Fix Settings
//     </button>
// </div>
//     {/* ------------------- END PERMISSION ALERT ------------------- */}

    
//             {renderCurrentPage()}
//             <AiChatbot />
//         </div>
//     );
// };

// export default Dashboard;