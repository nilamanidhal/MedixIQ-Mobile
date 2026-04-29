import React, { createContext, useContext } from 'react';
import { useSentinel } from '../hooks/useSentinel'; // Make sure path is correct
import EmergencyOverlay from '../components/EmergencyOverlay';
import axios from 'axios';
import { useAuth } from './AuthContext';

const SentinelContext = createContext();

export const SentinelProvider = ({ children }) => {
    // This runs the hook exactly ONCE for the whole app
    const sentinelData = useSentinel(); 
    const { token, API_BASE_URL } = useAuth();

// Replace your existing handleEmergencyTimeout with this:
    const handleEmergencyTimeout = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/emergency/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // FIX: Combine publicData and the token into one object
            const fullData = {
                ...res.data.profile.publicData,
                token: res.data.profile.token
            };
            
            sentinelData.executeSmsDispatch(fullData);
        } catch (e) {
            console.error("Failed to fetch profile for SMS", e);
            sentinelData.executeSmsDispatch(null); 
        }
    };

    // const handleEmergencyTimeout = async () => {
    //     try {
    //         const res = await axios.get(`${API_BASE_URL}/emergency/profile`, {
    //             headers: { Authorization: `Bearer ${token}` }
    //         });
    //         sentinelData.executeSmsDispatch(res.data.profile.publicData);
    //     } catch (e) {
    //         console.error("Failed to fetch profile for SMS", e);
    //         sentinelData.executeSmsDispatch(null); 
    //     }
    // };

    return (
        <SentinelContext.Provider value={sentinelData}>
            {children}
            
            {/* The Global Overlay */}
            {sentinelData.accidentDetected && (
                <EmergencyOverlay 
                    onCancel={sentinelData.cancelEmergency} 
                    onTimeout={handleEmergencyTimeout} 
                />
            )}
        </SentinelContext.Provider>
    );
};

export const useSentinelContext = () => useContext(SentinelContext);