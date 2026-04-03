import { auth } from '../firebase';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,onIdTokenChanged
} from 'firebase/auth';
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { Network } from '@capacitor/network';
import { LocalNotifications } from '@capacitor/local-notifications';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    // 1. INITIALIZE STATE FROM LOCAL STORAGE (Instant Offline Access)
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user_data');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    
    const [token, setToken] = useState(() => localStorage.getItem('token') || null);

    // 🔥 THE MAGIC FIX: Listen for background token refreshes automatically!
    useEffect(() => {
        const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Firebase just silently generated a fresh, unexpired token!
                const freshToken = await firebaseUser.getIdToken();
                
                // Update everything so axios stops throwing 401 errors
                localStorage.setItem('token', freshToken);
                setToken(freshToken);
                axios.defaults.headers.common['Authorization'] = `Bearer ${freshToken}`;
            } else {
                // User actually clicked Log Out
                delete axios.defaults.headers.common['Authorization'];
            }
        });

        // Cleanup listener when app closes
        return () => unsubscribe();
    }, []);
    
    // We start loading as FALSE because we trust the local storage first.
    // This allows the app to render the Dashboard immediately even if offline.
    const [loading, setLoading] = useState(false);

    // Use environment variable, fallback to your specific local IP if needed for testing
    const API_BASE_URL = import.meta.env.VITE_API_URL || "http://192.168.1.5:5000/api"; 
    axios.defaults.baseURL = API_BASE_URL;

    // 2. TOKEN & HEADER MANAGEMENT
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Try to refresh user data in background, but don't block UI
            validateSession();
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    // 3. SMART SESSION VALIDATION
    const validateSession = async () => {
        const status = await Network.getStatus();
        
        // Only try to fetch profile if we have internet
        if (status.connected) {
            try {
                const response = await axios.get('/auth/profile');
                const updatedUser = response.data.user;
                
                // Update local storage with fresh data
                setUser(updatedUser);
                localStorage.setItem('user_data', JSON.stringify(updatedUser));
                
            } catch (error) {
                console.error('Session validation check:', error);
                
                // CRITICAL: Only logout if the server explicitly says "Unauthorized" (401).
                // If it's a network error (status 0) or server error (500), KEEP THE USER LOGGED IN.
                if (error.response && error.response.status === 401) {
                    logout();
                }
            }
        } else {
            console.log("Offline: Skipping session validation, trusting local data.");
        }
    };

// 🔥 NEW FIREBASE LOGIN
    const login = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // 🚨 STRICT CHECK: Is the email actually verified?
            if (!userCredential.user.emailVerified) {
                await signOut(auth); // Log them back out instantly
                return { success: false, message: "Please verify your email address. Check your inbox!" };
            }

            const firebaseToken = await userCredential.user.getIdToken();
            
            const response = await axios.get('/auth/me', {
                headers: { Authorization: `Bearer ${firebaseToken}` }
            });
            
            localStorage.setItem('token', firebaseToken);
            localStorage.setItem('user_data', JSON.stringify(response.data.user));
            
            setToken(firebaseToken);
            setUser(response.data.user);
            return { success: true };
        } catch (error) {
            console.error("Firebase Login Error:", error);
            const msg = error.code === 'auth/invalid-credential' 
                ? "Invalid email or password." 
                : "Login failed. Please try again.";
            return { success: false, message: msg };
        }
    };

    // 🔥 NEW FIREBASE REGISTER
   const register = async (userData) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
            const firebaseToken = await userCredential.user.getIdToken();

            // 🚨 SEND THE VERIFICATION EMAIL
            await sendEmailVerification(userCredential.user);

            // Create their profile in your MongoDB database
            await axios.post('/auth/register-profile', {
                name: userData.name,
                email: userData.email,
                age: userData.age,
                gender: userData.gender,
                firebaseUid: userCredential.user.uid
            }, {
                headers: { Authorization: `Bearer ${firebaseToken}` }
            });

            // 🚨 LOG THEM OUT IMMEDIATELY SO THEY CANNOT ENTER THE APP YET
            await signOut(auth);
            
            // Return a special flag so the UI knows what happened
            return { success: true, needsVerification: true };
            
        } catch (error) {
            console.error("Firebase Register Error:", error);
            const msg = error.code === 'auth/email-already-in-use'
                ? "This email is already registered."
                : "Registration failed. Please try again.";
            return { success: false, message: msg };
        }
    };


    //LOGOUT
    const logout = async () => {
        try {
        // 🛑 1. CANCEL ALL SCHEDULED ALARMS
        // We get all pending notifications and cancel them immediately.
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel(pending);
            console.log("🔔 All alarms cancelled on logout");
        }
    } catch (error) {
        console.error("Error cancelling notifications:", error);
    }
       // ✅ localStorage clear
    localStorage.removeItem('token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('cached_medicines');
    localStorage.removeItem('cached_medicine_logs');
    localStorage.removeItem('offline_mutation_queue');
    localStorage.removeItem('last_sync_time');
    localStorage.removeItem('prefs_migrated');


    // ✅ Preferences bhi clear karo — naya user ka data mix na ho
    try {
        await Preferences.remove({ key: 'offline_mutation_queue' });
        await Preferences.remove({ key: 'cached_medicines' });
        await Preferences.remove({ key: 'cached_medicine_logs' });
        await Preferences.remove({ key: 'emergency_profile_native' });
        await Preferences.remove({ key: 'sentinel_enabled' });
        await Preferences.remove({ key: 'sentinel_sms_enabled' });
        await Preferences.remove({ key: 'auth_token' });
    } catch (e) {
        console.error("Preferences clear error:", e);
    }

    await signOut(auth);
     setToken(null);
        setUser(null);
    };
    
    // 7. UPDATE PROFILE
    const updateProfile = async (profileData) => {
        try {
            const response = await axios.put('/auth/profile', profileData);
            const updatedUser = response.data.user;
            
            setUser(updatedUser);
            localStorage.setItem('user_data', JSON.stringify(updatedUser));
            
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Network error' };
        }
    };

    const value = {
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        API_BASE_URL,
    };

    // We removed the "!loading &&" check so children render immediately based on local data
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


