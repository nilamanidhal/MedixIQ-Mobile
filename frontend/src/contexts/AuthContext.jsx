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

// 4. LOGIN (Fixed)
    const login = async (email, password) => {
        // ❌ REMOVED: setLoading(true) - Let the Login component handle its own button loading!
        try {
            const response = await axios.post('/auth/login', { email, password });
            const { token, user } = response.data;
            
            localStorage.setItem('token', token);
            localStorage.setItem('user_data', JSON.stringify(user));
            
            setToken(token);
            setUser(user);
            return { success: true };
        } catch (error) {
            // Update error message to warn users about the sleeping server!
            const msg = error.response?.data?.message || 'Network Error. (If the server was asleep, try again in 30s!)';
            return { success: false, message: msg };
        }
    };

    // 5. REGISTER (Fixed)
    const register = async (userData) => {
        // ❌ REMOVED: setLoading(true)
        try {
            const response = await axios.post('/auth/register', userData);
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user_data', JSON.stringify(user));
            
            setToken(token);
            setUser(user);
            return { success: true };
        } catch (error) {
            const msg = error.response?.data?.message || 'Network Error. (If the server was asleep, try again in 30s!)';
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
        localStorage.removeItem('token');
        localStorage.removeItem('user_data');

        //SECURITY FIX: WIPE ALL OFFLINE DATA
    localStorage.removeItem('cached_medicines');
    localStorage.removeItem('cached_medicine_logs');
    localStorage.removeItem('offline_mutation_queue');

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


