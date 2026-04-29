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

            const { value: pendingAccident } = await Preferences.get({ key: 'pending_accident' });
            const { value: accidentTime } = await Preferences.get({ key: 'accident_timestamp' });

            if (pendingAccident === 'true') {
                const now = Date.now();
                const timestamp = accidentTime ? parseInt(accidentTime) : 0;
                const ageSeconds = (now - timestamp) / 1000;
                console.log("Pending accident age:", ageSeconds, "seconds");

                if (ageSeconds < 30) {
                    setAccidentDetected(true);
                } else {
                    console.log("Stale accident ignored");
                }
                await Preferences.remove({ key: 'pending_accident' });
                await Preferences.remove({ key: 'accident_timestamp' });
            }
        };
        loadState();

        let listener;
        const setupListener = async () => {
            try {
                listener = await SentinelNative.addListener('ACCIDENT_FIRED', async () => {
                    console.log("🚨 Accident event from native!");
                    setAccidentDetected(true);
                    await Preferences.remove({ key: 'pending_accident' });
                });
            } catch (e) {
                console.error("Listener setup failed:", e);
            }
        };
        setupListener();

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
                console.log(" Sentinel native service started");
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

    //  Helper — emergency data Preferences se padho
    const getEmergencyDataFromPrefs = async () => {
        try {
            const { value } = await Preferences.get({ key: 'emergency_profile_native' });
            if (value) {
                const parsed = JSON.parse(value);
                console.log("getEmergencyDataFromPrefs:", JSON.stringify(parsed));
                return parsed;
            }
        } catch (e) {
            console.error("getEmergencyDataFromPrefs error:", e);
        }
        return {};
    };

    //  FIXED saveEmergencyDataForNative — data properly build karo
    const saveEmergencyDataForNative = async (directData = null) => {
        try {
            const { value: smsVal } = await Preferences.get({ key: 'sentinel_sms_enabled' });
            const smsEnabled = smsVal || 'true';

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
                    smsEnabled: smsEnabled
                };
            } else {
                // Preferences se padho
                const existing = await getEmergencyDataFromPrefs();

                // Check karo data valid hai ya nahi
                if (!existing || !existing.name || existing.name === 'Unknown') {
                    console.warn(" No valid emergency profile in Preferences");
                    return;
                }

                data = {
                    name: existing.name || 'Unknown',
                    bloodGroup: existing.bloodGroup || 'Unknown',
                    allergies: existing.allergies || 'None',
                    meds: existing.meds || 'None',
                    emergencyPhone: existing.emergencyPhone || '',
                    smsEnabled: smsEnabled
                };
            }

            console.log("Saving to native:", JSON.stringify(data));

            //  Preferences mein bhi update karo with smsEnabled
            await Preferences.set({
                key: 'emergency_profile_native',
                value: JSON.stringify(data)
            });

            if (Capacitor.isNativePlatform() && SentinelNative?.saveEmergencyData) {
                await SentinelNative.saveEmergencyData(data);
                console.log(" Saved to native SharedPreferences");
            }
        } catch (e) {
            console.error("saveEmergencyDataForNative failed:", e);
        }
    };

    const toggleSentinel = async (state) => {
        if (state && Capacitor.isNativePlatform()) {

            //  Pehle check karo emergency data valid hai ya nahi
        const { value } = await Preferences.get({ 
            key: 'emergency_profile_native' 
        });
        
        if (!value) {
            alert(" Please save your Emergency Profile first before enabling Sentinel Mode.");
            return;
        }
        
        const parsed = JSON.parse(value);
        if (!parsed.name || parsed.name === 'Unknown' || !parsed.emergencyPhone) {
            alert(
                "Incomplete Emergency Profile!\n\n" +
                "Please go to Emergency Profile, fill your details, and save before enabling Sentinel Mode."
            );
            return;
        }

            // Fix 1: GPS check — sirf permission check karo, timeout pe block mat karo
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const permStatus = await Geolocation.checkPermissions();

                if (permStatus.location !== 'granted') {
                    const result = await Geolocation.requestPermissions();
                    if (result.location !== 'granted') {
                        alert(
                            "⚠️ Location Permission Required\n\n" +
                            "Sentinel Mode needs location to send GPS in emergency SMS.\n\n" +
                            "Please enable from Settings → App Permissions → Location."
                        );
                        return; // Block karo
                    }
                }

                //  Permission granted — GPS on hai ya nahi sirf warn karo, block mat karo
                // (timeout error pe confirm nahi dikhana — sirf log karo)
                console.log(" Location permission granted");

            } catch (e) {
                console.log("Location check error:", e);
                // Error pe bhi continue karo
            }

            // SMS preference
            const wantsSms = window.confirm(
                "🚨 Emergency SMS Setting\n\n" +
                "If accident detected, automatically send SMS to emergency contact?\n\n" +
                "OK = Yes  |  Cancel = No, only show alert on device"
            );

            await Preferences.set({
                key: 'sentinel_sms_enabled',
                value: wantsSms ? 'true' : 'false'
            });

            console.log("SMS enabled:", wantsSms);
        }

        setIsEnabled(state);
        await Preferences.set({
            key: 'sentinel_enabled',
            value: state ? 'true' : 'false'
        });

        if (state) {
            await saveEmergencyDataForNative(); //  Ye sahi data bhejega
            await startNativeService();
        } else {
            await stopNativeService();
        }
    };

    const cancelEmergency = () => setAccidentDetected(false);

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

            const message = `🚨 EMERGENCY - MedixIQ Alert\n${profileData?.name || 'Unknown'} may be in an accident.\nLocation: ${mapLink}\nBlood: ${profileData?.bloodGroup || 'Unknown'}\nAllergies: ${allergies}\nMeds: ${publicMeds}`;

            if (Capacitor.isNativePlatform() && SentinelNative?.sendEmergencySms) {
                await SentinelNative.sendEmergencySms({ phone: contactPhone, message });
                alert("Emergency SMS Dispatched!");
            }
        } catch (error) {
            console.error("SMS Dispatch Failed", error);
        }
    };

    const simulateAccident = () => setAccidentDetected(true);

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