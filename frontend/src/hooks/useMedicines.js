import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Network } from '@capacitor/network';
import axios from 'axios';
import { addToQueue, getQueue, saveQueue, saveMedicinesToCache, getCachedMedicines, saveLogsToCache, getCachedLogs } from '../utils/offlineStorage';
import { scheduleMedicineReminder, cancelMedicineReminders } from '../utils/LocalNotificationManager';

// ⚡ EVENT HELPER: Triggers all hooks to reload when data changes
const triggerGlobalUpdate = () => {
    window.dispatchEvent(new Event('medmind_data_updated'));
};

// 🔒 GLOBAL LOCK: Prevents double-syncing
let isSyncingGlobal = false;

// Helper function to find the next N scheduled times
const getScheduledTimesForMedicine = (medicine, days = 2) => {
    const schedules = [];
    if (!medicine.times || medicine.times.length === 0) return schedules;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(medicine.duration?.endDate || '2100-01-01');
    endDate.setHours(23, 59, 59, 999);

    for (let day = 0; day < days; day++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + day);
        
        // Stop if we exceed the medicine's end date
        if (checkDate > endDate) break;

        for (const timeStr of medicine.times) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const scheduleTime = new Date(checkDate);
            scheduleTime.setHours(hours, minutes, 0, 0);

            // Only schedule future or current logs
            if (scheduleTime <= endDate) {
                schedules.push({
                    time: scheduleTime,
                    timeStr: timeStr,
                    dateStr: scheduleTime.toISOString().split('T')[0]
                });
            }
        }
    }
    return schedules;
};

export const useMedicines = () => {
    const [medicines, setMedicines] = useState([]);
    const [logs, setLogs] = useState([]); 
    const [loading, setLoading] = useState(true);
    const { token, API_BASE_URL } = useAuth();
    const isAddingRef = useRef(false);

    useEffect(() => {
        loadData(); 

        const netListener = Network.addListener('networkStatusChange', status => {
            if (status.connected) syncOfflineData();
        });

        const updateListener = () => loadData(true); 
        window.addEventListener('medmind_data_updated', updateListener);

        return () => {
            netListener.remove();
            window.removeEventListener('medmind_data_updated', updateListener);
        };
    }, []);
    
    // --- NEW LOGIC: GENERATE MISSING PENDING LOGS ---
    const generatePendingLogs = (currentMeds, currentLogs) => {
        const updatedLogs = [...currentLogs];
        const logMap = new Set();
        
        // Create a fast lookup key for existing logs: "MED_ID-DATE-TIME"
        currentLogs.forEach(log => {
            const medId = log.medicineId?._id || log.medicineId;
            const dateStr = new Date(log.date).toISOString().split('T')[0];
            const timeStr = log.time?.split(':').slice(0, 2).join(':') || ''; // Normalize time to HH:MM
            logMap.add(`${medId}-${dateStr}-${timeStr}`);
        });

        for (const med of currentMeds) {
            const medId = med._id;
            const schedules = getScheduledTimesForMedicine(med, 2); // Check for the next 2 days

            for (const schedule of schedules) {
                const timeStrNormalized = schedule.timeStr;
                const dateStrNormalized = schedule.dateStr;
                const mapKey = `${medId}-${dateStrNormalized}-${timeStrNormalized}`;

                // If a log for this specific time/date/medicine doesn't exist, create it as pending.
                if (!logMap.has(mapKey)) {
                    const tempLogId = `log_gen_${Date.now()}_${Math.random()}`; // Unique temp ID
                    const newLogEntry = {
                        _id: tempLogId,
                        medicineId: { _id: medId, name: med.name },
                        status: 'pending',
                        date: schedule.time.toISOString(), // Full ISO string
                        time: timeStrNormalized,
                        pendingSync: medId.toString().startsWith('temp_') ? true : false, // Only set sync flag for temp meds
                        clientLogId: tempLogId,
                        medicineClientId: med.clientId || medId
                    };
                    updatedLogs.push(newLogEntry);
                    logMap.add(mapKey); // Add the new log to the set so we don't duplicate it
                }
            }
        }
        
        // Final sort and return
        return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };


    // --- 1. LOAD DATA (Sorted to fix Jumping and Add Pending) ---
    const loadData = async (onlyCache = false) => {
        let cachedMeds = getCachedMedicines();
        
        // 🔥 SORTING FIX: Ensure Newest (Offline) items stay at top
        const sortedMeds = cachedMeds.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
        });
        
        let cachedLogs = getCachedLogs();
        
        // 🔥 NEW LOGIC: Inject missing pending logs before setting state
        let finalLogs = generatePendingLogs(sortedMeds, cachedLogs);

        setMedicines(sortedMeds);
        setLogs(finalLogs);
        setLoading(false);
        saveLogsToCache(finalLogs); // Save the generated logs to cache

        if (onlyCache) return; 

        const status = await Network.getStatus();
        if (status.connected && token) {
            try {
                // Fetch & Merge Logic
                const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
                const serverMedicines = resMeds.data.medicines;
                
                let serverLogs = [];
                try {
                    const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
                    serverLogs = resLogs.data.logs || [];
                } catch(e) { /* ignore log errors */ }

                // Merge Meds
                const localTempMeds = sortedMeds.filter(m => m._id.toString().startsWith('temp_'));
                const mergedMeds = [...localTempMeds, ...serverMedicines]
                    .filter((v,i,a)=>a.findIndex(v2=>(v2._id===v._id))===i)
                    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                
                // Regenerate logs based on merged data (will overwrite local pending with server data if available)
                finalLogs = generatePendingLogs(mergedMeds, serverLogs); 

                setMedicines(mergedMeds);
                saveMedicinesToCache(mergedMeds);
                setLogs(finalLogs);
                saveLogsToCache(finalLogs);

            } catch (e) { console.log("Using offline cache."); }
        }
    };

    // --- 2. ADD MEDICINE (No change needed here) ---
    const addMedicine = async (medicineData) => {
        if (isAddingRef.current) return { success: false, message: "Processing..." };
        isAddingRef.current = true;

        try {
            const tempId = `temp_${Date.now()}`;
            const newMedicine = { 
                ...medicineData, 
                _id: tempId, 
                clientId: tempId, 
                pendingSync: true,
                createdAt: new Date().toISOString(), 
                times: medicineData.times || [],
                duration: medicineData.duration || { startDate: new Date(), endDate: new Date() }
            };

            const currentCache = getCachedMedicines();
            const newList = [newMedicine, ...currentCache]; 
            saveMedicinesToCache(newList);
            setMedicines(newList); 
            
            // Reload logs to generate pending entries for this new medicine
            await loadData(true); 
            
            await scheduleMedicineReminder(newMedicine);

            addToQueue('ADD', { ...newMedicine }); 

            const status = await Network.getStatus();
            if (status.connected) syncOfflineData();

            return { success: true };
        } finally {
            isAddingRef.current = false;
        }
    };

    // --- 3. UPDATE MEDICINE (No change needed here) ---
    const updateMedicine = async (id, medicineData) => {
        // 1. Update Local Cache
        const currentCache = getCachedMedicines();
        const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
        saveMedicinesToCache(newList);
        setMedicines(newList);
        triggerGlobalUpdate();

        await cancelMedicineReminders(id);
        await scheduleMedicineReminder({ ...medicineData, _id: id });

        // 2. Queue Logic
        if (id.toString().startsWith('temp_')) {
            let queue = getQueue();
            const existingAddIndex = queue.findIndex(q => q.action === 'ADD' && q.data._id === id);
            
            if (existingAddIndex !== -1) {
                queue[existingAddIndex].data = { ...queue[existingAddIndex].data, ...medicineData };
                saveQueue(queue);
                return { success: true };
            }
        }

        // Standard Update
        addToQueue('UPDATE', { id, medicineData });
        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();
        
        return { success: true };
    };

    // --- 4. DELETE MEDICINE (No change needed here) ---
    const deleteMedicine = async (id) => {
        await cancelMedicineReminders(id);
        const currentCache = getCachedMedicines();
        const newList = currentCache.filter(m => m._id !== id);
        saveMedicinesToCache(newList);
        setMedicines(newList);
        triggerGlobalUpdate();

        if (id.toString().startsWith('temp_')) {
            let queue = getQueue();
            const newQueue = queue.filter(q => !(q.action === 'ADD' && q.data._id === id));
            saveQueue(newQueue);
            return { success: true };
        }

        addToQueue('DELETE', { id });
        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();
        return { success: true };
    };

    // --- 5. LOGGING (Optimized for generated logs) ---
    const addManualLog = async (medicineId, statusVal, medicineName) => {
        const now = new Date();
        const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const nowDayStr = now.toISOString().split('T')[0];
        
        const currentLogs = getCachedLogs();
        const med = medicines.find(m => m._id === medicineId);
        
        if (!med) return { success: false, message: "Medicine not found." };
        
        // 1. Try to find the *existing PENDING log* that corresponds to the missed time
        const targetLogIndex = currentLogs.findIndex(log => 
            (log.medicineId?._id === medicineId || log.medicineId === medicineId) && 
            log.status === 'pending' &&
            new Date(log.date).toISOString().split('T')[0] === nowDayStr && // Same day
            log.time === nowTimeStr // Same time
        );
        
        let logToUpdate = null;
        if (targetLogIndex !== -1) {
            logToUpdate = currentLogs[targetLogIndex];
        } else {
             // 2. If no matching PENDING log is found (rare if generatePendingLogs works), 
             // find the closest relevant pending log or create a new one.
             // For simplicity and relying on `generatePendingLogs`, we'll create a new one
             // if we can't find a pending log for the exact time/day.
             logToUpdate = {
                 _id: `log_manual_${Date.now()}`,
                 clientLogId: `log_manual_${Date.now()}`,
                 medicineId: { _id: medicineId, name: medicineName || med.name }, 
                 medicineClientId: med.clientId || medicineId,
                 status: 'pending', 
                 date: now.toISOString(),
                 time: nowTimeStr,
                 pendingSync: true
             };
             // Add to logs if it's a completely new log entry
             if(targetLogIndex === -1) currentLogs.unshift(logToUpdate);
        }

        // 3. Update the Log Status Locally
        const updatedLogs = currentLogs.map(log => 
            log._id === logToUpdate._id ? 
            { ...log, status: statusVal, pendingSync: true } : log
        );

        saveLogsToCache(updatedLogs);
        setLogs(updatedLogs);
        triggerGlobalUpdate();
        
        // 4. Queue for Sync
        if (logToUpdate._id.toString().startsWith('log_')) { // Log is client-side generated
             addToQueue('CREATE_LOG', {
                 clientLogId: logToUpdate.clientLogId || logToUpdate._id,
                 medicineClientId: med.clientId || medicineId,
                 status: statusVal,
                 date: logToUpdate.date,
                 time: logToUpdate.time,
                 tempLogId: logToUpdate._id 
             });
        } else { // Log is server-side (real ID)
             addToQueue('UPDATE_LOG', { logId: logToUpdate._id, status: statusVal });
        }

        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();

        return { success: true };
    };
    
    // Alias for compatibility
    const handleNotificationAction = addManualLog; 

    // Update existing log status (for server-generated logs)
    const updateLogStatus = async (logId, statusVal) => {
        const currentLogs = getCachedLogs();
        const updatedLogs = currentLogs.map(log => log._id === logId ? { ...log, status: statusVal, pendingSync: true } : log);
        saveLogsToCache(updatedLogs);
        setLogs(updatedLogs);
        triggerGlobalUpdate();

        // Queue update action only if it's a real log (not client-side generated)
        if (!logId.toString().startsWith('log_')) {
            addToQueue('UPDATE_LOG', { logId, status: statusVal });
            const status = await Network.getStatus();
            if(status.connected) syncOfflineData();
        }
        return { success: true };
    };

    // Helper to Swap IDs after sync
    const swapIdInCache = async (tempId, realMedicine) => {
        const realId = realMedicine._id;
        
        // Swap Medicines
        const currentMeds = getCachedMedicines();
        const swappedMeds = currentMeds.map(m => m._id === tempId ? realMedicine : m);
        saveMedicinesToCache(swappedMeds);
        setMedicines(swappedMeds);

        // Swap Logs: Update medicine reference
        const currentLogs = getCachedLogs();
        const swappedLogs = currentLogs.map(log => {
            // Update the medicineId in logs
            if (log.medicineId && log.medicineId._id === tempId) {
                return { ...log, medicineId: { ...log.medicineId, _id: realId } };
            }
            return log;
        });
        saveLogsToCache(swappedLogs);
        setLogs(swappedLogs);

        await cancelMedicineReminders(tempId);
        await scheduleMedicineReminder(realMedicine);

        triggerGlobalUpdate();
        loadData(false); // Force full reload to fetch server logs associated with new ID
    };

    // --- 6. SYNC FUNCTION (No change, it handles the CREATE_LOG queue) ---
    const syncOfflineData = async () => {
        if (isSyncingGlobal) return;
        let queue = getQueue();
        if (queue.length === 0) return;

        isSyncingGlobal = true;

        try {
            let i = 0;
            while (i < queue.length) {
                const item = queue[i];
                let success = false;

                try {
                    if (item.action === 'ADD') {
                        const payload = { ...item.data, clientId: item.data._id };
                        const res = await axios.post(`${API_BASE_URL}/medicines`, payload, { headers: { Authorization: `Bearer ${token}` } });
                        
                        if (res.status === 200 || res.status === 201) {
                            success = true;
                            const realMedicine = res.data.medicine;
                            const tempId = item.data._id;
                            await swapIdInCache(tempId, realMedicine);
                        }
                    } 
                    else if (item.action === 'CREATE_LOG') {
                        const res = await axios.post(`${API_BASE_URL}/medicines/logs`, item.data, { headers: { Authorization: `Bearer ${token}` } });
                        
                        if (res.status === 200 || res.status === 201) {
                            success = true;
                            const realLog = res.data.log;
                            
                            // Swap temp log ID with real log ID in cache
                            const currentLogs = getCachedLogs();
                            const syncedLogs = currentLogs.map(l => l._id === item.data.tempLogId ? { ...l, _id: realLog._id, pendingSync: false } : l);
                            saveLogsToCache(syncedLogs);
                            setLogs(syncedLogs);
                        }
                    }
                    else if (item.action === 'UPDATE') { 
                        if (!item.data.id.toString().startsWith('temp_')) {
                            await axios.put(`${API_BASE_URL}/medicines/${item.data.id}`, item.data.medicineData, { headers: { Authorization: `Bearer ${token}` } });
                        }
                        success = true; 
                    }
                    else if (item.action === 'DELETE') { 
                         if (!item.data.id.toString().startsWith('temp_')) {
                             await axios.delete(`${API_BASE_URL}/medicines/${item.data.id}`, { headers: { Authorization: `Bearer ${token}` } });
                         }
                         success = true;
                    }
                    else if (item.action === 'UPDATE_LOG') {
                         await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
                         success = true;
                    }

                } catch (e) { 
                    console.error("Sync error:", e);
                    if (e.response?.status === 404 && item.action !== 'CREATE_LOG') success = true; 
                }

                if (success) {
                    queue.splice(i, 1);
                    saveQueue(queue); 
                } else {
                    i++; 
                }
            }
            triggerGlobalUpdate();
            loadData(false); 
        } finally {
            isSyncingGlobal = false;
        }
    };

    const fetchLogs = async () => getCachedLogs();
    const fetchFullHistory = async () => {}; 

    return { 
        medicines, logs, loading, 
        fetchMedicines: loadData, fetchFullHistory,
        addMedicine, updateMedicine, deleteMedicine, 
        handleNotificationAction, addManualLog, updateLogStatus, syncOfflineData, fetchLogs 
    };
};







// import { useState, useEffect, useRef } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { Network } from '@capacitor/network';
// import axios from 'axios';
// import { addToQueue, getQueue, saveQueue, saveMedicinesToCache, getCachedMedicines, saveLogsToCache, getCachedLogs } from '../utils/offlineStorage';
// import { scheduleMedicineReminder, cancelMedicineReminders } from '../utils/LocalNotificationManager';

// // ⚡ EVENT HELPER: Triggers all hooks to reload when data changes
// const triggerGlobalUpdate = () => {
//     window.dispatchEvent(new Event('medmind_data_updated'));
// };

// // 🔒 GLOBAL LOCK: Prevents double-syncing
// let isSyncingGlobal = false;

// export const useMedicines = () => {
//     const [medicines, setMedicines] = useState([]);
//     const [logs, setLogs] = useState([]); 
//     const [loading, setLoading] = useState(true);
//     const { token, API_BASE_URL } = useAuth();
//     const isAddingRef = useRef(false);

//     useEffect(() => {
//         loadData(); 

//         const netListener = Network.addListener('networkStatusChange', status => {
//             if (status.connected) syncOfflineData();
//         });

//         const updateListener = () => loadData(true); 
//         window.addEventListener('medmind_data_updated', updateListener);

//         return () => {
//             netListener.remove();
//             window.removeEventListener('medmind_data_updated', updateListener);
//         };
//     }, []);

//     // --- 1. LOAD DATA (Sorted to fix Jumping) ---
//     const loadData = async (onlyCache = false) => {
//         const cachedMeds = getCachedMedicines();
        
//         // 🔥 SORTING FIX: Ensure Newest (Offline) items stay at top
//         // We sort descending by creation time.
//         const sortedMeds = cachedMeds.sort((a, b) => {
//             const dateA = new Date(a.createdAt || 0).getTime();
//             const dateB = new Date(b.createdAt || 0).getTime();
//             return dateB - dateA;
//         });
        
//         const cachedLogs = getCachedLogs();
        
//         setMedicines(sortedMeds);
//         setLogs(cachedLogs);
//         setLoading(false);

//         if (onlyCache) return; 

//         const status = await Network.getStatus();
//         if (status.connected && token) {
//             try {
//                 // Fetch & Merge Logic
//                 const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
//                 const serverMedicines = resMeds.data.medicines;
                
//                 try {
//                     const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
//                     const serverLogs = resLogs.data.logs || [];
//                     saveLogsToCache(serverLogs);
//                     setLogs(serverLogs);
//                 } catch(e) { /* ignore log errors */ }

//                 const localTempMeds = sortedMeds.filter(m => m._id.toString().startsWith('temp_'));
                
//                 // Merge: Keep local temps + server items
//                 const mergedMeds = [...localTempMeds, ...serverMedicines]
//                     .filter((v,i,a)=>a.findIndex(v2=>(v2._id===v._id))===i)
//                     .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

//                 setMedicines(mergedMeds);
//                 saveMedicinesToCache(mergedMeds);

//             } catch (e) { console.log("Using offline cache."); }
//         }
//     };

//     // --- 2. ADD MEDICINE ---
//     const addMedicine = async (medicineData) => {
//         if (isAddingRef.current) return { success: false, message: "Processing..." };
//         isAddingRef.current = true;

//         try {
//             const tempId = `temp_${Date.now()}`;
//             const newMedicine = { 
//                 ...medicineData, 
//                 _id: tempId, 
//                 clientId: tempId, // 🔥 REQUIRED FOR BACKEND SYNC
//                 pendingSync: true,
//                 createdAt: new Date().toISOString(), // 🔥 Important for Sorting
//                 times: medicineData.times || [],
//                 duration: medicineData.duration || { startDate: new Date(), endDate: new Date() }
//             };

//             const currentCache = getCachedMedicines();
//             const newList = [newMedicine, ...currentCache]; // Add to top
//             saveMedicinesToCache(newList);
//             setMedicines(newList); 
//             triggerGlobalUpdate(); 
            
//             await scheduleMedicineReminder(newMedicine);

//             // Queue it
//             addToQueue('ADD', { ...newMedicine }); 

//             // Try sync immediately
//             const status = await Network.getStatus();
//             if (status.connected) syncOfflineData();

//             return { success: true };
//         } finally {
//             isAddingRef.current = false;
//         }
//     };

//     // --- 3. UPDATE MEDICINE (Smart Offline Edit) ---
//     const updateMedicine = async (id, medicineData) => {
//         // 1. Update Local Cache
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
//         triggerGlobalUpdate();

//         await cancelMedicineReminders(id);
//         await scheduleMedicineReminder({ ...medicineData, _id: id });

//         // 2. Queue Logic
//         if (id.toString().startsWith('temp_')) {
//             // 🔥 SMART FIX: If it's a temp item, update the PENDING ADD action in the queue!
//             let queue = getQueue();
//             const existingAddIndex = queue.findIndex(q => q.action === 'ADD' && q.data._id === id);
            
//             if (existingAddIndex !== -1) {
//                 // Update the Add payload directly
//                 queue[existingAddIndex].data = { ...queue[existingAddIndex].data, ...medicineData };
//                 saveQueue(queue);
//                 return { success: true };
//             }
//         }

//         // Standard Update
//         addToQueue('UPDATE', { id, medicineData });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
        
//         return { success: true };
//     };

//     // --- 4. DELETE MEDICINE ---
//     const deleteMedicine = async (id) => {
//         await cancelMedicineReminders(id);
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.filter(m => m._id !== id);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
//         triggerGlobalUpdate();

//         if (id.toString().startsWith('temp_')) {
//             // Remove the ADD action from queue if it exists
//             let queue = getQueue();
//             const newQueue = queue.filter(q => !(q.action === 'ADD' && q.data._id === id));
//             saveQueue(newQueue);
//             return { success: true };
//         }

//         addToQueue('DELETE', { id });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     // --- 5. LOGGING (Manual & Notification) ---
//     const addManualLog = async (medicineId, statusVal, medicineName) => {
//         const now = new Date();
//         const tempLogId = `log_${Date.now()}`;
        
//         // 1. Find the medicine object to get the clientId
//         const med = medicines.find(m => m._id === medicineId);
//         const medicineClientId = med?.clientId || medicineId; // Use clientId if available

//         // 2. Create Optimistic Log
//         const newLogEntry = {
//             _id: tempLogId,
//             clientLogId: tempLogId,
//             medicineId: { _id: medicineId, name: medicineName || 'Medicine' }, // UI needs name
//             medicineClientId: medicineClientId, // Backend needs this
//             status: statusVal,
//             date: now.toISOString(),
//             time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//             pendingSync: true
//         };

//         // 3. Save to Local Cache
//         const currentLogs = getCachedLogs();
//         const updatedLogs = [newLogEntry, ...currentLogs];
//         saveLogsToCache(updatedLogs);
//         setLogs(updatedLogs);
//         triggerGlobalUpdate();

//         // 4. Queue for Sync (Using CREATE_LOG which matches your backend)
//         addToQueue('CREATE_LOG', {
//             clientLogId: tempLogId,
//             medicineClientId: medicineClientId,
//             status: statusVal,
//             date: now.toISOString(),
//             time: newLogEntry.time,
//             tempLogId: tempLogId // Used for swapping ID later
//         });

//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();

//         return { success: true };
//     };
    
//     // Alias for compatibility
//     const handleNotificationAction = addManualLog; 

//     // Update existing log status
//     const updateLogStatus = async (logId, statusVal) => {
//         const currentLogs = getCachedLogs();
//         const updatedLogs = currentLogs.map(log => log._id === logId ? { ...log, status: statusVal, pendingSync: true } : log);
//         saveLogsToCache(updatedLogs);
//         setLogs(updatedLogs);
//         triggerGlobalUpdate();

//         // If it's a real log (server generated), we can sync update
//         if (!logId.toString().startsWith('log_')) {
//             addToQueue('UPDATE_LOG', { logId, status: statusVal });
//             const status = await Network.getStatus();
//             if(status.connected) syncOfflineData();
//         }
//         return { success: true };
//     };

//     // Helper to Swap IDs after sync
//     const swapIdInCache = async (tempId, realMedicine) => {
//         const realId = realMedicine._id;
        
//         // Swap Medicines
//         const currentMeds = getCachedMedicines();
//         const swappedMeds = currentMeds.map(m => m._id === tempId ? realMedicine : m);
//         saveMedicinesToCache(swappedMeds);
//         setMedicines(swappedMeds);

//         // Swap Logs: Update medicine reference
//         const currentLogs = getCachedLogs();
//         const swappedLogs = currentLogs.map(log => {
//             if (log.medicineId && log.medicineId._id === tempId) {
//                 return { ...log, medicineId: { ...log.medicineId, _id: realId } };
//             }
//             return log;
//         });
//         saveLogsToCache(swappedLogs);
//         setLogs(swappedLogs);

//         await cancelMedicineReminders(tempId);
//         await scheduleMedicineReminder(realMedicine);

//         triggerGlobalUpdate();
//     };

//     // --- 6. SYNC FUNCTION (Hardened for clientId) ---
//     const syncOfflineData = async () => {
//         if (isSyncingGlobal) return;
//         let queue = getQueue();
//         if (queue.length === 0) return;

//         isSyncingGlobal = true;

//         try {
//             let i = 0;
//             while (i < queue.length) {
//                 const item = queue[i];
//                 let success = false;

//                 try {
//                     if (item.action === 'ADD') {
//                         // Use clientId for backend idempotency
//                         const payload = { ...item.data, clientId: item.data._id };
//                         const res = await axios.post(`${API_BASE_URL}/medicines`, payload, { headers: { Authorization: `Bearer ${token}` } });
                        
//                         if (res.status === 200 || res.status === 201) {
//                             success = true;
//                             const realMedicine = res.data.medicine;
//                             const tempId = item.data._id;
//                             await swapIdInCache(tempId, realMedicine);
//                         }
//                     } 
//                     else if (item.action === 'CREATE_LOG') {
//                         // Use correct endpoint for creating logs
//                         const res = await axios.post(`${API_BASE_URL}/medicines/logs`, item.data, { headers: { Authorization: `Bearer ${token}` } });
                        
//                         if (res.status === 200 || res.status === 201) {
//                             success = true;
//                             const realLog = res.data.log;
                            
//                             // Swap temp log ID with real log ID in cache
//                             const currentLogs = getCachedLogs();
//                             const syncedLogs = currentLogs.map(l => l._id === item.data.tempLogId ? { ...l, _id: realLog._id, pendingSync: false } : l);
//                             saveLogsToCache(syncedLogs);
//                             setLogs(syncedLogs);
//                         }
//                     }
//                     else if (item.action === 'UPDATE') { 
//                         if (!item.data.id.toString().startsWith('temp_')) {
//                             await axios.put(`${API_BASE_URL}/medicines/${item.data.id}`, item.data.medicineData, { headers: { Authorization: `Bearer ${token}` } });
//                         }
//                         success = true; 
//                     }
//                     else if (item.action === 'DELETE') { 
//                          if (!item.data.id.toString().startsWith('temp_')) {
//                              await axios.delete(`${API_BASE_URL}/medicines/${item.data.id}`, { headers: { Authorization: `Bearer ${token}` } });
//                          }
//                          success = true;
//                     }
//                     else if (item.action === 'UPDATE_LOG') {
//                          await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
//                          success = true;
//                     }

//                 } catch (e) { 
//                     console.error("Sync error:", e);
//                     // If medicine not found (404) during log sync, it might mean ADD hasn't processed yet.
//                     // We skip it for this round and try again next time (it stays in queue).
//                     if (e.response?.status === 404 && item.action !== 'CREATE_LOG') success = true; 
//                 }

//                 if (success) {
//                     queue.splice(i, 1);
//                     saveQueue(queue); 
//                 } else {
//                     i++; 
//                 }
//             }
//             triggerGlobalUpdate();
//             loadData(false); 
//         } finally {
//             isSyncingGlobal = false;
//         }
//     };

//     const fetchLogs = async () => getCachedLogs();
//     const fetchFullHistory = async () => {}; 

//     return { 
//         medicines, logs, loading, 
//         fetchMedicines: loadData, fetchFullHistory,
//         addMedicine, updateMedicine, deleteMedicine, 
//         handleNotificationAction, addManualLog, updateLogStatus, syncOfflineData, fetchLogs 
//     };
// };









// import { useState, useEffect, useRef } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { Network } from '@capacitor/network';
// import axios from 'axios';
// import { addToQueue, getQueue, saveQueue, saveMedicinesToCache, getCachedMedicines, saveLogsToCache, getCachedLogs } from '../utils/offlineStorage';
// import { scheduleMedicineReminder, cancelMedicineReminders } from '../utils/LocalNotificationManager';

// const triggerGlobalUpdate = () => {
//     window.dispatchEvent(new Event('medmind_data_updated'));
// };

// let isSyncingGlobal = false;

// export const useMedicines = () => {
//     const [medicines, setMedicines] = useState([]);
//     const [logs, setLogs] = useState([]); 
//     const [loading, setLoading] = useState(true);
//     const { token, API_BASE_URL } = useAuth();
//     const isAddingRef = useRef(false);

//     useEffect(() => {
//         loadData(); 

//         const netListener = Network.addListener('networkStatusChange', status => {
//             if (status.connected) syncOfflineData();
//         });

//         const updateListener = () => loadData(true); 
//         window.addEventListener('medmind_data_updated', updateListener);

//         return () => {
//             netListener.remove();
//             window.removeEventListener('medmind_data_updated', updateListener);
//         };
//     }, []);

//     // --- 1. LOAD DATA (Sorted to fix Jumping) ---
//     const loadData = async (onlyCache = false) => {
//         const cachedMeds = getCachedMedicines();
//         // Sort: Newest First (Fixes jumping glitch)
//         // We use 'createdAt' if available, otherwise fallback to 0
//         const sortedMeds = cachedMeds.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
//         const cachedLogs = getCachedLogs();
        
//         setMedicines(sortedMeds);
//         setLogs(cachedLogs);
//         setLoading(false);

//         if (onlyCache) return; 

//         const status = await Network.getStatus();
//         if (status.connected && token) {
//             try {
//                 // Fetch & Merge Logic
//                 const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
//                 const serverMedicines = resMeds.data.medicines;
                
//                 try {
//                     const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
//                     const serverLogs = resLogs.data.logs || [];
//                     setLogs(serverLogs);
//                     saveLogsToCache(serverLogs);
//                 } catch(e) { /* ignore */ }

//                 const localTempMeds = cachedMeds.filter(m => m._id.toString().startsWith('temp_'));
                
//                 // Merge and Sort Again
//                 const mergedMeds = [...localTempMeds, ...serverMedicines] // Temps first usually implies newest
//                     .filter((v,i,a)=>a.findIndex(v2=>(v2._id===v._id))===i)
//                     .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

//                 setMedicines(mergedMeds);
//                 saveMedicinesToCache(mergedMeds);

//             } catch (e) { console.log("Using offline cache."); }
//         }
//     };

//     // --- 2. ADD MEDICINE ---
//     const addMedicine = async (medicineData) => {
//         if (isAddingRef.current) return { success: false, message: "Processing..." };
//         isAddingRef.current = true;

//         try {
//             const tempId = `temp_${Date.now()}`;
//             const newMedicine = { 
//                 ...medicineData, 
//                 _id: tempId, 
//                 clientId: tempId, // Required for backend idempotency
//                 pendingSync: true,
//                 createdAt: new Date().toISOString(), // 🔥 Important for Sorting
//                 times: medicineData.times || [],
//                 duration: medicineData.duration || { startDate: new Date(), endDate: new Date() }
//             };

//             const currentCache = getCachedMedicines();
//             const newList = [newMedicine, ...currentCache]; // Add to top
//             saveMedicinesToCache(newList);
//             setMedicines(newList); 
//             triggerGlobalUpdate(); 
            
//             await scheduleMedicineReminder(newMedicine);

//             // Queue it
//             addToQueue('ADD', { ...newMedicine }); 

//             // Try sync
//             const status = await Network.getStatus();
//             if (status.connected) syncOfflineData();

//             return { success: true };
//         } finally {
//             isAddingRef.current = false;
//         }
//     };

//     // --- 3. UPDATE MEDICINE (Smart Offline Edit) ---
//     const updateMedicine = async (id, medicineData) => {
//         // 1. Update Local Cache
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
//         triggerGlobalUpdate();

//         await cancelMedicineReminders(id);
//         await scheduleMedicineReminder({ ...medicineData, _id: id });

//         // 2. Queue Logic
//         if (id.toString().startsWith('temp_')) {
//             // 🔥 SMART FIX: If it's a temp item, update the PENDING ADD action in the queue!
//             let queue = getQueue();
//             const existingAddIndex = queue.findIndex(q => q.action === 'ADD' && q.data._id === id);
            
//             if (existingAddIndex !== -1) {
//                 // Update the Add payload directly
//                 queue[existingAddIndex].data = { ...queue[existingAddIndex].data, ...medicineData };
//                 saveQueue(queue);
//                 return { success: true };
//             }
//         }

//         // Standard Update
//         addToQueue('UPDATE', { id, medicineData });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
        
//         return { success: true };
//     };

//     // --- 4. DELETE MEDICINE ---
//     const deleteMedicine = async (id) => {
//         await cancelMedicineReminders(id);
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.filter(m => m._id !== id);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
//         triggerGlobalUpdate();

//         if (id.toString().startsWith('temp_')) {
//             // Remove the ADD action from queue if it exists
//             let queue = getQueue();
//             const newQueue = queue.filter(q => !(q.action === 'ADD' && q.data._id === id));
//             saveQueue(newQueue);
//             return { success: true };
//         }

//         addToQueue('DELETE', { id });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     // --- 5. LOGGING (Manual & Notification) ---
//     // Since backend generates logs automatically, we just need to UPDATE status.
//     // If log doesn't exist locally (e.g. sync lag), we create a temp one.
//     const addManualLog = async (medicineId, statusVal, medicineName) => {
//         const currentLogs = getCachedLogs();
//         const now = new Date();
        
//         // Find most relevant pending log
//         const targetLog = currentLogs
//             .filter(log => 
//                 (log.medicineId?._id === medicineId || log.medicineId === medicineId) && 
//                 log.status === 'pending' &&
//                 new Date(log.date) <= now
//             )
//             .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

//         if (!targetLog) {
//             // Fallback: Create temp log if none exists (ensures UI feedback)
//             const tempLogId = `log_${Date.now()}`;
//             const newLogEntry = {
//                 _id: tempLogId,
//                 medicineId: { _id: medicineId, name: medicineName || 'Medicine' },
//                 status: statusVal,
//                 date: now.toISOString(),
//                 time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
//                 pendingSync: true
//             };
//             const updatedLogs = [newLogEntry, ...currentLogs];
//             saveLogsToCache(updatedLogs);
//             setLogs(updatedLogs);
//             triggerGlobalUpdate();
            
//             // Note: Since backend generates logs, we might just queue an UPDATE_LOG 
//             // but we don't have a real ID yet. For strict consistency, we can 
//             // trigger a sync to pull latest logs from backend.
//             const status = await Network.getStatus();
//             if (status.connected) syncOfflineData();
            
//             return { success: true };
//         }

//         return updateLogStatus(targetLog._id, statusVal);
//     };
    
//     // Alias for compatibility
//     const handleNotificationAction = addManualLog; 

//     const updateLogStatus = async (logId, statusVal) => {
//         const currentLogs = getCachedLogs();
//         const updatedLogs = currentLogs.map(log => log._id === logId ? { ...log, status: statusVal, pendingSync: true } : log);
//         saveLogsToCache(updatedLogs);
//         setLogs(updatedLogs);
//         triggerGlobalUpdate();

//         // If it's a real log (server generated), we can sync update
//         addToQueue('UPDATE_LOG', { logId, status: statusVal });
//         const status = await Network.getStatus();
//         if(status.connected) syncOfflineData();
//         return { success: true };
//     };

//     // Helper to Swap IDs after sync
//     const swapIdInCache = async (tempId, realMedicine) => {
//         const realId = realMedicine._id;
        
//         const currentMeds = getCachedMedicines();
//         const swappedMeds = currentMeds.map(m => m._id === tempId ? realMedicine : m);
//         saveMedicinesToCache(swappedMeds);
//         setMedicines(swappedMeds);

//         // Logs usually don't need swapping if backend auto-generates them,
//         // but if we had any temp logs attached to temp med, we fix them:
//         const currentLogs = getCachedLogs();
//         const swappedLogs = currentLogs.map(log => {
//             if (log.medicineId && log.medicineId._id === tempId) {
//                 return { ...log, medicineId: { ...log.medicineId, _id: realId } };
//             }
//             return log;
//         });
//         saveLogsToCache(swappedLogs);
//         setLogs(swappedLogs);

//         await cancelMedicineReminders(tempId);
//         await scheduleMedicineReminder(realMedicine);

//         triggerGlobalUpdate();
//         loadData(false); // Refresh
//     };

//     // --- 6. SYNC FUNCTION (Hardened) ---
//     const syncOfflineData = async () => {
//         if (isSyncingGlobal) return;
//         let queue = getQueue();
//         if (queue.length === 0) return;

//         isSyncingGlobal = true;

//         try {
//             let i = 0;
//             while (i < queue.length) {
//                 const item = queue[i];
//                 let success = false;

//                 try {
//                     if (item.action === 'ADD') {
//                         // Include clientId for backend idempotency check
//                         const payload = { ...item.data, clientId: item.data._id };
//                         const res = await axios.post(`${API_BASE_URL}/medicines`, payload, { headers: { Authorization: `Bearer ${token}` } });
                        
//                         if (res.status === 200 || res.status === 201) {
//                             success = true;
//                             const realMedicine = res.data.medicine;
//                             const tempId = item.data._id;
//                             await swapIdInCache(tempId, realMedicine);
//                         }
//                     } 
//                     else if (item.action === 'UPDATE') { 
//                         if (!item.data.id.toString().startsWith('temp_')) {
//                             await axios.put(`${API_BASE_URL}/medicines/${item.data.id}`, item.data.medicineData, { headers: { Authorization: `Bearer ${token}` } });
//                         }
//                         success = true; 
//                     }
//                     else if (item.action === 'DELETE') { 
//                          if (!item.data.id.toString().startsWith('temp_')) {
//                              await axios.delete(`${API_BASE_URL}/medicines/${item.data.id}`, { headers: { Authorization: `Bearer ${token}` } });
//                          }
//                          success = true;
//                     }
//                     else if (item.action === 'UPDATE_LOG') {
//                          await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
//                          // Clear pending sync flag locally
//                          const currentLogs = getCachedLogs();
//                          const updatedLogs = currentLogs.map(l => l._id === item.data.logId ? {...l, pendingSync: false} : l);
//                          saveLogsToCache(updatedLogs);
//                          setLogs(updatedLogs);
//                          success = true;
//                     }

//                 } catch (e) { 
//                     console.error("Sync error:", e);
//                     if (e.response?.status === 404) success = true; 
//                 }

//                 if (success) {
//                     queue.splice(i, 1);
//                     saveQueue(queue); 
//                 } else {
//                     i++; 
//                 }
//             }
//             triggerGlobalUpdate();
//             loadData(false); // Fetch latest server state after sync
//         } finally {
//             isSyncingGlobal = false;
//         }
//     };

//     const fetchLogs = async () => getCachedLogs();
//     const fetchFullHistory = async () => {}; // Placeholder for full history fetch if needed

//     return { 
//         medicines, logs, loading, 
//         fetchMedicines: loadData, fetchFullHistory,
//         addMedicine, updateMedicine, deleteMedicine, 
//         handleNotificationAction, addManualLog, updateLogStatus, syncOfflineData, fetchLogs 
//     };
// };








// import { useState, useEffect } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { Network } from '@capacitor/network';
// import axios from 'axios';
// import { addToQueue, getQueue, clearQueue, saveMedicinesToCache, getCachedMedicines } from '../utils/offlineStorage';
// import { scheduleMedicineReminder, cancelMedicineReminders } from '../utils/LocalNotificationManager';

// // NEW: Helper for Logs Cache
// const LOGS_CACHE_KEY = 'cached_medicine_logs';
// const saveLogsToCache = (logs) => localStorage.setItem(LOGS_CACHE_KEY, JSON.stringify(logs));
// const getCachedLogs = () => {
//     const data = localStorage.getItem(LOGS_CACHE_KEY);
//     return data ? JSON.parse(data) : [];
// };

// export const useMedicines = () => {
//   const [medicines, setMedicines] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const { token, API_BASE_URL } = useAuth();

//   // 1. Load Data
//   useEffect(() => {
//     loadMedicines();
//     Network.addListener('networkStatusChange', status => {
//       if (status.connected) syncOfflineData();
//     });
//   }, []);

//   const loadMedicines = async () => {
//     const cached = getCachedMedicines();
//     if (cached.length > 0) setMedicines(cached);

//     const status = await Network.getStatus();
//     if (status.connected && token) {
//       try {
//         const res = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
//         setMedicines(res.data.medicines);
//         saveMedicinesToCache(res.data.medicines);
//         res.data.medicines.forEach(m => scheduleMedicineReminder(m));
//       } catch (e) { console.log("Using offline cache"); }
//     }
//     setLoading(false);
//   };

//   // 2. Add Medicine
//   const addMedicine = async (medicineData) => {
//     const tempId = `temp_${Date.now()}`;
//     const newMedicine = { ...medicineData, _id: tempId, pendingSync: true };

//     setMedicines(prev => {
//         const newList = [...prev, newMedicine];
//         saveMedicinesToCache(newList);
//         return newList;
//     });
    
//     await scheduleMedicineReminder(newMedicine);

//     const status = await Network.getStatus();
//     if (status.connected) {
//       try {
//         const res = await axios.post(`${API_BASE_URL}/medicines`, medicineData, { headers: { Authorization: `Bearer ${token}` } });
        
//         if (res.status === 200 || res.status === 201) {
//             const realMedicine = res.data.medicine || res.data;
//             await cancelMedicineReminders(tempId);
//             await scheduleMedicineReminder(realMedicine);

//             setMedicines(prev => {
//                 const newList = prev.map(m => m._id === tempId ? realMedicine : m);
//                 saveMedicinesToCache(newList);
//                 return newList;
//             });
//             return { success: true };
//         }
//       } catch (e) { return { success: false, message: "Server error, saved locally." }; }
//     } else {
//       addToQueue('ADD', medicineData);
//       return { success: true, message: "Offline. Saved to device." };
//     }
//   };

//   // 3. Update Medicine
//   const updateMedicine = async (id, medicineData) => {
//     setMedicines(prev => {
//         const newList = prev.map(m => m._id === id ? { ...medicineData, _id: id, pendingSync: true } : m);
//         saveMedicinesToCache(newList);
//         return newList;
//     });

//     await scheduleMedicineReminder({ ...medicineData, _id: id });

//     const status = await Network.getStatus();
//     if (status.connected) {
//       try {
//         await axios.put(`${API_BASE_URL}/medicines/${id}`, medicineData, { headers: { Authorization: `Bearer ${token}` } });
        
//         setMedicines(prev => {
//             const newList = prev.map(m => m._id === id ? { ...medicineData, _id: id } : m);
//             saveMedicinesToCache(newList);
//             return newList;
//         });
//         return { success: true };
//       } catch (e) { return { success: false }; }
//     } else {
//       addToQueue('UPDATE', { id, ...medicineData });
//       return { success: true };
//     }
//   };

//   // 4. Delete Medicine
//   const deleteMedicine = async (id) => {
//     setMedicines(prev => {
//         const newList = prev.filter(m => m._id !== id);
//         saveMedicinesToCache(newList);
//         return newList;
//     });

//     await cancelMedicineReminders(id);

//     const status = await Network.getStatus();
//     if (status.connected) {
//       try {
//         await axios.delete(`${API_BASE_URL}/medicines/${id}`, { headers: { Authorization: `Bearer ${token}` } });
//         return { success: true };
//       } catch (e) { return { success: false }; }
//     } else {
//       addToQueue('DELETE', { id });
//       return { success: true };
//     }
//   };

//   // 5. Update Log (Used by Buttons)
//   const updateLogStatus = async (logId, statusVal) => {
//       // Optimistic Update for Logs Cache
//       const currentLogs = getCachedLogs();
//       const updatedLogs = currentLogs.map(log => log._id === logId ? { ...log, status: statusVal } : log);
//       saveLogsToCache(updatedLogs);

//       const status = await Network.getStatus();
//       if (status.connected) {
//           try {
//               await axios.put(`${API_BASE_URL}/medicines/logs/${logId}`, { status: statusVal }, { headers: { Authorization: `Bearer ${token}` } });
//               return { success: true, message: "Logged." };
//           } catch (e) { return { success: false, message: "Server error" }; }
//       } else {
//           addToQueue('UPDATE_LOG', { logId, status: statusVal });
//           return { success: true, message: "Saved offline." };
//       }
//   };

//   // 6. Sync Function
//   const syncOfflineData = async () => {
//     let queue = getQueue();
//     if (queue.length === 0) return;

//     let i = 0;
//     while (i < queue.length) {
//       const item = queue[i];
//       let success = false;

//       try {
//         if (item.action === 'ADD') {
//           const res = await axios.post(`${API_BASE_URL}/medicines`, item.data, { headers: { Authorization: `Bearer ${token}` } });
//           if (res.status === 200 || res.status === 201) {
//             success = true;
//             const tempId = item.data._id;
//             const realId = (res.data.medicine || res.data)._id;
//             queue = queue.map(q => {
//                 if (q.data.id === tempId) q.data.id = realId;
//                 if (q.data.logId === tempId) q.data.logId = realId;
//                 return q;
//             });
//           }
//         } 
//         else if (item.action === 'UPDATE') {
//           await axios.put(`${API_BASE_URL}/medicines/${item.data.id}`, item.data, { headers: { Authorization: `Bearer ${token}` } });
//           success = true;
//         } 
//         else if (item.action === 'DELETE') {
//           await axios.delete(`${API_BASE_URL}/medicines/${item.data.id}`, { headers: { Authorization: `Bearer ${token}` } });
//           success = true;
//         }
//         else if (item.action === 'UPDATE_LOG') {
//            await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
//            success = true;
//         }
//       } catch (e) { if(e.response?.status === 404) success = true; }

//       if (success) {
//         queue.splice(i, 1);
//         localStorage.setItem('offline_mutation_queue', JSON.stringify(queue));
//       } else {
//         i++;
//       }
//     }
//     clearQueue();
//     fetchMedicines(); 
//   };

//   // 7. Logs Fetcher (FIXED: Uses Cache)
//   const fetchLogs = async () => {
//     // Return cache immediately so UI isn't empty
//     const cachedLogs = getCachedLogs();
    
//     // If we have token, try to update from server
//     if (token) {
//         try {
//            const response = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
//            const logs = response.data.logs || [];
//            saveLogsToCache(logs); // Save fresh data
//            return logs;
//         } catch (err) { 
//             console.log("Offline: returning cached logs");
//             return cachedLogs; 
//         }
//     }
//     return cachedLogs;
//   };

//   const addLog = async (medicineId, logData) => {
//       // Simple Add Log implementation if needed
//       const status = await Network.getStatus();
//       if (status.connected) {
//           try {
//             const res = await axios.post(`${API_BASE_URL}/medicines/log/${medicineId}`, logData, { headers: { Authorization: `Bearer ${token}` } });
//             return res.data;
//           } catch (e) { return { message: "Error" }; }
//       } else {
//           return { success: true, message: "Offline log saved" };
//       }
//   };

//   return { medicines, loading, fetchMedicines: loadMedicines, addMedicine, updateMedicine, deleteMedicine, updateLogStatus, syncOfflineData, fetchLogs, addLog };
// };






// import { useState, useEffect } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { Network } from '@capacitor/network';
// import axios from 'axios';

// import { 
//   addToQueue, 
//   getQueue, 
//   clearQueue, 
//   saveMedicinesToCache, 
//   getCachedMedicines 
// } from '../utils/offlineStorage';

// import { 
//     scheduleMedicineReminder, 
//     cancelMedicineReminders 
// } from '../utils/LocalNotificationManager';

// export const useMedicines = () => {
//   const [medicines, setMedicines] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('last_sync_time'));
  
//   const { token, API_BASE_URL } = useAuth();

//   // 1. Initial Load
//   useEffect(() => {
//     const cached = getCachedMedicines();
//     if (cached.length > 0) {
//       setMedicines(cached);
//       setLoading(false);
//     }
    
//     // Listen for internet to trigger sync
//     Network.addListener('networkStatusChange', status => {
//       if (status.connected) syncOfflineData();
//     });
//   }, []);

//   // 2. Fetch (Always use Cache if fetch fails)
//   const fetchMedicines = async () => {
//     const status = await Network.getStatus();
//     const cached = getCachedMedicines();
    
//     // Load cache first (Instant speed)
//     if(cached.length > 0) setMedicines(cached);

//     if (status.connected && token) {
//       try {
//         const response = await axios.get(`${API_BASE_URL}/medicines`, {
//           headers: { Authorization: `Bearer ${token}` }
//         });
//         if (response.data.medicines) {
//           setMedicines(response.data.medicines);
//           saveMedicinesToCache(response.data.medicines);
          
//           const now = new Date().toISOString();
//           localStorage.setItem('last_sync_time', now);
//           setLastSyncTime(now);

//           // Refill Alarms in Background
//           response.data.medicines.forEach(med => scheduleMedicineReminder(med).catch(console.error));
//         }
//       } catch (err) {
//         console.log("Offline mode: Using cached data.");
//       } finally {
//         setLoading(false);
//       }
//     } else {
//       setLoading(false);
//     }
//   };

//   // 3. Add Medicine (Offline + Online)
//   const addMedicine = async (medicineData) => {
//     const tempId = `temp_${Date.now()}`;
//     const medicineWithTempId = { ...medicineData, _id: tempId };

//     // ALARM FIRST (Works offline)
//     try { await scheduleMedicineReminder(medicineWithTempId); } catch (e) {}

//     const status = await Network.getStatus();

//     if (status.connected) {
//       try {
//         const response = await axios.post(`${API_BASE_URL}/medicines`, medicineData, {
//           headers: { Authorization: `Bearer ${token}` }
//         });
//         if (response.status === 200 || response.status === 201) {
//              const realMedicine = response.data.medicine || response.data;
//              await cancelMedicineReminders(tempId);
//              await scheduleMedicineReminder(realMedicine);
//              fetchMedicines();
//              return { success: true };
//         }
//       } catch (e) { return { success: false, message: "Server error" }; }
//     } else {
//       // QUEUE FOR SYNC
//       addToQueue('ADD', medicineData);
      
//       const newList = [...medicines, { ...medicineWithTempId, pendingSync: true }];
//       setMedicines(newList);
//       saveMedicinesToCache(newList);
//       return { success: true, message: "Saved to phone. Will sync later." };
//     }
//   };

//   // 4. Update Medicine (Offline + Online)
//   const updateMedicine = async (id, medicineData) => {
//     // ALARM FIRST
//     const medicineWithId = { ...medicineData, _id: id };
//     await scheduleMedicineReminder(medicineWithId);

//     const status = await Network.getStatus();

//     if (status.connected) {
//        try {
//          await axios.put(`${API_BASE_URL}/medicines/${id}`, medicineData, {
//             headers: { Authorization: `Bearer ${token}` }
//          });
//          fetchMedicines();
//          return { success: true };
//        } catch (e) { return { success: false, message: "Update failed" }; }
//     } else {
//        // OFFLINE UPDATE
//        addToQueue('UPDATE', { id, ...medicineData }); // Add to sync queue

//        // Update Local List Immediately
//        const newList = medicines.map(med => med._id === id ? { ...medicineWithId, pendingSync: true } : med);
//        setMedicines(newList);
//        saveMedicinesToCache(newList);
//        return { success: true, message: "Updated locally." };
//     }
//   };

//   // 5. Delete Medicine (Offline + Online)
//   const deleteMedicine = async (id) => {
//     // ALARM FIRST
//     await cancelMedicineReminders(id);

//     const status = await Network.getStatus();

//     if (status.connected) {
//        try {
//          await axios.delete(`${API_BASE_URL}/medicines/${id}`, {
//             headers: { Authorization: `Bearer ${token}` }
//          });
//          fetchMedicines();
//          return { success: true };
//        } catch (e) { return { success: false, message: "Delete failed" }; }
//     } else {
//        // OFFLINE DELETE
//        addToQueue('DELETE', { id });

//        // Remove from Local List Immediately
//        const newList = medicines.filter(med => med._id !== id);
//        setMedicines(newList);
//        saveMedicinesToCache(newList);
//        return { success: true, message: "Deleted locally." };
//     }
//   };

//   // 6. Sync Logic (Handles ADD, UPDATE, DELETE)
//   const syncOfflineData = async () => {
//     const queue = getQueue();
//     if (queue.length === 0) { fetchMedicines(); return; }

//     console.log("Syncing queue:", queue);

//     for (const item of queue) {
//       try {
//         if (item.action === 'ADD') {
//           await axios.post(`${API_BASE_URL}/medicines`, item.data, { headers: { Authorization: `Bearer ${token}` }});
//         } 
//         else if (item.action === 'UPDATE') {
//           const { id, ...data } = item.data;
//           await axios.put(`${API_BASE_URL}/medicines/${id}`, data, { headers: { Authorization: `Bearer ${token}` }});
//         } 
//         else if (item.action === 'DELETE') {
//           await axios.delete(`${API_BASE_URL}/medicines/${item.data.id}`, { headers: { Authorization: `Bearer ${token}` }});
//         }
//       } catch (err) { console.error("Sync item failed:", item); }
//     }
//     clearQueue();
//     fetchMedicines();
//   };

//   // Keep logs/addLog same as before... (omitted for brevity)
//   // 7. Logs (Restored Real Logic)
//   const fetchLogs = async () => {
//     // Check if we are online because logs are usually fetched from server
//     // (You can implement caching for this later if you want)
//     if (token) {
//         try {
//            const response = await axios.get(`${API_BASE_URL}/medicines/logs`, {
//              headers: { Authorization: `Bearer ${token}` }
//            });
//            return response.data.logs || [];
//         } catch (err) {
//           console.error("Error fetching logs:", err);
//           return [];
//         }
//     }
//     return [];
//   };

//   const addLog = async (medicineId, logData) => {
//       // Allow logging even if offline (Queue it)
//       const status = await Network.getStatus();
      
//       if (status.connected) {
//           try {
//             const response = await axios.post(`${API_BASE_URL}/medicines/log/${medicineId}`, logData, {
//               headers: { Authorization: `Bearer ${token}` }
//             });
//             return response.data;
//           } catch (err) {
//             return { message: "Error logging dose" };
//           }
//       } else {
//           // If offline, we just alert the user for now (or you can add to queue)
//           alert("You are offline. Dose will be logged when connection returns.");
//           // To make this fully offline, you would add an 'ADD_LOG' action to your syncQueue
//           return { success: true, offline: true };
//       }
//   };

//   return { medicines, loading, error, lastSyncTime, fetchMedicines, addMedicine, updateMedicine, deleteMedicine, syncOfflineData, fetchLogs, addLog };
// };







// import { useState, useEffect } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { Network } from '@capacitor/network';
// import axios from 'axios';

// import { 
//   addToQueue, 
//   getQueue, 
//   clearQueue, 
//   saveMedicinesToCache, 
//   getCachedMedicines 
// } from '../utils/offlineStorage';

// import { 
//     scheduleMedicineReminder, 
//     cancelMedicineReminders 
// } from '../utils/LocalNotificationManager';

// export const useMedicines = () => {
//   const [medicines, setMedicines] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [networkStatus, setNetworkStatus] = useState({ connected: true });
  
//   // --- NEW: State for Last Sync ---
//   const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('last_sync_time'));
  
//   const { token, API_BASE_URL } = useAuth();

//   // 1. Initial Load & Network Listener
//   useEffect(() => {
//     const cached = getCachedMedicines();
//     if (cached.length > 0) {
//       setMedicines(cached);
//       setLoading(false);
//     }

//     Network.getStatus().then(status => setNetworkStatus(status));

//     const listener = Network.addListener('networkStatusChange', status => {
//       console.log('Network status changed', status);
//       setNetworkStatus(status);
//       if (status.connected) {
//         syncOfflineData();
//       }
//     });

//     return () => {
//       listener.remove();
//     };
//   }, []);

//   // 2. Fetch Medicines (UPDATED with Timestamp logic)
//   const fetchMedicines = async () => {
//     const status = await Network.getStatus();
    
//     // Always load cache first
//     const cached = getCachedMedicines();
//     if(cached.length > 0) setMedicines(cached);

//     if (status.connected && token) {
//       try {
//         const response = await axios.get(`${API_BASE_URL}/medicines`, {
//           headers: { Authorization: `Bearer ${token}` }
//         });

//         if (response.data.medicines) {
//           setMedicines(response.data.medicines);
//           saveMedicinesToCache(response.data.medicines);
          
//           // --- NEW: Update Sync Time ---
//           const now = new Date().toISOString();
//           localStorage.setItem('last_sync_time', now);
//           setLastSyncTime(now);
//           // -----------------------------

//           // Background Alarm Refill
//           response.data.medicines.forEach(med => {
//               scheduleMedicineReminder(med).catch(console.error);
//           });
          
//           setError(null);
//         }
//       } catch (err) {
//         console.error("Fetch error, using cache:", err);
//         setError('Using offline data');
//       } finally {
//         setLoading(false);
//       }
//     } else {
//       setLoading(false);
//     }
//   };

//   // 3. Add Medicine
//   const addMedicine = async (medicineData) => {
//     const tempId = `temp_${Date.now()}`;
//     const medicineWithTempId = { ...medicineData, _id: tempId };

//     try {
//         await scheduleMedicineReminder(medicineWithTempId);
//     } catch (err) {
//         console.error("❌ Failed to set alarm:", err);
//     }

//     const status = await Network.getStatus();

//     if (status.connected) {
//       try {
//         const response = await axios.post(`${API_BASE_URL}/medicines`, medicineData, {
//           headers: { Authorization: `Bearer ${token}` }
//         });

//         if (response.status === 201 || response.status === 200) {
//           // Fix for "missing duration" bug: Check both locations
//           const realMedicine = response.data.medicine || response.data;
          
//           await cancelMedicineReminders(tempId);
//           await scheduleMedicineReminder(realMedicine);
//           await fetchMedicines(); 
//           return { success: true };
//         }
//       } catch (error) {
//         return { success: false, message: error.response?.data?.message || 'Server error' };
//       }
//     } else {
//       try {
//         const offlineMedicine = { ...medicineWithTempId, pendingSync: true };
//         addToQueue('ADD', medicineData);
//         const updatedList = [...medicines, offlineMedicine];
//         setMedicines(updatedList);
//         saveMedicinesToCache(updatedList);
//         return { success: true, message: 'Saved Offline. Will sync when online.' };
//       } catch (e) {
//         return { success: false, message: 'Could not save offline.' };
//       }
//     }
//   };

//   // 4. Update Medicine
//   const updateMedicine = async (id, medicineData) => {
//     const status = await Network.getStatus();
//     if (!status.connected) return { success: false, message: "Connect to internet to update details." };

//     try {
//       await axios.put(`${API_BASE_URL}/medicines/${id}`, medicineData, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       const medicineWithId = { ...medicineData, _id: id };
//       await scheduleMedicineReminder(medicineWithId);
//       await fetchMedicines();
//       return { success: true };
//     } catch (error) {
//       return { success: false, message: 'Update failed on server' };
//     }
//   };

//   // 5. Delete Medicine
//   const deleteMedicine = async (id) => {
//     await cancelMedicineReminders(id); 

//     const status = await Network.getStatus();
//     if (!status.connected) return { success: false, message: "Connect to internet to delete permanently." };

//     try {
//       await axios.delete(`${API_BASE_URL}/medicines/${id}`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       await fetchMedicines();
//       return { success: true };
//     } catch (error) {
//       return { success: false, message: 'Delete failed' };
//     }
//   };

//   // 6. Sync Function
//   const syncOfflineData = async () => {
//     const queue = getQueue();
//     if (queue.length === 0) {
//         // Even if queue is empty, fetch fresh data to update sync time
//         fetchMedicines(); 
//         return;
//     }

//     console.log(`Syncing ${queue.length} items to server...`);

//     for (const item of queue) {
//       try {
//         if (item.action === 'ADD') {
//           await axios.post(`${API_BASE_URL}/medicines`, item.data, {
//             headers: { Authorization: `Bearer ${token}` }
//           });
//         }
//       } catch (err) {
//         console.error("Sync failed for item:", item, err);
//       }
//     }
//     clearQueue();
//     fetchMedicines(); 
//   };

//   // 7. Logs
//   const fetchLogs = async () => {
//     try {
//        const res = await axios.get(`${API_BASE_URL}/medicines/logs`, {
//          headers: { Authorization: `Bearer ${token}` }
//        });
//        return res.data.logs || [];
//     } catch (err) {
//       return [];
//     }
//   };

//   const addLog = async (medicineId, logData) => {
//       try {
//         const res = await axios.post(`${API_BASE_URL}/medicines/log/${medicineId}`, logData, {
//           headers: { Authorization: `Bearer ${token}` }
//         });
//         return res.data;
//       } catch (err) {
//         return { message: "Error logging dose" };
//       }
//   };

//   useEffect(() => {
//     if (token) {
//       fetchMedicines();
//     }
//   }, [token]);

//   return {
//     medicines,
//     loading,
//     error,
//     networkStatus,
//     lastSyncTime, // <--- EXPORT THIS
//     fetchMedicines,
//     addMedicine,
//     updateMedicine,
//     deleteMedicine,
//     fetchLogs,
//     addLog,
//     syncOfflineData
//   };
// };
