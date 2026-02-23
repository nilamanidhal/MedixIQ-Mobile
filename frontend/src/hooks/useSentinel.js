import { Capacitor, registerPlugin } from '@capacitor/core';
import { useState, useEffect, useRef } from 'react';
import { Motion } from '@capacitor/motion';
import { Preferences } from '@capacitor/preferences';
import { Geolocation } from '@capacitor/geolocation';
import { AccidentDetector } from '../utils/accidentDetector';
import { cacheCurrentLocation, getLastKnownLocation } from '../utils/locationCache';

// Load our custom native Android plugin
const SentinelNative = registerPlugin('Sentinel');

export const useSentinel = () => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [accidentDetected, setAccidentDetected] = useState(false);
    const detector = useRef(new AccidentDetector());
    const locationTimer = useRef(null);

    // Load initial state
    useEffect(() => {
        const loadState = async () => {
            const { value } = await Preferences.get({ key: 'sentinel_enabled' });
            if (value === 'true') {
                setIsEnabled(true);
                startMonitoring();
            }
        };
        loadState();

        // Cleanup on unmount
        return () => stopMonitoring();
    }, []);

   const toggleSentinel = async (state) => {
        if (state) {
            // 🚨 NEW: Ask for Location Permission BEFORE starting the service
            if (Capacitor.isNativePlatform()) {
                try {
                    const perm = await Geolocation.checkPermissions();
                    if (perm.location !== 'granted') {
                        const req = await Geolocation.requestPermissions();
                        if (req.location !== 'granted') {
                            alert("Sentinel Mode requires Location permission to send your coordinates in an emergency.");
                            return; // Abort turning it on if they deny
                        }
                    }
                } catch (e) {
                    console.log("Permission check skipped or failed", e);
                }
            }
        }

        setIsEnabled(state);
        await Preferences.set({ key: 'sentinel_enabled', value: state ? 'true' : 'false' });
        
        if (state) {
            startMonitoring();
        } else {
            stopMonitoring();
        }
    };

    const startMonitoring = async () => {
        try {
            // 1. Start Android Foreground Service (keeps app alive)
           if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.startService) {
                await SentinelNative.startService();
            }

            // 2. Start GPS Caching (Every 5 minutes)
            cacheCurrentLocation(); // Immediate first cache
            locationTimer.current = setInterval(() => {
                cacheCurrentLocation();
            }, 5 * 60 * 1000);

            // 3. Start Accelerometer Listener
            await Motion.addListener('accel', (event) => {
                // Pass data to our physics algorithm
                const isAccident = detector.current.processReading(event);
                
                if (isAccident) {
                    triggerEmergencyProtocol();
                }
            });

        } catch (e) {
            console.error("Sentinel start failed", e);
        }
    };

    const stopMonitoring = async () => {
        if (locationTimer.current) clearInterval(locationTimer.current);
        await Motion.removeAllListeners();
        
        if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.stopService) {
            await SentinelNative.stopService();
        }
    };

    const triggerEmergencyProtocol = () => {
        setAccidentDetected(true); // This will trigger the UI Overlay
    };

    const cancelEmergency = () => {
        setAccidentDetected(false);
        detector.current = new AccidentDetector(); // Reset algorithm
    };

    // 🔥 NEW: Trigger the Lock Screen Notification
    const showLockScreenInfo = async (profileData) => {
if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.showMedicalIdNotification && profileData?.token) {            await SentinelNative.showMedicalIdNotification({
                token: profileData.token,
                name: profileData.name,
                bloodGroup: profileData.bloodGroup
            });
        }
    };

    // 🔥 NEW: Function to manually test the UI and SMS
    const simulateAccident = () => {
        console.log("Simulating accident...");
        triggerEmergencyProtocol();
    };

    const executeSmsDispatch = async (profileData) => {
        setAccidentDetected(false); // Hide overlay
        
        try {
            // 1. Show Lock Screen Notification
            if (profileData) showLockScreenInfo(profileData);

            // 2. Send SMS
            const loc = await getLastKnownLocation();
            
            // Fixed standard Google Maps link format
            const mapLink = loc ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : "Location unknown";
            
            const contactPhone = profileData?.emergencyContacts?.[0]?.phone;
            if (!contactPhone) return alert("No emergency contact set!");

            const message = `🚨 EMERGENCY - MedixIQ Alert\n${profileData?.name} may be in an accident.\nLocation: ${mapLink}\nBlood: ${profileData?.bloodGroup || 'N/A'}\nMed Info: https://medmind-heathcare.netlify.app/emergency/${profileData?.token}`;

            // 📱 CALL OUR NATIVE ANDROID SMS PLUGIN
         if (Capacitor.isNativePlatform() && SentinelNative && SentinelNative.sendEmergencySms) {
                await SentinelNative.sendEmergencySms({
                    phone: contactPhone,
                    message: message
                });
                alert("Emergency SMS Dispatched Successfully.");
            } else {
                // 👇 Fallback for testing in the browser
                console.log("SIMULATED SMS SENT:", message);
                alert("Web Mode: SMS Simulation logged to console.");
            }
        } catch (error) {
            console.error("SMS Dispatch Failed", error);
            alert("Failed to send emergency SMS.");
        }
    };

    return {
        isEnabled,
        toggleSentinel,
        accidentDetected,
        cancelEmergency,
        executeSmsDispatch,
        simulateAccident // 👈 EXPORT SIMULATOR
    };
};