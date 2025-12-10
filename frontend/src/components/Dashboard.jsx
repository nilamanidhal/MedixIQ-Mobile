import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useMedicines } from '../hooks/useMedicines'; 
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// import { AndroidSettings, IOSSettings, NativeSettings } from 'capacitor-native-settings'; // Optional if you have a settings plugin,

// --- FIXED IMPORTS START HERE ---
// 1. Medicines are in the sibling 'medicines' folder
import MedicineForm from './medicines/MedicineForm';
import MedicineList from './medicines/MedicineList';

// 2. These pages are inside the 'pages' folder, so we add '/pages/'
import ActiveMedicines from './pages/ActiveMedicines';
import Reminders from './pages/Reminders';
import HealthTracking from './pages/HealthTraking'; // Keeping your file name typo 'Traking'
import HistorySection from './pages/HistorySection';
import ContactPage from './pages/ContactPage';

// 3. AiChatbot is in the same folder as Dashboard, so './' is correct
import AiChatbot from './AiChatbot'; 
// --- FIXED IMPORTS END HERE ---

const Dashboard = () => {
    const { user } = useAuth();
    const { syncOfflineData, lastSyncTime } = useMedicines();
    // const { syncOfflineData } = useMedicines(); 

    const {
        permission,
        requestPermission
    } = useNotifications();

    const [showMedicineForm, setShowMedicineForm] = useState(false);
    const [editingMedicine, setEditingMedicine] = useState(null);
    const [notificationStatus, setNotificationStatus] = useState('');
    const [currentPage, setCurrentPage] = useState('dashboard');
    
    // --- 1. INITIAL SETUP & SYNC ---
    useEffect(() => {
        syncOfflineData();

        const checkPerms = async () => {
            const perm = await LocalNotifications.checkPermissions();
            
            if (perm.display === 'granted') {
                setNotificationStatus("Notifications Active ✅");
            } else {
                console.log("Notification permission not yet granted. Requesting now...");
                // Requesting this usually triggers the "Exact Alarm" prompt on Android 12+
                await LocalNotifications.requestPermissions();
            }
        };
        checkPerms();
        
        LocalNotifications.addListener('localNotificationActionPerformed', (payload) => {
            console.log('Notification Tapped:', payload);
            setCurrentPage('reminders');
        });

        return () => {
            LocalNotifications.removeAllListeners();
        };
    }, []);

    // --- 2. HANDLERS ---
    const handleEnableNotifications = async () => {
        const granted = await requestPermission();
        if (granted) {
            setNotificationStatus('Notifications Active ✅');
            alert("Permissions Granted! You will hear alarms for your medicines.");
        } else {
            setNotificationStatus('Permission Denied ❌');
            alert("We need permission to play alarms for your medicine.");
        }
    };

    const handleTestNotification = async () => {
       // 1. Create the channel specifically for testing too
        await LocalNotifications.createChannel({
            id: 'medmind_alarm_v2', // <--- MATCH THE NEW ID
            name: 'Medicine Alarms',
            importance: 5,
            visibility: 1,
            vibration: true,
            sound: 'alarm_sound.wav', 
        });

        // 2. Schedule the test
        await LocalNotifications.schedule({
            notifications: [{
                title: "Test Alarm 🔔",
                body: "This is how your medicine reminder will sound.",
                id: 99999,
                schedule: { at: new Date(Date.now() + 5000) },
                channelId: 'medmind_alarm_v2', // <--- IMPORTANT: Link to the loud channel
                sound: 'alarm_sound.wav', 
                actionTypeId: "",
                extra: null
            }]
        });
        alert("Wait 5 seconds... (Exit the app to test background sound)");
    };

    const handleAddMedicine = () => {
        setEditingMedicine(null);
        setShowMedicineForm(true);
        setCurrentPage('medicines');
    };

    const handleEditMedicine = (medicine) => {
        setEditingMedicine(medicine);
        setShowMedicineForm(true);
        setCurrentPage('medicines');
    };

    const handleFormSuccess = () => {
        setShowMedicineForm(false);
        setEditingMedicine(null);
    };

    const handleFormCancel = () => {
        setShowMedicineForm(false);
        setEditingMedicine(null);
    };

    // --- 3. NAVIGATION UI ---
    const navigationItems = [
        { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
        { id: 'active-medicines', label: 'Active Medicines', icon: '💊' },
        { id: 'reminders', label: 'Reminders', icon: '⏰' },
        { id: 'health-tracking', label: 'Health Tracking', icon: '📊' },
        { id: 'medicines', label: 'Manage Medicines', icon: '⚕️' },
        { id: 'contact', label: 'Contact Us', icon: '✉️' }
    ];

    const renderNavigation = () => (
        <div className="bg-white shadow-sm border-b border-gray-200 mb-6 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <nav className="flex justify-evenly py-4 overflow-x-auto">
                    {navigationItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentPage(item.id)}
                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${currentPage === item.id
                                ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
                                }`}
                        >
                            <span className="text-lg mr-2">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>
            </div>
        </div>
    );

    const renderCurrentPage = () => {
        switch (currentPage) {
            case 'active-medicines': return <ActiveMedicines />;
            case 'reminders': return <Reminders />;
            case 'health-tracking': return <HealthTracking />;
            case 'medicines': return renderMedicineManagement();
            case 'contact': return <ContactPage />;
            default: return renderDashboardHome();
        }
    };

    const renderMedicineManagement = () => (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Medicine Management</h2>
                        <p className="text-gray-600 mt-1">Add, edit, and manage your medications</p>
                    </div>
                    <button onClick={handleAddMedicine} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center">
                        <span className="text-lg mr-2">+</span>
                        Add Medicine
                    </button>
                </div>
                {showMedicineForm ? (
                    <MedicineForm medicine={editingMedicine} onCancel={handleFormCancel} onSuccess={handleFormSuccess} />
                ) : (
                    <MedicineList onEdit={handleEditMedicine} />
                )}
            </div>
        </div>
    );

    const renderDashboardHome = () => (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            {/* <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome, {user?.name}! 👋</h1>
                <p className="text-xl text-gray-600">Manage your health and medications effectively with MediMind (Mobile)</p>
            </div> */}

            {/* STATUS CARD */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
                <div className="flex justify-between items-center mb-2">
                    <div>
                        <h3 className="text-green-900 font-bold">{notificationStatus || "Checking Permissions..."}</h3>
                        <p className="text-green-700 text-sm">Your phone will ring for scheduled medicines.</p>
                    </div>
                    <div className="flex flex-col space-y-2">
                        <button 
                            onClick={handleEnableNotifications}
                            className="bg-blue-600 text-white px-4 py-2 rounded text-sm shadow hover:bg-blue-700"
                        >
                            Check Permissions
                        </button>
                    </div>
                </div>
                
                {/* NEW: Last Sync Indicator */}
                <div className="flex justify-between items-center pt-2 border-t border-green-200 text-xs text-green-700 font-medium">
                    <span>☁️ Cloud Sync: {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Waiting...'}</span>
                    <button onClick={() => syncOfflineData()} className="underline hover:text-green-900">
                        Sync Now
                    </button>
                </div>
            </div>

            {permission !== 'granted' ? (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
                    <div className="flex items-center">
                        <div className="text-4xl mr-4">🔔</div>
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-blue-900 mb-2">Enable Mobile Alarms</h3>
                            <p className="text-blue-700 mb-4">Allow MediMind to play sounds when it's time for your medicine.</p>
                            <button
                                onClick={handleEnableNotifications}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md"
                            >
                                Enable Notifications
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex justify-between items-center">
                    <div>
                        <h3 className="text-green-900 font-bold">✅ Alarms Active</h3>
                        <p className="text-green-700 text-sm">Your phone will ring for scheduled medicines.</p>
                    </div>
                    <button 
                        onClick={handleTestNotification}
                        className="bg-green-600 text-white px-4 py-2 rounded text-sm shadow hover:bg-green-700"
                    >
                        Test Alarm (5s)
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
               <div onClick={() => setCurrentPage('active-medicines')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-pink-300">
                   <div className="text-center">
                       <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                           <span className="text-white text-3xl">💊</span>
                       </div>
                       <h3 className="text-xl font-bold text-gray-900 mb-2">Active Medicines</h3>
                       {/* <p className="text-gray-600">Track your current medications</p> */}
                   </div>
               </div>
               <div onClick={() => setCurrentPage('reminders')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-orange-300">
                   <div className="text-center">
                       <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                           <span className="text-white text-3xl">⏰</span>
                       </div>
                       <h3 className="text-xl font-bold text-gray-900 mb-2">Reminders</h3>
                       {/* <p className="text-gray-600">Never miss a dose</p> */}
                   </div>
               </div>
               <div onClick={() => setCurrentPage('health-tracking')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-purple-300">
                   <div className="text-center">
                       <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                           <span className="text-white text-3xl">📊</span>
                       </div>
                       <h3 className="text-xl font-bold text-gray-900 mb-2">Health Tracking</h3>
                       {/* <p className="text-gray-600">Monitor your progress</p> */}
                   </div>
               </div>
               <div onClick={() => setCurrentPage('medicines')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-green-300">
                   <div className="text-center">
                       <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                           <span className="text-white text-3xl">⚕️</span>
                       </div>
                       <h3 className="text-xl font-bold text-gray-900 mb-2">Manage Medicines</h3>
                       {/* <p className="text-gray-600">Add, edit, and view your medications</p> */}
                   </div>
               </div>
            </div>

            <HistorySection />

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mt-8">
                 <h2 className="text-2xl font-bold text-gray-900 mb-6">Health Overview</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                        <div className="text-4xl text-blue-600 mr-4">🎯</div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Today's Goals</h3>
                            <p className="text-gray-600">Stay consistent with your medication schedule</p>
                        </div>
                    </div>
                    <div className="flex items-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                        <div className="text-4xl text-green-600 mr-4">✅</div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Health Progress</h3>
                            <p className="text-gray-600">Track your adherence and improvements</p>
                        </div>
                    </div>
                    <div className="flex items-center p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                        <div className="text-4xl text-purple-600 mr-4">🏆</div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Achievements</h3>
                            <p className="text-gray-600">Celebrate your health milestones</p>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            {renderNavigation()}
            {renderCurrentPage()}
            <AiChatbot />
        </div>
    );
};

export default Dashboard;









// import React, { useEffect, useState } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { useNotifications } from '../hooks/useNotifications';
// import MedicineForm from './medicines/MedicineForm';
// import MedicineList from './medicines/MedicineList';
// import ActiveMedicines from './pages/ActiveMedicines';
// import Reminders from './pages/Reminders';
// import HealthTracking from './pages/HealthTraking';
// import HistorySection from './pages/HistorySection';
// import ContactPage from './pages/ContactPage';
// import AiChatbot from './AiChatbot'; 
// import { Capacitor } from '@capacitor/core';

// const Dashboard = () => {
//     const { user } = useAuth();
//     const {
//         loading: notificationsLoading, 
//         isSupported,
//         permission,
//         requestPermission,
//         subscribeToNotifications,
//         sendTestNotification
//     } = useNotifications();

//     const [showMedicineForm, setShowMedicineForm] = useState(false);
//     const [editingMedicine, setEditingMedicine] = useState(null);
//     const [notificationStatus, setNotificationStatus] = useState('');
//     const [currentPage, setCurrentPage] = useState('dashboard');
//     const [alarmEnabled, setAlarmEnabled] = useState(localStorage.getItem('alarmEnabled') === 'true');
//     const [alarmDuration, setAlarmDuration] = useState(localStorage.getItem('alarmDuration') || '5');
//     const [isTestingAlarm, setIsTestingAlarm] = useState(false);
//     const [isRealAlarmActive, setIsRealAlarmActive] = useState(false);
//     const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);

//     // === THIS IS THE CORRECTED EFFECT ===
//     useEffect(() => {
//         const setupNotifications = async () => {
//             // This check is the important part.
//             // We only subscribe IF permission is granted.
//             if (isSupported && permission === 'granted') {
//                 console.log('[Dashboard] Permission is granted, attempting to subscribe...');
//                 const subscribed = await subscribeToNotifications();
//                 if (subscribed) {
//                     setNotificationStatus("Notifications are active and saved to server ✅");
//                 }
//             } else if (!notificationsLoading && isSupported && permission !== 'default') {
//                  console.log(`[Dashboard] Permission is: ${permission}. Not subscribing.`);
//             }
//         };

//         // Only run this logic *after* the hook has finished loading
//         if (!notificationsLoading) {
//             setupNotifications();
//         }
//     // The dependency array is changed to NOT include the 'subscribeToNotifications' function,
//     // which was causing the infinite loop. This effect now only runs when the
//     // core status (loading, support, permission) changes.
//     }, [isSupported, permission, notificationsLoading]); 
//     // ===================================


//     // Alarm logic and service worker listener
//     const toggleAlarm = () => {
//         if (!alarmEnabled) {
//             setIsAlarmModalOpen(true);
//         } else {
//             setAlarmEnabled(false);
//             localStorage.setItem('alarmEnabled', 'false');
//             stopAlarm();
//             alert('🔕 Alarm disabled.');
//         }
//     };

//     const saveAlarmSettings = (duration) => {
//         setAlarmDuration(duration);
//         localStorage.setItem('alarmDuration', duration);
//         setAlarmEnabled(true);
//         localStorage.setItem('alarmEnabled', 'true');
//         setIsAlarmModalOpen(false);
//         const durationText = duration === 'until' ? 'Until stopped manually' : `${duration}s`;
//         alert(`✅ Alarm enabled for ${durationText}`);
//     };

//     const playTestAlarm = () => {
//         if (!alarmEnabled) {
//             alert('⚠️ Please enable the alarm first!');
//             return;
//         }
//         if (isTestingAlarm) return;
//         setIsTestingAlarm(true);
//         stopAlarm();
//         const audio = new Audio('/alarm.wav');
//         audio.loop = true;
//         audio.play().catch(error => console.error("Audio play failed:", error));
//         window.currentAlarm = audio;
//         setTimeout(() => {
//             stopAlarm();
//             setIsTestingAlarm(false);
//         }, 2000);
//     };

//     const stopAlarm = () => {
//         if (window.currentAlarm) {
//             window.currentAlarm.pause();
//             window.currentAlarm.currentTime = 0;
//             window.currentAlarm = null;
//         }
//         setIsTestingAlarm(false);
//         setIsRealAlarmActive(false);
//     };

//     useEffect(() => {
//         const handleMessage = (event) => {
//             if (event.data?.type === 'PLAY_ALARM') {
//                 const enabled = localStorage.getItem('alarmEnabled') === 'true';
//                 if (!enabled) return;
//                 stopAlarm();
//                 const audio = new Audio('/alarm.wav');
//                 audio.loop = true;
//                 window.currentAlarm = audio;
//                 audio.play().catch(error => {
//                     console.error("Real alarm play failed due to autoplay restrictions:", error);
//                     alert("Reminder: Time for your medicine! Click anywhere on the page to hear the sound.");
//                 });
//                 setIsRealAlarmActive(true);
//                 const dur = localStorage.getItem('alarmDuration') || '5';
//                 if (dur !== 'until') {
//                     setTimeout(() => stopAlarm(), parseInt(dur, 10) * 1000);
//                 }
//             }
//         };
//         if ('serviceWorker' in navigator) {
//             navigator.serviceWorker.addEventListener('message', handleMessage);
//         }
//         return () => {
//             if ('serviceWorker' in navigator) {
//                 navigator.serviceWorker.removeEventListener('message', handleMessage);
//             }
//         };
//     }, []);


//     // Original handler functions
//     const handleEnableNotifications = async () => {
//         if (permission !== 'granted') {
//             const granted = await requestPermission();
//             if (!granted) {
//                 setNotificationStatus('Notifications permission denied');
//                 return;
//             }
//         }
//         // The useEffect will now automatically handle subscription
//         // when permission changes to 'granted'.
//     };

//     const handleTestNotification = async () => {
//         const sent = await sendTestNotification();
//         if (sent) {
//             setNotificationStatus('Test notification sent!');
//         } else {
//             setNotificationStatus('Failed to send test notification');
//         }
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
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//             <div className="mb-8">
//                 <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome, {user?.name}! 👋</h1>
//                 <p className="text-xl text-gray-600">Manage your health and medications effectively with MediMind</p>
//             </div>

//             {/* WRAP THE NOTIFICATION SECTION IN THE LOADING CHECK */}
//             {!notificationsLoading && (
//                 <>
//                     {/* Card 1: Enable Notifications */}
//                     {isSupported && permission !== 'granted' && (
//                         <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
//                             <div className="flex items-center">
//                                 <div className="text-4xl mr-4">🔔</div>
//                                 <div className="flex-1">
//                                     <h3 className="text-xl font-semibold text-blue-900 mb-2">
//                                         Enable Smart Notifications
//                                     </h3>
//                                     <p className="text-blue-700 mb-4">
//                                         Get reminded when it's time to take your medicines.
//                                     </p>
//                                     <button
//                                         onClick={handleEnableNotifications}
//                                         className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md"
//                                     >
//                                         Enable Notifications
//                                     </button>
//                                 </div>
//                             </div>
//                         </div>
//                     )}

//                     {/* Card 2: Notification & Alarm Settings */}
//                     {permission === 'granted' && (
//                         <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-8">
//                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
//                                 {/* Left Column: Info */}
//                                 <div>
//                                     <h3 className="text-2xl font-bold text-green-900 mb-2 flex items-center">
//                                         <span className="text-3xl mr-3">🔔</span>
//                                         Notification & Alarm Settings
//                                     </h3>
//                                     <p className="text-green-800 mb-1">
//                                         You will receive smart reminders for your medicines.
//                                     </p>
//                                     <p className="text-sm text-green-700">
//                                         Use the buttons to test notifications or manage alarm sounds.
//                                     </p>
//                                 </div>
//                                 {/* Right Column: Buttons */}
//                                 <div className="flex flex-col items-stretch space-y-3">
//                                     <button onClick={handleTestNotification} className="w-full text-center bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md">
//                                         Send Test Notification
//                                     </button>
//                                     <button onClick={playTestAlarm} disabled={isTestingAlarm} className={`w-full text-center px-6 py-2 rounded-lg font-medium shadow-md transition-all ${isTestingAlarm ? 'bg-yellow-300 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`}>
//                                         {isTestingAlarm ? '🔊 Testing Alarm...' : '🔊 Test Alarm Sound'}
//                                     </button>
//                                     <button onClick={toggleAlarm} className={`w-full text-center px-6 py-2 rounded-lg font-medium transition-colors shadow-md ${alarmEnabled ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 hover:bg-gray-400 text-black'}`}>
//                                         {alarmEnabled ? '🔕 Disable Alarm' : '🔔 Enable Alarm'}
//                                     </button>
//                                 </div>
//                             </div>
//                         </div>
//                     )}
//                 </>
//             )}

//             {/* Main Action Cards */}
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//                <div onClick={() => setCurrentPage('active-medicines')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-pink-300">
//                    <div className="text-center">
//                        <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
//                            <span className="text-white text-3xl">💊</span>
//                        </div>
//                        <h3 className="text-xl font-bold text-gray-900 mb-2">Active Medicines</h3>
//                        <p className="text-gray-600">Track your current medications</p>
//                    </div>
//                </div>
//                <div onClick={() => setCurrentPage('reminders')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-orange-300">
//                    <div className="text-center">
//                        <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
//                            <span className="text-white text-3xl">⏰</span>
//                        </div>
//                        <h3 className="text-xl font-bold text-gray-900 mb-2">Reminders</h3>
//                        <p className="text-gray-600">Never miss a dose</p>
//                    </div>
//                </div>
//                <div onClick={() => setCurrentPage('health-tracking')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-purple-300">
//                    <div className="text-center">
//                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
//                            <span className="text-white text-3xl">📊</span>
//                        </div>
//                        <h3 className="text-xl font-bold text-gray-900 mb-2">Health Tracking</h3>
//                        <p className="text-gray-600">Monitor your progress</p>
//                    </div>
//                </div>
//                <div onClick={() => setCurrentPage('medicines')} className="group bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:border-green-300">
//                    <div className="text-center">
//                        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
//                            <span className="text-white text-3xl">⚕️</span>
//                        </div>
//                        <h3 className="text-xl font-bold text-gray-900 mb-2">Manage Medicines</h3>
//                        <p className="text-gray-600">Add, edit, and view your medications</p>
//                    </div>
//                </div>
//             </div>

//             <HistorySection />

//             <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mt-8">
//                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Health Overview</h2>
//                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//                     <div className="flex items-center p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
//                         <div className="text-4xl text-blue-600 mr-4">🎯</div>
//                         <div>
//                             <h3 className="text-lg font-semibold text-gray-900">Today's Goals</h3>
//                             <p className="text-gray-600">Stay consistent with your medication schedule</p>
//                         </div>
//                     </div>
//                     <div className="flex items-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
//                         <div className="text-4xl text-green-600 mr-4">✅</div>
//                         <div>
//                             <h3 className="text-lg font-semibold text-gray-900">Health Progress</h3>
//                             <p className="text-gray-600">Track your adherence and improvements</p>
//                         </div>
//                     </div>
//                     <div className="flex items-center p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
//                         <div className="text-4xl text-purple-600 mr-4">🏆</div>
//                         <div>
//                             <h3 className="text-lg font-semibold text-gray-900">Achievements</h3>
//                             <p className="text-gray-600">Celebrate your health milestones</p>
//                         </div>
//                     </div>
//                  </div>
//             </div>

//             {/* Modal and Stop Button Logic */}
//             {isAlarmModalOpen && (
//                 <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
//                     <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
//                         <h3 className="text-xl font-semibold mb-4 text-gray-800 text-center">Select Alarm Duration</h3>
//                         <div className="grid grid-cols-3 gap-2 mb-4">
//                             {['5', '10', '15', '30', '60', 'until'].map((d) => (
//                                 <button key={d} onClick={() => saveAlarmSettings(d)} className="px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium">
//                                     {d === 'until' ? 'Until Stop' : d === '60' ? '1 min' : `${d}s`}
//                                 </button>
//                             ))}
//                         </div>
//                         <button onClick={() => setIsAlarmModalOpen(false)} className="w-full bg-gray-300 hover:bg-gray-400 rounded-lg py-2 font-medium">
//                             Cancel
//                         </button>
//                     </div>
//                 </div>
//             )}
//             {isRealAlarmActive && (
//                 <div className="fixed bottom-6 right-6 z-50">
//                     <button onClick={stopAlarm} className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-full font-bold shadow-lg animate-bounce">
//                         🛑 Stop Alarm
//                     </button>
//                 </div>
//             )}
//         </div>
//     );

//     return (
//         <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
//             {renderNavigation()}
//             {renderCurrentPage()}
//             <AiChatbot />
//         </div>
//     );
// };

// export default Dashboard;