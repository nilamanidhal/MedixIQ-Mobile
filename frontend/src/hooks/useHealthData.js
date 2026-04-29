import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';

export const useHealthData = (timeRange = 7) => {
    const [data, setData] = useState({
        adherenceRate: 0, 
        totalMedicines: 0, 
        activeMedicines: 0,
        weeklyProgress: [],
        medicineBreakdown: [],
        worstSlot: null,
        timeSlots: {},
        worstDay: null,
        weeklyPattern: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth();

    const setCachedData = async (key, value) => {
        try { await Preferences.set({ key, value: JSON.stringify(value) }); } 
        catch (e) { console.error("Cache error", e); }
    };

    const getCachedData = async (key) => {
        try {
            const { value } = await Preferences.get({ key });
            return value ? JSON.parse(value) : null;
        } catch (e) { return null; }
    };

    const fetchHealthData = useCallback(async () => {
        if (!token) return;
        setLoading(true);

        try {
            // 1. Load native offline data instantly
            const cachedData = await getCachedData(`health_data_${timeRange}`);
            if (cachedData) {
                setData(cachedData);
                setLoading(false); 
            }

            // 2. Check for internet
            const status = await Network.getStatus();
            if (!status.connected) {
                if (!cachedData) setError("Offline: No saved health data.");
                return; 
            }

            // 3. Fetch all endpoints
            const [statsRes, timeRes, patternRes] = await Promise.all([
                axios.get(`/tracking/stats?range=${timeRange}`),
                axios.get('/tracking/time-analysis'),
                axios.get('/tracking/weekly-pattern')
            ]);

            // 4. THE FIX: Map data EXACTLY how your backend sends it!
            const freshData = {
                adherenceRate: statsRes.data.adherenceRate || 0,
                totalMedicines: statsRes.data.totalMedicines || 0,
                activeMedicines: statsRes.data.activeMedicines || 0,
                weeklyProgress: statsRes.data.weeklyProgress || [],
                medicineBreakdown: statsRes.data.medicineBreakdown || [],
                worstSlot: timeRes.data.worstSlot,
                timeSlots: timeRes.data.timeSlots,
                worstDay: patternRes.data.worstDay,
                weeklyPattern: patternRes.data.pattern
            };

            setData(freshData);
            await setCachedData(`health_data_${timeRange}`, freshData);
            setError(null);

        } catch (err) {
            console.error('Error fetching health data:', err);
            const cachedData = await getCachedData(`health_data_${timeRange}`);
            if (!cachedData) {
                setError('Failed to load health insights');
            }
        } finally {
            setLoading(false);
        }
    }, [token, timeRange]);

    useEffect(() => {
        fetchHealthData();
    }, [fetchHealthData]);

    return { data, loading, error, refetch: fetchHealthData };
};
