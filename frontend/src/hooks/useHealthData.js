import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const CACHE_KEY = 'health_tracking_cache';

export const useHealthData = (range = 7) => {
    const { token, API_BASE_URL } = useAuth();
    
    // 1. ⚡ INSTANT LOAD: Initialize state directly from LocalStorage
    const [stats, setStats] = useState(() => {
        try {
            // ✅ READ: Correctly looking for specific range key
            const cached = localStorage.getItem(`${CACHE_KEY}_${range}`);
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            return null;
        }
    });

    // Only show "loading" spinner if we have absolutely NO data (fresh install)
    // If we have cache, we show that immediately while fetching in background
    const [loading, setLoading] = useState(!stats); 
    
    useEffect(() => {
        const fetchHealthStats = async () => {
            if (!token) return;

            // Optional: Uncomment next line if you want spinner every time range changes
            // But keeping it commented makes the UI feel faster (shows old data until new arrives)
            // setLoading(true); 

            try {
                // 2. Network Fetch (Background)
                const res = await axios.get(`${API_BASE_URL}/tracking/stats?range=${range}`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                
                const freshData = res.data;

                // 3. Update State & Cache
                if (JSON.stringify(freshData) !== JSON.stringify(stats)) {
                    setStats(freshData);
                    // ✅ WRITE: FIX - Use the same key structure as the READ
                    localStorage.setItem(`${CACHE_KEY}_${range}`, JSON.stringify(freshData));
                }
            } catch (error) {
                console.error("Background sync failed, using cached data:", error);
                // 4. OFFLINE HANDLER
                // If network fails, we rely on the initial state we loaded from LocalStorage.
                // We don't need to do anything else, just turn off loading.
            } finally {
                setLoading(false);
            }
        };

        fetchHealthStats();
    }, [token, range]); // Re-run when range changes

    return { stats, loading };
};










// import { useState, useEffect } from 'react';
// import axios from 'axios';
// import { useAuth } from '../contexts/AuthContext';

// const CACHE_KEY = 'health_tracking_cache';

// export const useHealthData = (range = 7) => {
//     const { token, API_BASE_URL } = useAuth();
    
//     // 1. ⚡ INSTANT LOAD: Initialize state directly from LocalStorage
//     const [stats, setStats] = useState(() => {
//         try {
//             const cached = localStorage.getItem(`${CACHE_KEY}_${range}`);
//             return cached ? JSON.parse(cached) : null;
//         } catch (e) {
//             return null;
//         }
//     });

//     // Only show "loading" spinner if we have absolutely NO data (fresh install)
//     const [loading, setLoading] = useState(!stats); 
    
//     useEffect(() => {
//     const fetchHealthStats = async () => {
//         if (!token) return;

//         setLoading(true); // Show loader when switching ranges

//         try {
//             // 2. Network Fetch (Background)
//             // Use the base URL from context (handles dev/prod automatically)
//             const res = await axios.get(`${API_BASE_URL}/tracking/stats?range=${range}`, { 
//                 headers: { Authorization: `Bearer ${token}` } 
//             });
            
//             const freshData = res.data;

//             // 3. Update State & Cache ONLY if data changed (prevents re-renders)
//             if (JSON.stringify(freshData) !== JSON.stringify(stats)) {
//                 setStats(freshData);
//                 localStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
//             }
//         } catch (error) {
//             console.error("Background sync failed, using cached data:", error);
//             // We intentionally swallow the error so the UI stays stable with cached data
//         } finally {
//             setLoading(false);
//         }
//     };


//         fetchHealthStats();
//     }, [token, range]); 

//     return { stats, loading };
// };