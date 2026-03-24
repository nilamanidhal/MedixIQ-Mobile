import { Capacitor, registerPlugin } from '@capacitor/core';
import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';

const SentinelNative = registerPlugin('Sentinel');

export const useSentinel = () => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [accidentDetected, setAccidentDetected] = useState(false);

   useEffect(() => {
    const loadState = async () => {
        const { value } = await Preferences.get({ key: 'sentinel_enabled' });
        if (value === 'true') {
            setIsEnabled(true);
            await startNativeService();
        }

        // ✅ App open hone pe check karo — kya accident hua tha jab app band tha?
        const { value: pendingAccident } = await Preferences.get({
            key: 'pending_accident'
        });
        if (pendingAccident === 'true') {
            console.log("🚨 Pending accident found on app open!");
            setAccidentDetected(true);
            // Clear the flag
            await Preferences.remove({ key: 'pending_accident' });
        }
    };
    loadState();

    // ✅ Capacitor notifyListeners — app open/background ke liye
    let listener;
    const setupListener = async () => {
        try {
            listener = await SentinelNative.addListener('ACCIDENT_FIRED', async () => {
                console.log("🚨 Accident event from native!");
                setAccidentDetected(true);
                // Clear pending flag
                await Preferences.remove({ key: 'pending_accident' });
            });
        } catch (e) {
            console.error("Listener setup failed:", e);
        }
    };
    setupListener();

    // ✅ Window event fallback
    const onWindowAccident = () => setAccidentDetected(true);
    window.addEventListener('SENTINEL_ACCIDENT', onWindowAccident);

    return () => {
        if (listener) listener.remove();
        window.removeEventListener('SENTINEL_ACCIDENT', onWindowAccident);
    };
}, []);

    const startNativeService = async () => {
        try {
            if (Capacitor.isNativePlatform() && SentinelNative?.startService) {
                await SentinelNative.startService();
                console.log("✅ Sentinel native service started");
            }
        } catch (e) {
            console.error("Sentinel start failed", e);
        }
    };

    const stopNativeService = async () => {
        try {
            if (Capacitor.isNativePlatform() && SentinelNative?.stopService) {
                await SentinelNative.stopService();
            }
        } catch (e) {
            console.error("Sentinel stop failed", e);
        }
    };


const toggleSentinel = async (state) => {
    if (state && Capacitor.isNativePlatform()) {
        // ✅ Location permission pehle maango — FGS ke liye zaruri hai
        try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const perm = await Geolocation.requestPermissions();
            console.log("Location permission:", perm);
        } catch (e) {
            console.log("Location perm error:", e);
        }
    }

    setIsEnabled(state);
    await Preferences.set({
        key: 'sentinel_enabled',
        value: state ? 'true' : 'false'
    });

    if (state) {
        await saveEmergencyDataForNative();
        await startNativeService();
    } else {
        await stopNativeService();
    }
};


const saveEmergencyDataForNative = async (directData = null) => {
    try {
        let data;

        if (directData) {
            // Direct data from EmergencySetupPage
            data = {
                name: directData?.name || 'Unknown',
                bloodGroup: directData?.bloodGroup || 'Unknown',
                allergies: Array.isArray(directData?.allergies)
                    ? directData.allergies.filter(a => a).join(', ')
                    : directData?.allergies || 'None',
                meds: directData?.medicines
                    ?.filter(m => m.isPublic)
                    ?.map(m => m.name)
                    ?.join(', ') || 'None',
                emergencyPhone: directData?.emergencyContacts?.[0]?.phone || '',
            };
        } else {
            // ✅ BOTH keys try karo
            const { value: nativeVal } = await Preferences.get({ 
                key: 'emergency_profile_native' 
            });
            const { value: profileVal } = await Preferences.get({ 
                key: 'emergency_profile' 
            });

            const rawVal = nativeVal || profileVal;

            if (!rawVal) {
                console.warn("⚠️ No emergency profile found!");
                return;
            }

            const parsed = JSON.parse(rawVal);
            console.log("Raw parsed data:", JSON.stringify(parsed));

            // ✅ Handle both data structures
            if (parsed.publicData) {
                // emergency_profile structure
                const pd = parsed.publicData;
                data = {
                    name: pd?.name || 'Unknown',
                    bloodGroup: pd?.bloodGroup || 'Unknown',
                    allergies: Array.isArray(pd?.allergies)
                        ? pd.allergies.filter(a => a).join(', ')
                        : pd?.allergies || 'None',
                    meds: pd?.medicines
                        ?.filter(m => m.isPublic)
                        ?.map(m => m.name)
                        ?.join(', ') || 'None',
                    emergencyPhone: pd?.emergencyContacts?.[0]?.phone || '',
                };
            } else {
                // emergency_profile_native structure (already flat)
                data = {
                    name: parsed?.name || 'Unknown',
                    bloodGroup: parsed?.bloodGroup || 'Unknown',
                    allergies: parsed?.allergies || 'None',
                    meds: parsed?.meds || 'None',
                    emergencyPhone: parsed?.emergencyPhone || '',
                };
            }
        }

        console.log("Final data to native:", JSON.stringify(data));

        // ✅ Save correct data to both keys
        await Preferences.set({
            key: 'emergency_profile_native',
            value: JSON.stringify(data)
        });

        if (Capacitor.isNativePlatform() && SentinelNative?.saveEmergencyData) {
            await SentinelNative.saveEmergencyData(data);
            console.log("✅ Correct data saved to native SharedPreferences");
        }
    } catch (e) {
        console.error("saveEmergencyDataForNative failed:", e);
    }
};


    const cancelEmergency = () => setAccidentDetected(false);

    // JS executeSmsDispatch is now ONLY for manual/web fallback
    // Real emergency SMS is sent by Java directly (Fix 2)
    const executeSmsDispatch = async (profileData) => {
        setAccidentDetected(false);
        try {
            const { value: locValue } = await Preferences.get({ key: 'last_known_location' });
            const loc = locValue ? JSON.parse(locValue) : null;
            const mapLink = loc
                ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}`
                : 'Location unknown';

            const contactPhone = profileData?.emergencyContacts?.[0]?.phone;
            if (!contactPhone) return alert("No emergency contact set!");

            const publicMeds = profileData?.medicines
                ?.filter(m => m.isPublic).map(m => m.name).join(', ') || 'None';
            const allergies = profileData?.allergies?.join(', ') || 'None';

            const message = `🚨 EMERGENCY - MedixIQ Alert
${profileData?.name || 'Unknown'} may be in an accident.
Location: ${mapLink}
Blood: ${profileData?.bloodGroup || 'Unknown'}
Allergies: ${allergies}
Meds: ${publicMeds}`;

            if (Capacitor.isNativePlatform() && SentinelNative?.sendEmergencySms) {
                await SentinelNative.sendEmergencySms({
                    phone: contactPhone,
                    message
                });
                alert("Emergency SMS Dispatched!");
            } else {
                console.log("SIMULATED SMS:", message);
                alert("Web Mode: SMS logged to console.");
            }
        } catch (error) {
            console.error("SMS Dispatch Failed", error);
        }
    };

    const simulateAccident = () => {
        // ✅ Simulate via notifyListeners path too
        setAccidentDetected(true);
    };

    return {
        isEnabled,
        toggleSentinel,
        accidentDetected,
        cancelEmergency,
        executeSmsDispatch,
        simulateAccident,
        saveEmergencyDataForNative
    };
};

















// import { Capacitor, registerPlugin } from '@capacitor/core';
// import { useState, useEffect, useRef } from 'react';
// import { Motion } from '@capacitor/motion';
// import { Preferences } from '@capacitor/preferences';
// import { Geolocation } from '@capacitor/geolocation';
// import { AccidentDetector } from '../utils/accidentDetector';
// import { cacheCurrentLocation, getLastKnownLocation } from '../utils/locationCache';

// // Load our custom native Android plugin
// const SentinelNative = registerPlugin('Sentinel');

// export const useSentinel = () => {
//     const [isEnabled, setIsEnabled] = useState(false);
//     const [accidentDetected, setAccidentDetected] = useState(false);
//     const detector = useRef(new AccidentDetector());
//     const locationTimer = useRef(null);

//     // Load initial state
//     useEffect(() => {
//         const loadState = async () => {
//             const { value } = await Preferences.get({ key: 'sentinel_enabled' });
//             if (value === 'true') {
//                 setIsEnabled(true);
//                 startMonitoring();
//             }
//         };
//         loadState();

//         // Cleanup on unmount
//         return () => stopMonitoring();
//     }, []);

// const toggleSentinel = async (state) => {
//         if (state) {
//             if (Capacitor.isNativePlatform()) {
//                 try {
//                     // Check both fine and coarse location just in case
//                     const perm = await Geolocation.checkPermissions();
//                     if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
//                         const req = await Geolocation.requestPermissions();
//                         if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
//                             // 🟢 FIX: Just warn the user, but DO NOT block the toggle anymore!
//                             alert("⚠️ Location permission seems restricted. Sentinel will still start, but SOS messages might not have your exact GPS coordinates.");
//                         }
//                     }
//                 } catch (e) {
//                     console.log("Permission check skipped or failed", e);
//                 }
//             }
//         }

//         // Proceed to turn it on regardless of the plugin's confusion
//         setIsEnabled(state);
//         await Preferences.set({ key: 'sentinel_enabled', value: state ? 'true' : 'false' });
        
//         if (state) {
//             startMonitoring();
//         } else {
//             stopMonitoring();
//         }
//     };

//     const startMonitoring = async () => {
//         try {
//             // 1. Start Android Foreground Service (keeps app alive)
//            if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.startService) {
//                 await SentinelNative.startService();
//             }

//             // 2. Start GPS Caching (Every 5 minutes)
//             cacheCurrentLocation(); // Immediate first cache
//             locationTimer.current = setInterval(() => {
//                 cacheCurrentLocation();
//             }, 5 * 60 * 1000);

//             // 3. Start Accelerometer Listener
//             await Motion.addListener('accel', (event) => {
//                 // Pass data to our physics algorithm
//                 const isAccident = detector.current.processReading(event);
                
//                 if (isAccident) {
//                     triggerEmergencyProtocol();
//                 }
//             });

//         } catch (e) {
//             console.error("Sentinel start failed", e);
//         }
//     };

//     const stopMonitoring = async () => {
//         if (locationTimer.current) clearInterval(locationTimer.current);
//         await Motion.removeAllListeners();
        
//         if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.stopService) {
//             await SentinelNative.stopService();
//         }
//     };

//    const triggerEmergencyProtocol = async () => {
//         console.log("Accident triggered! Waking up screen...");
        
//         // 🔥 NEW: Force Android to turn the screen on and open the app over the lock screen!
//         if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.bringAppToForeground) {
//             await SentinelNative.bringAppToForeground();
//         }
        
//         setAccidentDetected(true); // This shows the red Overlay UI
//     };

//     const cancelEmergency = () => {
//         setAccidentDetected(false);
//         detector.current = new AccidentDetector(); // Reset algorithm
//     };

//     // 🔥 NEW: Trigger the Lock Screen Notification
// //     const showLockScreenInfo = async (profileData) => {
// // if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.showMedicalIdNotification && profileData?.token) {            await SentinelNative.showMedicalIdNotification({
// //                 token: profileData.token,
// //                 name: profileData.name,
// //                 bloodGroup: profileData.bloodGroup
// //             });
// //         }
// //     };


// const showLockScreenInfo = async (profileData) => {
//         if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.showMedicalIdNotification) {
            
//             // Format the data just like we did for the SMS
//             const publicMeds = profileData?.medicines?.filter(m => m.isPublic).map(m => m.name).join(', ') || 'None';
//             const allergies = profileData?.allergies?.join(', ') || 'None';

//             await SentinelNative.showMedicalIdNotification({
//                 name: profileData?.name || 'Unknown',
//                 bloodGroup: profileData?.bloodGroup || 'Unknown',
//                 allergies: allergies,
//                 meds: publicMeds
//             });
//         }
//     };

//     // 🔥 NEW: Function to manually test the UI and SMS
//     const simulateAccident = async () => {
//         console.log("Simulating accident...");
//        await triggerEmergencyProtocol();
//     };

// const executeSmsDispatch = async (profileData) => {
//         setAccidentDetected(false); // Hide overlay
        
//         try {
//             if (profileData) showLockScreenInfo(profileData);

//             const loc = await getLastKnownLocation();
//             const mapLink = loc ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : "Location unknown";
            
//             const contactPhone = profileData?.emergencyContacts?.[0]?.phone;
//             if (!contactPhone) return alert("No emergency contact set in your profile!");

//             // 🔥 FIX: Format a direct-data SMS instead of sending a link
//             const publicMeds = profileData?.medicines?.filter(m => m.isPublic).map(m => m.name).join(', ') || 'None';
//             const allergies = profileData?.allergies?.join(', ') || 'None';

//             const message = `🚨 EMERGENCY - MedixIQ Alert
// ${profileData?.name || 'Unknown User'} may be in an accident.
// Location: ${mapLink}
// Blood: ${profileData?.bloodGroup || 'Unknown'}
// Allergies: ${allergies}
// Meds: ${publicMeds}`;

//             // 📱 CALL OUR NATIVE ANDROID SMS PLUGIN
//             if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.sendEmergencySms) {
//                 await SentinelNative.sendEmergencySms({
//                     phone: contactPhone,
//                     message: message
//                 });
//                 alert("Emergency SMS Dispatched Successfully.");
//             } else {
//                 console.log("SIMULATED SMS SENT:", message);
//                 alert("Web Mode: SMS Simulation logged to console.");
//             }
//         } catch (error) {
//             console.error("SMS Dispatch Failed", error);
//             alert("Failed to send emergency SMS.");
//         }
//     };

//     // const executeSmsDispatch = async (profileData) => {
//     //     setAccidentDetected(false); // Hide overlay
        
//     //     try {
//     //         // 1. Show Lock Screen Notification
//     //         if (profileData) showLockScreenInfo(profileData);

//     //         // 2. Send SMS
//     //         const loc = await getLastKnownLocation();
            
//     //         // Fixed standard Google Maps link format
//     //         const mapLink = loc ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : "Location unknown";
            
//     //         const contactPhone = profileData?.emergencyContacts?.[0]?.phone;
//     //         if (!contactPhone) return alert("No emergency contact set!");

//     //         const message = `🚨 EMERGENCY - MedixIQ Alert\n${profileData?.name} may be in an accident.\nLocation: ${mapLink}\nBlood: ${profileData?.bloodGroup || 'N/A'}\nMed Info: https://medmind-heathcare.netlify.app/emergency/${profileData?.token}`;

//     //         // 📱 CALL OUR NATIVE ANDROID SMS PLUGIN
//     //      if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.sendEmergencySms) {
//     //             await SentinelNative.sendEmergencySms({
//     //                 phone: contactPhone,
//     //                 message: message
//     //             });
//     //             alert("Emergency SMS Dispatched Successfully.");
//     //         } else {
//     //             // 👇 Fallback for testing in the browser
//     //             console.log("SIMULATED SMS SENT:", message);
//     //             alert("Web Mode: SMS Simulation logged to console.");
//     //         }
//     //     } catch (error) {
//     //         console.error("SMS Dispatch Failed", error);
//     //         alert("Failed to send emergency SMS.");
//     //     }
//     // };

//     return {
//         isEnabled,
//         toggleSentinel,
//         accidentDetected,
//         cancelEmergency,
//         executeSmsDispatch,
//         simulateAccident // 👈 EXPORT SIMULATOR
//     };
// };