import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Network } from '@capacitor/network';
import axios from 'axios';
import { addToQueue, getQueue, saveQueue, saveMedicinesToCache, getCachedMedicines, saveLogsToCache, getCachedLogs } from '../utils/offlineStorage';
import { scheduleMedicineReminder, cancelMedicineReminders } from '../utils/LocalNotificationManager';

let isSyncingGlobal = false;

// --- HELPER: Compare queue items safely ---
const isSameItem = (item1, item2) => {
    if (!item1 || !item2) return false;
    if (item1.timestamp && item2.timestamp) return item1.timestamp === item2.timestamp;
    return item1.action === item2.action && JSON.stringify(item1.data) === JSON.stringify(item2.data);
};

// --- HELPERS ---
const getScheduledTimesForMedicine = (medicine, days = 7) => {
    const schedules = [];
    if (!medicine.times || medicine.times.length === 0) return schedules;
    const today = new Date(); 
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(medicine.duration?.endDate || '2100-01-01'); 
    endDate.setHours(23, 59, 59, 999);

    for (let day = 0; day < days; day++) {
        const checkDate = new Date(today); 
        checkDate.setDate(today.getDate() + day);
        if (checkDate > endDate) break;
        const startDate = new Date(medicine.duration?.startDate || today);
        startDate.setHours(0,0,0,0);
        if (checkDate < startDate) continue;

        for (const timeStr of medicine.times) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const scheduleTime = new Date(checkDate); 
            scheduleTime.setHours(hours, minutes, 0, 0);
            if (scheduleTime <= endDate && scheduleTime >= startDate) {
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

const isLogDueForUpload = (log) => {
    if (log.status !== 'pending') return true;
    const now = new Date();
    const logDate = new Date(log.date);
    const [hours, minutes] = log.time.split(':').map(Number);
    logDate.setHours(hours, minutes, 0, 0);
    return logDate <= now;
};

export const useMedicines = () => {
    const [medicines, setMedicines] = useState([]);
    const [logs, setLogs] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('last_sync_time'));
    
    const { token, API_BASE_URL } = useAuth();
    const isAddingRef = useRef(false);
    const processingRef = useRef(new Set()); 

    useEffect(() => {
        loadData(true); 
        const netListener = Network.addListener('networkStatusChange', status => {
            if (status.connected) syncOfflineData();
        });
        const updateListener = () => { if (!isSyncingGlobal) loadData(true); };
        window.addEventListener('medmind_data_updated', updateListener);
        return () => {
            netListener.remove();
            window.removeEventListener('medmind_data_updated', updateListener);
        };
    }, []);

    useEffect(() => {
        if (token) loadData(false);
        else { setMedicines([]); setLogs([]); }
    }, [token]);
    
    const generatePendingLogs = (currentMeds, currentLogs) => {
        const activeMedIds = new Set(currentMeds.map(m => m._id));
        const now = new Date();
        const validLogs = currentLogs.filter(log => {
            if (log.status !== 'pending') return true; 
            const medId = log.medicineId?._id || log.medicineId;
            if (!activeMedIds.has(medId)) {
                const logDate = new Date(log.date);
                const [h, m] = log.time.split(':').map(Number);
                logDate.setHours(h, m, 0, 0);
                return logDate <= now; 
            }
            return true;
        });
        const updatedLogs = [...validLogs];
        const existingLogSignatures = new Set();
        validLogs.forEach(log => {
            const medId = log.medicineId?._id || log.medicineId; 
            const medClientId = log.medicineClientId;            
            const dateStr = new Date(log.date).toISOString().split('T')[0];
            const timeStr = log.time?.split(':').slice(0, 2).join(':'); 
            if (medId) existingLogSignatures.add(`${medId}-${dateStr}-${timeStr}`);
            if (medClientId) existingLogSignatures.add(`${medClientId}-${dateStr}-${timeStr}`);
        });
        for (const med of currentMeds) {
            if (med.isPaused || !med.isActive) continue;
            const medId = med._id;
            const medClientId = med.clientId;
            const schedules = getScheduledTimesForMedicine(med, 7); 
            for (const schedule of schedules) {
                const sig1 = `${medId}-${schedule.dateStr}-${schedule.timeStr}`;
                const sig2 = `${medClientId}-${schedule.dateStr}-${schedule.timeStr}`;
                if (!existingLogSignatures.has(sig1) && !existingLogSignatures.has(sig2)) {
                    const tempLogId = `log_gen_${medId}_${schedule.dateStr}_${schedule.timeStr}`; 
                    updatedLogs.push({ _id: tempLogId, clientLogId: tempLogId, medicineId: { _id: medId, name: med.name }, medicineClientId: medClientId || medId, status: 'pending', date: schedule.time.toISOString(), time: schedule.timeStr, pendingSync: true });
                    existingLogSignatures.add(sig1);
                }
            }
        }
        return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const queuePastPendingLogs = (allLogs) => {
        let queue = getQueue();
        let queueModified = false;
        allLogs.forEach(log => {
            if (!log._id.toString().startsWith('log_') || !log.pendingSync) return;
            if (!isLogDueForUpload(log)) return;
            const alreadyQueued = queue.some(q => q.action === 'CREATE_LOG' && (q.data.clientLogId === log.clientLogId || q.data.tempLogId === log._id));
            if (!alreadyQueued) {
                const medClientId = log.medicineClientId || (log.medicineId?._id || log.medicineId);
                queue.push({ action: 'CREATE_LOG', data: { clientLogId: log.clientLogId || log._id, medicineClientId: medClientId, status: log.status, date: log.date, time: log.time, tempLogId: log._id }, timestamp: Date.now() });
                queueModified = true;
            }
        });
        if (queueModified) {
            saveQueue(queue);
            Network.getStatus().then(status => { if (status.connected) syncOfflineData(); });
        }
    };

    // --- 🟢 LOAD DATA (FIXED MERGE LOGIC) ---
    const loadData = async (onlyCache = false) => {
        let cachedMeds = getCachedMedicines();
        let cachedLogs = getCachedLogs();

        // 1. Initial Queue Filter
        let queue = getQueue();
        let pendingDeleteIds = new Set(queue.filter(q => q.action === 'DELETE').map(q => q.data.id ? String(q.data.id) : null).filter(Boolean));
        cachedMeds = cachedMeds.filter(m => !pendingDeleteIds.has(String(m._id)));

        let finalLogs = generatePendingLogs(cachedMeds, cachedLogs);
        if (onlyCache || cachedMeds.length > 0) {
            setMedicines(cachedMeds);
            setLogs(finalLogs);
            setLoading(false);
            if (onlyCache) return;
        }

        if (isSyncingGlobal) return; 

        const status = await Network.getStatus();
        if (status.connected && token) {
            try {
                const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
                const serverMedicines = resMeds.data.medicines;
                
                let serverLogs = [];
                try {
                    const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
                    serverLogs = resLogs.data.logs || [];
                } catch(e) { }

                // RE-READ QUEUE & BUSY LIST
                queue = getQueue(); 
                pendingDeleteIds = new Set(queue.filter(q => q.action === 'DELETE').map(q => q.data.id ? String(q.data.id) : null).filter(Boolean));
                const busyIds = processingRef.current; 

                // Merge Medicines
                const serverClientIds = new Set(serverMedicines.map(m => m.clientId).filter(Boolean));
                const localTempMeds = cachedMeds.filter(localM => {
                    const isTemp = localM._id.toString().startsWith('temp_');
                    return isTemp && !serverClientIds.has(localM.clientId); 
                });

                let mergedMeds = [...localTempMeds, ...serverMedicines].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                mergedMeds = mergedMeds.filter(m => {
                    const idStr = String(m._id);
                    if (pendingDeleteIds.has(idStr)) return false;
                    if (busyIds.has(idStr)) return false; 
                    return true;
                });

                // 🟢 SMART LOG MERGE
                const mergedLogsMap = new Map();
                serverLogs.forEach(log => mergedLogsMap.set(log._id, log)); 

                cachedLogs.forEach(localLog => {
                    // 1. Busy Lock: If we're updating it, ignore server
                    if (busyIds.has(localLog._id)) {
                        mergedLogsMap.set(localLog._id, localLog);
                        return;
                    }

                    const serverLog = mergedLogsMap.get(localLog._id);

                    if (localLog.pendingSync) {
                        // 2. Pending Sync Rule: Local always wins if dirty
                        mergedLogsMap.set(localLog._id, localLog);
                    } 
                    else if (serverLog) {
                        // 3. 🛡️ STATUS REGRESSION GUARD
                        // If Local is 'taken'/'missed' but Server is 'pending' (stale), keep Local status.
                        if (serverLog.status === 'pending' && localLog.status !== 'pending') {
                            mergedLogsMap.set(localLog._id, { ...serverLog, status: localLog.status });
                        }
                    }
                    else {
                        // 4. Orphan Rule
                        if (localLog._id.toString().startsWith('log_') || localLog.clientLogId) {
                            mergedLogsMap.set(localLog._id, localLog);
                        }
                    }
                });

                const uniqueLogs = Array.from(mergedLogsMap.values());
                finalLogs = generatePendingLogs(mergedMeds, uniqueLogs); 
                queuePastPendingLogs(finalLogs);

                setMedicines(mergedMeds);
                saveMedicinesToCache(mergedMeds);
                setLogs(finalLogs);
                saveLogsToCache(finalLogs);

                const now = new Date().toISOString();
                setLastSyncTime(now);
                localStorage.setItem('last_sync_time', now);
                setLoading(false);

            } catch (e) { console.log("Using offline cache due to error."); }
        } else {
            setLoading(false);
        }
    };

    const addMedicine = async (medicineData) => {
        if (isAddingRef.current) return { success: false, message: "Processing..." };
        isAddingRef.current = true;
        try {
            const tempId = `temp_${Date.now()}`;
            const newMedicine = { ...medicineData, _id: tempId, clientId: tempId, pendingSync: true, createdAt: new Date().toISOString(), times: medicineData.times || [], duration: medicineData.duration || { startDate: new Date(), endDate: new Date() }, isMuted: false, isPaused: false, isActive: true };
            const currentCache = getCachedMedicines();
            const newMedList = [newMedicine, ...currentCache]; 
            saveMedicinesToCache(newMedList);
            setMedicines(newMedList); 
            const currentLogs = getCachedLogs();
            const newGeneratedLogs = generatePendingLogs([newMedicine], []);
            const updatedLogs = [...currentLogs, ...newGeneratedLogs];
            saveLogsToCache(updatedLogs);
            setLogs(updatedLogs); 
            
            await scheduleMedicineReminder(newMedicine);
            addToQueue('ADD', { ...newMedicine }); 
            const status = await Network.getStatus();
            if (status.connected) syncOfflineData(); 
            return { success: true };
        } finally { isAddingRef.current = false; }
    };

    const updateMedicine = async (id, medicineData) => {
        const currentCache = getCachedMedicines(); const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m); saveMedicinesToCache(newList); setMedicines(newList);
        const currentLogs = getCachedLogs(); const finalLogs = generatePendingLogs(newList, currentLogs); setLogs(finalLogs); saveLogsToCache(finalLogs);
        queuePastPendingLogs(finalLogs); 
        const updatedMed = newList.find(m => m._id === id); if(updatedMed && !updatedMed.isPaused) await scheduleMedicineReminder(updatedMed);
        if (id.toString().startsWith('temp_')) { let queue = getQueue(); const existingAddIndex = queue.findIndex(q => q.action === 'ADD' && q.data._id === id); if (existingAddIndex !== -1) { queue[existingAddIndex].data = { ...queue[existingAddIndex].data, ...medicineData }; saveQueue(queue); return { success: true }; } }
        addToQueue('UPDATE', { id, medicineData }); const status = await Network.getStatus(); if (status.connected) syncOfflineData(); return { success: true };
    };

    const swapIdInCache = async (tempId, realMedicine) => {
        const realId = realMedicine._id;
        const currentMeds = getCachedMedicines();
        const cleanMeds = currentMeds.filter(m => m._id !== tempId && m._id !== realId);
        const swappedMeds = [realMedicine, ...cleanMeds];
        saveMedicinesToCache(swappedMeds);
        setMedicines(swappedMeds);
        const currentLogs = getCachedLogs();
        const swappedLogs = currentLogs.map(log => {
            if (log.medicineId && log.medicineId._id === tempId) return { ...log, medicineId: { ...log.medicineId, _id: realId }, medicineClientId: realMedicine.clientId };
            return log;
        });
        saveLogsToCache(swappedLogs);
        setLogs(swappedLogs);
        let queue = getQueue();
        let queueChanged = false;
        queue = queue.map(q => {
            if (q.data.medicineClientId === tempId) { q.data.medicineClientId = realId; q.data.medicineId = realId; queueChanged = true; }
            return q;
        });
        if(queueChanged) saveQueue(queue);
        await cancelMedicineReminders(tempId);
        await scheduleMedicineReminder(realMedicine);
    };

    const deleteMedicine = async (id) => {
        processingRef.current.add(String(id));
        cancelMedicineReminders(id);
        const currentCache = getCachedMedicines();
        const newList = currentCache.filter(m => m._id !== id);
        saveMedicinesToCache(newList);
        setMedicines(newList);
        setLogs(prevLogs => {
            const now = new Date();
            return prevLogs.filter(log => {
                const logMedId = log.medicineId?._id || log.medicineId;
                if (String(logMedId) !== String(id)) return true;
                const logDate = new Date(log.date);
                const [h, m] = log.time.split(':').map(Number);
                logDate.setHours(h, m, 0, 0);
                return logDate <= now;
            });
        });
        let queue = getQueue();
        const wasTempAdd = queue.some(q => q.action === 'ADD' && q.data._id === id);
        queue = queue.filter(q => { const dataId = q.data._id || q.data.medicineClientId || q.data.medicineId; return String(dataId) !== String(id); });
        if (!wasTempAdd && !id.toString().startsWith('temp_')) { queue.unshift({ action: 'DELETE', data: { id }, timestamp: Date.now() }); }
        saveQueue(queue);
        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();
        return { success: true };
    };

    const addManualLog = async (medicineId, statusVal, medicineName) => {
        const now = new Date();
        const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const nowDayStr = now.toISOString().split('T')[0];
        let logToUpdateId = null;
        let isNewLog = false;
        setLogs(prevLogs => {
            const targetIndex = prevLogs.findIndex(log => (log.medicineId?._id === medicineId || log.medicineId === medicineId) && new Date(log.date).toISOString().split('T')[0] === nowDayStr && log.time === nowTimeStr);
            let newLogs = [...prevLogs];
            if (targetIndex !== -1) { logToUpdateId = newLogs[targetIndex]._id; newLogs[targetIndex] = { ...newLogs[targetIndex], status: statusVal, pendingSync: true }; } 
            else { isNewLog = true; const tempId = `log_manual_${Date.now()}`; logToUpdateId = tempId; const med = medicines.find(m => m._id === medicineId); const finalName = med?.name || medicineName || 'Unknown'; const finalClientId = med?.clientId || medicineId; newLogs.unshift({ _id: tempId, clientLogId: tempId, medicineId: { _id: medicineId, name: finalName }, medicineClientId: finalClientId, status: statusVal, date: now.toISOString(), time: nowTimeStr, pendingSync: true }); }
            saveLogsToCache(newLogs);
            return newLogs;
        });
        if(logToUpdateId) processingRef.current.add(logToUpdateId);
        const med = medicines.find(m => m._id === medicineId);
        const finalClientId = med?.clientId || medicineId;
        if (isNewLog) addToQueue('CREATE_LOG', { clientLogId: logToUpdateId, medicineClientId: finalClientId, status: statusVal, date: now.toISOString(), time: nowTimeStr, tempLogId: logToUpdateId });
        else { if (logToUpdateId.toString().startsWith('log_')) { const cachedLogs = getCachedLogs(); const logData = cachedLogs.find(l => l._id === logToUpdateId); if (logData) addToQueue('CREATE_LOG', { clientLogId: logData.clientLogId || logToUpdateId, medicineClientId: finalClientId, status: statusVal, date: logData.date, time: logData.time, tempLogId: logToUpdateId }); } else addToQueue('UPDATE_LOG', { logId: logToUpdateId, status: statusVal }); }
        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();
        return { success: true };
    };

    const updateLogStatus = async (logId, statusVal) => {
        processingRef.current.add(logId);
        setLogs(prevLogs => {
            const updated = prevLogs.map(log => {
                if (log._id === logId) return { ...log, status: statusVal, pendingSync: true };
                return log;
            });
            saveLogsToCache(updated);
            return updated;
        });
        
        const currentLogs = getCachedLogs();
        const logToUpdate = currentLogs.find(log => log._id === logId);
        if (!logToUpdate) { addToQueue('UPDATE_LOG', { logId, status: statusVal }); return { success: true }; }
        if (logToUpdate._id.toString().startsWith('log_')) { 
            let queue = getQueue();
            const existingCreateLogIndex = queue.findIndex(q => q.action === 'CREATE_LOG' && (q.data.clientLogId === logId || q.data.tempLogId === logId));
            if (existingCreateLogIndex !== -1) { queue[existingCreateLogIndex].data.status = statusVal; saveQueue(queue); } 
            else { addToQueue('CREATE_LOG', { clientLogId: logToUpdate.clientLogId || logToUpdate._id, medicineClientId: logToUpdate.medicineClientId || logToUpdate.medicineId._id, status: statusVal, date: logToUpdate.date, time: logToUpdate.time, tempLogId: logToUpdate._id }); }
        } else { addToQueue('UPDATE_LOG', { logId: logToUpdate._id, status: statusVal }); }
        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();
        return { success: true };
    };

    const syncOfflineData = async () => {
        if (isSyncingGlobal) return;
        const status = await Network.getStatus();
        if (!status.connected) return;
        let queue = getQueue();
        if (queue.length === 0) return;
        isSyncingGlobal = true;
        try {
            while (true) {
                const currentQueue = getQueue();
                if (currentQueue.length === 0) break;
                const item = currentQueue[0];
                let success = false;
                let processedId = null;

                try {
                    if (item.action === 'ADD') {
                        const payload = { ...item.data, clientId: item.data._id };
                        const res = await axios.post(`${API_BASE_URL}/medicines`, payload, { headers: { Authorization: `Bearer ${token}` } });
                        if (res.status === 200 || res.status === 201) { success = true; await swapIdInCache(item.data._id, res.data.medicine); }
                    } 
                    else if (item.action === 'CREATE_LOG') {
                        if (isLogDueForUpload(item.data)) {
                             const res = await axios.post(`${API_BASE_URL}/medicines/logs`, item.data, { headers: { Authorization: `Bearer ${token}` } });
                             if (res.status === 200 || res.status === 201) {
                                 success = true; const realLog = res.data.log; processedId = item.data.tempLogId; 
                                 const currentLogs = getCachedLogs();
                                 const syncedLogs = currentLogs.map(l => l._id === item.data.tempLogId ? { ...l, _id: realLog._id, pendingSync: false } : l);
                                 saveLogsToCache(syncedLogs); setLogs(syncedLogs);
                             }
                        } else success = true; 
                    }
                    else if (item.action === 'UPDATE_LOG') {
                         try { await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } }); success = true; processedId = item.data.logId; } 
                         catch (e) { if (e.response?.status === 404) success = true; else throw e; }
                    }
                    else if (item.action === 'UPDATE') { if (!item.data.id.toString().startsWith('temp_')) { await axios.put(`${API_BASE_URL}/medicines/${item.data.id}`, item.data.medicineData, { headers: { Authorization: `Bearer ${token}` } }); } success = true; }
                    else if (item.action === 'DELETE') { if (!item.data.id.toString().startsWith('temp_')) { await axios.delete(`${API_BASE_URL}/medicines/${item.data.id}`, { headers: { Authorization: `Bearer ${token}` } }); } success = true; processedId = item.data.id; }
                } catch (e) { if (e.response?.status === 404 && item.action === 'DELETE') success = true; else console.error("Sync Error:", e); }

                if (success) {
                    const freshQueue = getQueue();
                    const updatedQueue = freshQueue.filter(q => !isSameItem(q, item));
                    saveQueue(updatedQueue);
                    if (processedId) processingRef.current.delete(String(processedId));
                } else { break; }
            }
        } finally { isSyncingGlobal = false; }
    };

    const toggleMuteMedicine = async (id) => { const currentCache = getCachedMedicines(); const med = currentCache.find(m => m._id === id); if (!med) return; const newMuteStatus = !med.isMuted; const updatedMeds = currentCache.map(m => m._id === id ? { ...m, isMuted: newMuteStatus } : m); saveMedicinesToCache(updatedMeds); setMedicines(updatedMeds); if (id.toString().startsWith('temp_')) { let queue = getQueue(); const idx = queue.findIndex(q => q.data._id === id && (q.action === 'ADD' || q.action === 'UPDATE')); if (idx !== -1) { queue[idx].data.isMuted = newMuteStatus; saveQueue(queue); return { success: true }; } } addToQueue('UPDATE', { id, medicineData: { isMuted: newMuteStatus } }); const status = await Network.getStatus(); if (status.connected) syncOfflineData(); return { success: true }; };
    const togglePauseMedicine = async (id, extendDuration = false) => { const currentCache = getCachedMedicines(); const med = currentCache.find(m => m._id === id); if (!med) return; const isPausing = !med.isPaused; let updatePayload = { isPaused: isPausing }; if (isPausing) { updatePayload.pausedDate = new Date().toISOString(); await cancelMedicineReminders(id); } else { if (extendDuration && med.pausedDate) { updatePayload.pausedDate = null; } else { updatePayload.pausedDate = null; } } const updatedMeds = currentCache.map(m => m._id === id ? { ...m, ...updatePayload } : m); saveMedicinesToCache(updatedMeds); setMedicines(updatedMeds); const currentLogs = getCachedLogs(); const finalLogs = generatePendingLogs(updatedMeds, currentLogs); setLogs(finalLogs); saveLogsToCache(finalLogs); addToQueue('UPDATE', { id, medicineData: updatePayload }); const status = await Network.getStatus(); if (status.connected) syncOfflineData(); return { success: true }; };
    const handleNotificationAction = async (medicineId, actionId, medicineName) => { let statusVal; switch (actionId) { case 'taken_action': statusVal = 'taken'; break; case 'skip_action': statusVal = 'skipped'; break; default: return; } await addManualLog(medicineId, statusVal, medicineName); };
    const syncAlarms = async () => { const currentMeds = getCachedMedicines(); if (currentMeds.length === 0) return { success: false, message: "No medicines to sync." }; try { let count = 0; for (const med of currentMeds) { if (med.isActive && !med.isPaused) { await scheduleMedicineReminder(med); count++; } } return { success: true, message: `Rescheduled ${count} active medicines.` }; } catch (error) { return { success: false, message: "Failed to sync alarms." }; } };
    const fetchLogs = async () => getCachedLogs();
    const fetchFullHistory = async () => {}; 

    return { 
        medicines, logs, loading, lastSyncTime, 
        fetchMedicines: loadData, fetchFullHistory,
        addMedicine, updateMedicine, deleteMedicine, toggleMuteMedicine, togglePauseMedicine,
        handleNotificationAction, addManualLog, updateLogStatus, syncOfflineData, fetchLogs,
        syncAlarms
    };
};















// //you can use this code when existing code is not running
// //no medicine and log duplication, support multiple delete in race condition
// import { useState, useEffect, useRef } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { Network } from '@capacitor/network';
// import axios from 'axios';
// import { addToQueue, getQueue, saveQueue, saveMedicinesToCache, getCachedMedicines, saveLogsToCache, getCachedLogs } from '../utils/offlineStorage';
// import { scheduleMedicineReminder, cancelMedicineReminders } from '../utils/LocalNotificationManager';

// let isSyncingGlobal = false;

// // --- HELPER: Compare queue items safely ---
// // We use this to find and remove the exact item we just processed
// const isSameItem = (item1, item2) => {
//     if (!item1 || !item2) return false;
//     // If they have timestamps (best way), use that
//     if (item1.timestamp && item2.timestamp) return item1.timestamp === item2.timestamp;
//     // Fallback: Compare content
//     return item1.action === item2.action && 
//            JSON.stringify(item1.data) === JSON.stringify(item2.data);
// };

// // --- HELPERS (Time & Upload Logic) ---
// const getScheduledTimesForMedicine = (medicine, days = 7) => {
//     const schedules = [];
//     if (!medicine.times || medicine.times.length === 0) return schedules;
//     const today = new Date(); today.setHours(0, 0, 0, 0);
//     const endDate = new Date(medicine.duration?.endDate || '2100-01-01'); endDate.setHours(23, 59, 59, 999);
//     for (let day = 0; day < days; day++) {
//         const checkDate = new Date(today); checkDate.setDate(today.getDate() + day);
//         if (checkDate > endDate) break;
//         const startDate = new Date(medicine.duration?.startDate || today); startDate.setHours(0,0,0,0);
//         if (checkDate < startDate) continue;
//         for (const timeStr of medicine.times) {
//             const [hours, minutes] = timeStr.split(':').map(Number);
//             const scheduleTime = new Date(checkDate); scheduleTime.setHours(hours, minutes, 0, 0);
//             if (scheduleTime <= endDate && scheduleTime >= startDate) {
//                 schedules.push({ time: scheduleTime, timeStr: timeStr, dateStr: scheduleTime.toISOString().split('T')[0] });
//             }
//         }
//     }
//     return schedules;
// };

// const isLogDueForUpload = (log) => {
//     if (log.status !== 'pending') return true;
//     const now = new Date();
//     const logDate = new Date(log.date);
//     const [hours, minutes] = log.time.split(':').map(Number);
//     logDate.setHours(hours, minutes, 0, 0);
//     return logDate <= now;
// };

// export const useMedicines = () => {
//     const [medicines, setMedicines] = useState([]);
//     const [logs, setLogs] = useState([]); 
//     const [loading, setLoading] = useState(true);
//     const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('last_sync_time'));
    
//     const { token, API_BASE_URL } = useAuth();
//     const isAddingRef = useRef(false);
//     const processingRef = useRef(new Set()); // Busy Lock

//     useEffect(() => {
//         loadData(true); 
//         const netListener = Network.addListener('networkStatusChange', status => {
//             if (status.connected) syncOfflineData();
//         });
        
//         // Listen for background updates (but don't trigger carelessly)
//         const updateListener = () => {
//             if (!isSyncingGlobal) loadData(true);
//         };
//         window.addEventListener('medmind_data_updated', updateListener);
//         return () => {
//             netListener.remove();
//             window.removeEventListener('medmind_data_updated', updateListener);
//         };
//     }, []);

//     useEffect(() => {
//         if (token) loadData(false);
//         else { setMedicines([]); setLogs([]); }
//     }, [token]);
    
//     // --- GENERATE MISSING LOGS ---
//     const generatePendingLogs = (currentMeds, currentLogs) => {
//         const activeMedIds = new Set(currentMeds.map(m => m._id));
//         const now = new Date();
//         const validLogs = currentLogs.filter(log => {
//             if (log.status !== 'pending') return true; 
//             const medId = log.medicineId?._id || log.medicineId;
//             if (!activeMedIds.has(medId)) {
//                 const logDate = new Date(log.date);
//                 const [h, m] = log.time.split(':').map(Number);
//                 logDate.setHours(h, m, 0, 0);
//                 return logDate <= now; 
//             }
//             return true;
//         });
//         const updatedLogs = [...validLogs];
//         const existingLogSignatures = new Set();
//         validLogs.forEach(log => {
//             const medId = log.medicineId?._id || log.medicineId; 
//             const medClientId = log.medicineClientId;            
//             const dateStr = new Date(log.date).toISOString().split('T')[0];
//             const timeStr = log.time?.split(':').slice(0, 2).join(':'); 
//             if (medId) existingLogSignatures.add(`${medId}-${dateStr}-${timeStr}`);
//             if (medClientId) existingLogSignatures.add(`${medClientId}-${dateStr}-${timeStr}`);
//         });
//         for (const med of currentMeds) {
//             if (med.isPaused || !med.isActive) continue;
//             const medId = med._id;
//             const medClientId = med.clientId;
//             const schedules = getScheduledTimesForMedicine(med, 7); 
//             for (const schedule of schedules) {
//                 const sig1 = `${medId}-${schedule.dateStr}-${schedule.timeStr}`;
//                 const sig2 = `${medClientId}-${schedule.dateStr}-${schedule.timeStr}`;
//                 if (!existingLogSignatures.has(sig1) && !existingLogSignatures.has(sig2)) {
//                     const tempLogId = `log_gen_${medId}_${schedule.dateStr}_${schedule.timeStr}`; 
//                     updatedLogs.push({ _id: tempLogId, clientLogId: tempLogId, medicineId: { _id: medId, name: med.name }, medicineClientId: medClientId || medId, status: 'pending', date: schedule.time.toISOString(), time: schedule.timeStr, pendingSync: true });
//                     existingLogSignatures.add(sig1);
//                 }
//             }
//         }
//         return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
//     };

//     const queuePastPendingLogs = (allLogs) => {
//         let queue = getQueue();
//         let queueModified = false;
//         allLogs.forEach(log => {
//             if (!log._id.toString().startsWith('log_') || !log.pendingSync) return;
//             if (!isLogDueForUpload(log)) return;
//             const alreadyQueued = queue.some(q => q.action === 'CREATE_LOG' && (q.data.clientLogId === log.clientLogId || q.data.tempLogId === log._id));
//             if (!alreadyQueued) {
//                 const medClientId = log.medicineClientId || (log.medicineId?._id || log.medicineId);
//                 queue.push({ action: 'CREATE_LOG', data: { clientLogId: log.clientLogId || log._id, medicineClientId: medClientId, status: log.status, date: log.date, time: log.time, tempLogId: log._id }, timestamp: Date.now() });
//                 queueModified = true;
//             }
//         });
//         if (queueModified) {
//             saveQueue(queue);
//             Network.getStatus().then(status => { if (status.connected) syncOfflineData(); });
//         }
//     };

//     // --- 🟢 LOAD DATA (ZOMBIE KILLER) ---
//     const loadData = async (onlyCache = false) => {
//         let cachedMeds = getCachedMedicines();
//         let cachedLogs = getCachedLogs();

//         // 1. Initial Queue Check
//         let queue = getQueue();
//         let pendingDeleteIds = new Set(
//             queue.filter(q => q.action === 'DELETE').map(q => q.data.id ? String(q.data.id) : null).filter(Boolean)
//         );
//         cachedMeds = cachedMeds.filter(m => !pendingDeleteIds.has(String(m._id)));

//         let finalLogs = generatePendingLogs(cachedMeds, cachedLogs);
//         if (onlyCache || cachedMeds.length > 0) {
//             setMedicines(cachedMeds);
//             setLogs(finalLogs);
//             setLoading(false);
//             if (onlyCache) return;
//         }

//         if (isSyncingGlobal) return; // Trust local state during sync

//         const status = await Network.getStatus();
//         if (status.connected && token) {
//             try {
//                 const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
//                 const serverMedicines = resMeds.data.medicines;
                
//                 let serverLogs = [];
//                 try {
//                     const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
//                     serverLogs = resLogs.data.logs || [];
//                 } catch(e) { }

//                 // RE-READ QUEUE & BUSY LIST
//                 queue = getQueue(); 
//                 pendingDeleteIds = new Set(
//                     queue.filter(q => q.action === 'DELETE').map(q => q.data.id ? String(q.data.id) : null).filter(Boolean)
//                 );
//                 const busyIds = processingRef.current; 

//                 const serverClientIds = new Set(serverMedicines.map(m => m.clientId).filter(Boolean));
//                 const localTempMeds = cachedMeds.filter(localM => {
//                     const isTemp = localM._id.toString().startsWith('temp_');
//                     return isTemp && !serverClientIds.has(localM.clientId); 
//                 });

//                 let mergedMeds = [...localTempMeds, ...serverMedicines].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                
//                 // 🛑 FILTER ZOMBIES
//                 mergedMeds = mergedMeds.filter(m => {
//                     const idStr = String(m._id);
//                     if (pendingDeleteIds.has(idStr)) return false;
//                     if (busyIds.has(idStr)) return false;
//                     return true;
//                 });

//                 const mergedLogsMap = new Map();
//                 serverLogs.forEach(log => mergedLogsMap.set(log._id, log)); 

//                 cachedLogs.forEach(localLog => {
//                     if (busyIds.has(localLog._id)) { mergedLogsMap.set(localLog._id, localLog); return; }
//                     const serverLog = mergedLogsMap.get(localLog._id);
//                     if (localLog.pendingSync) { mergedLogsMap.set(localLog._id, localLog); } 
//                     else if (!serverLog) {
//                         if (localLog._id.toString().startsWith('log_') || localLog.clientLogId) {
//                             mergedLogsMap.set(localLog._id, localLog);
//                         }
//                     }
//                 });

//                 const uniqueLogs = Array.from(mergedLogsMap.values());
//                 finalLogs = generatePendingLogs(mergedMeds, uniqueLogs); 
//                 queuePastPendingLogs(finalLogs);

//                 setMedicines(mergedMeds);
//                 saveMedicinesToCache(mergedMeds);
//                 setLogs(finalLogs);
//                 saveLogsToCache(finalLogs);

//                 const now = new Date().toISOString();
//                 setLastSyncTime(now);
//                 localStorage.setItem('last_sync_time', now);
//                 setLoading(false);

//             } catch (e) { console.log("Using offline cache due to error."); }
//         } else { setLoading(false); }
//     };

//     // --- ADD MEDICINE ---
//     const addMedicine = async (medicineData) => {
//         if (isAddingRef.current) return { success: false, message: "Processing..." };
//         isAddingRef.current = true;
//         try {
//             const tempId = `temp_${Date.now()}`;
//             const newMedicine = { ...medicineData, _id: tempId, clientId: tempId, pendingSync: true, createdAt: new Date().toISOString(), times: medicineData.times || [], duration: medicineData.duration || { startDate: new Date(), endDate: new Date() }, isMuted: false, isPaused: false, isActive: true };
//             const currentCache = getCachedMedicines();
//             const newMedList = [newMedicine, ...currentCache]; 
//             saveMedicinesToCache(newMedList);
//             setMedicines(newMedList); 
//             const currentLogs = getCachedLogs();
//             const newGeneratedLogs = generatePendingLogs([newMedicine], []);
//             const updatedLogs = [...currentLogs, ...newGeneratedLogs];
//             saveLogsToCache(updatedLogs);
//             setLogs(updatedLogs); 
            
//             await scheduleMedicineReminder(newMedicine);
//             // Add unique timestamp for safe queue handling
//             addToQueue('ADD', { ...newMedicine }); 
            
//             const status = await Network.getStatus();
//             if (status.connected) syncOfflineData(); 
//             return { success: true };
//         } finally { isAddingRef.current = false; }
//     };

//     // --- DELETE MEDICINE ---
//     const deleteMedicine = async (id) => {
//         processingRef.current.add(String(id));
//         cancelMedicineReminders(id);

//         const currentCache = getCachedMedicines();
//         const newList = currentCache.filter(m => m._id !== id);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);

//         setLogs(prevLogs => {
//             const now = new Date();
//             return prevLogs.filter(log => {
//                 const logMedId = log.medicineId?._id || log.medicineId;
//                 if (String(logMedId) !== String(id)) return true;
//                 const logDate = new Date(log.date);
//                 const [h, m] = log.time.split(':').map(Number);
//                 logDate.setHours(h, m, 0, 0);
//                 return logDate <= now;
//             });
//         });

//         let queue = getQueue();
//         const wasTempAdd = queue.some(q => q.action === 'ADD' && q.data._id === id);
//         queue = queue.filter(q => { const dataId = q.data._id || q.data.medicineClientId || q.data.medicineId; return String(dataId) !== String(id); });
        
//         if (!wasTempAdd && !id.toString().startsWith('temp_')) {
//             // 🔥 Manually add timestamp here since we are unshifting manually
//             queue.unshift({ action: 'DELETE', data: { id }, timestamp: Date.now() });
//         }
        
//         saveQueue(queue);
        
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     // --- UPDATE LOG ---
//     const updateLogStatus = async (logId, statusVal) => {
//         processingRef.current.add(logId);
//         setLogs(prevLogs => {
//             const updated = prevLogs.map(log => {
//                 if (log._id === logId) return { ...log, status: statusVal, pendingSync: true };
//                 return log;
//             });
//             saveLogsToCache(updated);
//             return updated;
//         });
        
//         const currentLogs = getCachedLogs();
//         const logToUpdate = currentLogs.find(log => log._id === logId);
//         if (!logToUpdate) { addToQueue('UPDATE_LOG', { logId, status: statusVal }); return { success: true }; }
        
//         if (logToUpdate._id.toString().startsWith('log_')) { 
//             let queue = getQueue();
//             const existingCreateLogIndex = queue.findIndex(q => q.action === 'CREATE_LOG' && (q.data.clientLogId === logId || q.data.tempLogId === logId));
//             if (existingCreateLogIndex !== -1) { queue[existingCreateLogIndex].data.status = statusVal; saveQueue(queue); } 
//             else { addToQueue('CREATE_LOG', { clientLogId: logToUpdate.clientLogId || logToUpdate._id, medicineClientId: logToUpdate.medicineClientId || logToUpdate.medicineId._id, status: statusVal, date: logToUpdate.date, time: logToUpdate.time, tempLogId: logToUpdate._id }); }
//         } else { addToQueue('UPDATE_LOG', { logId: logToUpdate._id, status: statusVal }); }
        
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     // --- 🟢 SYNC FUNCTION (ATOMIC QUEUE HANDLING) ---
//     const syncOfflineData = async () => {
//         if (isSyncingGlobal) return;
//         const status = await Network.getStatus();
//         if (!status.connected) return;

//         let queue = getQueue();
//         if (queue.length === 0) return;

//         isSyncingGlobal = true;

//         try {
//             // Process Items One by One (Always taking from Head)
//             // This loop condition checks the queue length dynamically
//             while (true) {
//                 // 1. FRESH READ: Always get the latest queue state
//                 const currentQueue = getQueue();
//                 if (currentQueue.length === 0) break;

//                 const item = currentQueue[0]; // Take the first item
//                 let success = false;
//                 let processedId = null;

//                 try {
//                     if (item.action === 'ADD') {
//                         const payload = { ...item.data, clientId: item.data._id };
//                         const res = await axios.post(`${API_BASE_URL}/medicines`, payload, { headers: { Authorization: `Bearer ${token}` } });
//                         if (res.status === 200 || res.status === 201) {
//                             success = true;
//                             await swapIdInCache(item.data._id, res.data.medicine);
//                         }
//                     } 
//                     else if (item.action === 'CREATE_LOG') {
//                         if (isLogDueForUpload(item.data)) {
//                              const res = await axios.post(`${API_BASE_URL}/medicines/logs`, item.data, { headers: { Authorization: `Bearer ${token}` } });
//                              if (res.status === 200 || res.status === 201) {
//                                  success = true;
//                                  const realLog = res.data.log;
//                                  processedId = item.data.tempLogId; 
//                                  const currentLogs = getCachedLogs();
//                                  const syncedLogs = currentLogs.map(l => l._id === item.data.tempLogId ? { ...l, _id: realLog._id, pendingSync: false } : l);
//                                  saveLogsToCache(syncedLogs);
//                                  setLogs(syncedLogs);
//                              }
//                         } else success = true; 
//                     }
//                     else if (item.action === 'UPDATE_LOG') {
//                          try {
//                              await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
//                              success = true;
//                              processedId = item.data.logId;
//                          } catch (updateError) {
//                              if (updateError.response?.status === 404) success = true; 
//                              else throw updateError;
//                          }
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
//                          processedId = item.data.id;
//                     }

//                 } catch (e) { 
//                     if (e.response?.status === 404 && item.action === 'DELETE') success = true; 
//                     else console.error("Sync Error:", e);
//                 }

//                 if (success) {
//                     // 🛡️ SAFE REMOVAL: Read queue AGAIN to ensure we don't overwrite new items
//                     const freshQueue = getQueue();
//                     const updatedQueue = freshQueue.filter(q => !isSameItem(q, item));
//                     saveQueue(updatedQueue);
                    
//                     if (processedId) processingRef.current.delete(String(processedId));
//                 } else {
//                     // If failed, break loop to prevent infinite retry loop blocking UI
//                     // Or implement a retry count. For now, break to let user continue.
//                     break; 
//                 }
//             }
            
//             // Sync complete - Safe to refresh view eventually, but not required immediately
//             // triggerGlobalUpdate(); 
//         } finally {
//             isSyncingGlobal = false;
//         }
//     };

//     // ... [Other functions: updateMedicine, swapIdInCache, addManualLog, toggleMute, togglePause, handleNotificationAction, syncAlarms, fetchLogs] ...
//     // COPY THEM FROM PREVIOUS STEPS (They are stable now)
    
//     // (Included for completion)
//     const updateMedicine = async (id, medicineData) => { const currentCache = getCachedMedicines(); const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m); saveMedicinesToCache(newList); setMedicines(newList); const currentLogs = getCachedLogs(); const finalLogs = generatePendingLogs(newList, currentLogs); setLogs(finalLogs); saveLogsToCache(finalLogs); queuePastPendingLogs(finalLogs); const updatedMed = newList.find(m => m._id === id); if(updatedMed && !updatedMed.isPaused) await scheduleMedicineReminder(updatedMed); if (id.toString().startsWith('temp_')) { let queue = getQueue(); const existingAddIndex = queue.findIndex(q => q.action === 'ADD' && q.data._id === id); if (existingAddIndex !== -1) { queue[existingAddIndex].data = { ...queue[existingAddIndex].data, ...medicineData }; saveQueue(queue); return { success: true }; } } addToQueue('UPDATE', { id, medicineData }); const status = await Network.getStatus(); if (status.connected) syncOfflineData(); return { success: true }; };
//     const swapIdInCache = async (tempId, realMedicine) => { const realId = realMedicine._id; const currentMeds = getCachedMedicines(); const cleanMeds = currentMeds.filter(m => m._id !== tempId && m._id !== realId); const swappedMeds = [realMedicine, ...cleanMeds]; saveMedicinesToCache(swappedMeds); setMedicines(swappedMeds); const currentLogs = getCachedLogs(); const swappedLogs = currentLogs.map(log => { if (log.medicineId && log.medicineId._id === tempId) return { ...log, medicineId: { ...log.medicineId, _id: realId }, medicineClientId: realMedicine.clientId }; return log; }); saveLogsToCache(swappedLogs); setLogs(swappedLogs); let queue = getQueue(); let queueChanged = false; queue = queue.map(q => { if (q.data.medicineClientId === tempId) { q.data.medicineClientId = realId; q.data.medicineId = realId; queueChanged = true; } return q; }); if(queueChanged) saveQueue(queue); await cancelMedicineReminders(tempId); await scheduleMedicineReminder(realMedicine); };
//     const addManualLog = async (medicineId, statusVal, medicineName) => { const now = new Date(); const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); const nowDayStr = now.toISOString().split('T')[0]; let logToUpdateId = null; let isNewLog = false; setLogs(prevLogs => { const targetIndex = prevLogs.findIndex(log => (log.medicineId?._id === medicineId || log.medicineId === medicineId) && new Date(log.date).toISOString().split('T')[0] === nowDayStr && log.time === nowTimeStr); let newLogs = [...prevLogs]; if (targetIndex !== -1) { logToUpdateId = newLogs[targetIndex]._id; newLogs[targetIndex] = { ...newLogs[targetIndex], status: statusVal, pendingSync: true }; } else { isNewLog = true; const tempId = `log_manual_${Date.now()}`; logToUpdateId = tempId; const med = medicines.find(m => m._id === medicineId); const finalName = med?.name || medicineName || 'Unknown'; const finalClientId = med?.clientId || medicineId; newLogs.unshift({ _id: tempId, clientLogId: tempId, medicineId: { _id: medicineId, name: finalName }, medicineClientId: finalClientId, status: statusVal, date: now.toISOString(), time: nowTimeStr, pendingSync: true }); } saveLogsToCache(newLogs); return newLogs; }); if(logToUpdateId) processingRef.current.add(logToUpdateId); const med = medicines.find(m => m._id === medicineId); const finalClientId = med?.clientId || medicineId; if (isNewLog) addToQueue('CREATE_LOG', { clientLogId: logToUpdateId, medicineClientId: finalClientId, status: statusVal, date: now.toISOString(), time: nowTimeStr, tempLogId: logToUpdateId }); else { if (logToUpdateId.toString().startsWith('log_')) { const cachedLogs = getCachedLogs(); const logData = cachedLogs.find(l => l._id === logToUpdateId); if (logData) addToQueue('CREATE_LOG', { clientLogId: logData.clientLogId || logToUpdateId, medicineClientId: finalClientId, status: statusVal, date: logData.date, time: logData.time, tempLogId: logToUpdateId }); } else addToQueue('UPDATE_LOG', { logId: logToUpdateId, status: statusVal }); } const status = await Network.getStatus(); if (status.connected) syncOfflineData(); return { success: true }; };
//     const toggleMuteMedicine = async (id) => { const currentCache = getCachedMedicines(); const med = currentCache.find(m => m._id === id); if (!med) return; const newMuteStatus = !med.isMuted; const updatedMeds = currentCache.map(m => m._id === id ? { ...m, isMuted: newMuteStatus } : m); saveMedicinesToCache(updatedMeds); setMedicines(updatedMeds); if (id.toString().startsWith('temp_')) { let queue = getQueue(); const idx = queue.findIndex(q => q.data._id === id && (q.action === 'ADD' || q.action === 'UPDATE')); if (idx !== -1) { queue[idx].data.isMuted = newMuteStatus; saveQueue(queue); return { success: true }; } } addToQueue('UPDATE', { id, medicineData: { isMuted: newMuteStatus } }); const status = await Network.getStatus(); if (status.connected) syncOfflineData(); return { success: true }; };
//     const togglePauseMedicine = async (id, extendDuration = false) => { const currentCache = getCachedMedicines(); const med = currentCache.find(m => m._id === id); if (!med) return; const isPausing = !med.isPaused; let updatePayload = { isPaused: isPausing }; if (isPausing) { updatePayload.pausedDate = new Date().toISOString(); await cancelMedicineReminders(id); } else { if (extendDuration && med.pausedDate) { updatePayload.pausedDate = null; } else { updatePayload.pausedDate = null; } } const updatedMeds = currentCache.map(m => m._id === id ? { ...m, ...updatePayload } : m); saveMedicinesToCache(updatedMeds); setMedicines(updatedMeds); const currentLogs = getCachedLogs(); const finalLogs = generatePendingLogs(updatedMeds, currentLogs); setLogs(finalLogs); saveLogsToCache(finalLogs); addToQueue('UPDATE', { id, medicineData: updatePayload }); const status = await Network.getStatus(); if (status.connected) syncOfflineData(); return { success: true }; };
//     const handleNotificationAction = async (medicineId, actionId, medicineName) => { let statusVal; switch (actionId) { case 'taken_action': statusVal = 'taken'; break; case 'skip_action': statusVal = 'skipped'; break; default: return; } await addManualLog(medicineId, statusVal, medicineName); };
//     const syncAlarms = async () => { const currentMeds = getCachedMedicines(); if (currentMeds.length === 0) return { success: false, message: "No medicines to sync." }; try { let count = 0; for (const med of currentMeds) { if (med.isActive && !med.isPaused) { await scheduleMedicineReminder(med); count++; } } return { success: true, message: `Rescheduled ${count} active medicines.` }; } catch (error) { return { success: false, message: "Failed to sync alarms." }; } };
//     const fetchLogs = async () => getCachedLogs();
//     const fetchFullHistory = async () => {}; 

//     return { 
//         medicines, logs, loading, lastSyncTime, 
//         fetchMedicines: loadData, fetchFullHistory,
//         addMedicine, updateMedicine, deleteMedicine, toggleMuteMedicine, togglePauseMedicine,
//         handleNotificationAction, addManualLog, updateLogStatus, syncOfflineData, fetchLogs,
//         syncAlarms
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

// // --- HELPERS ---
// const getScheduledTimesForMedicine = (medicine, days = 7) => {
//     const schedules = [];
//     if (!medicine.times || medicine.times.length === 0) return schedules;
//     const today = new Date(); 
//     today.setHours(0, 0, 0, 0);
    
//     const endDate = new Date(medicine.duration?.endDate || '2100-01-01'); 
//     endDate.setHours(23, 59, 59, 999);

//     for (let day = 0; day < days; day++) {
//         const checkDate = new Date(today); 
//         checkDate.setDate(today.getDate() + day);
        
//         if (checkDate > endDate) break;
//         const startDate = new Date(medicine.duration?.startDate || today);
//         startDate.setHours(0,0,0,0);
//         if (checkDate < startDate) continue;

//         for (const timeStr of medicine.times) {
//             const [hours, minutes] = timeStr.split(':').map(Number);
//             const scheduleTime = new Date(checkDate); 
//             scheduleTime.setHours(hours, minutes, 0, 0);
            
//             if (scheduleTime <= endDate && scheduleTime >= startDate) {
//                 schedules.push({ 
//                     time: scheduleTime, 
//                     timeStr: timeStr, 
//                     dateStr: scheduleTime.toISOString().split('T')[0] 
//                 });
//             }
//         }
//     }
//     return schedules;
// };

// const isLogDueForUpload = (log) => {
//     if (log.status !== 'pending') return true;
//     const now = new Date();
//     const logDate = new Date(log.date);
//     const [hours, minutes] = log.time.split(':').map(Number);
//     logDate.setHours(hours, minutes, 0, 0);
//     return logDate <= now;
// };

// export const useMedicines = () => {
//     const [medicines, setMedicines] = useState([]);
//     const [logs, setLogs] = useState([]); 
//     const [loading, setLoading] = useState(true);
//     const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('last_sync_time'));
    
//     const { token, API_BASE_URL } = useAuth();
//     const isAddingRef = useRef(false);

//     // Initial Load & Event Listeners
//     useEffect(() => {
//         loadData(true); 
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

//     // Reload on Login
//     useEffect(() => {
//         if (token) loadData(false);
//         else {
//             setMedicines([]);
//             setLogs([]);
//         }
//     }, [token]);
    
//     // --- 🟢 FIX 1: DEDUPLICATE LOG GENERATION ---
//     const generatePendingLogs = (currentMeds, currentLogs) => {
//         const activeMedIds = new Set(currentMeds.map(m => m._id));
//         const now = new Date();

//         // 1. Filter existing logs (Keep History, Keep Pending only if valid)
//         const validLogs = currentLogs.filter(log => {
//             // Always keep logs that have a status (Taken/Missed/Skipped)
//             if (log.status !== 'pending') return true; 
            
//             const medId = log.medicineId?._id || log.medicineId;
            
//             // If the medicine is missing (deleted), only keep logs in the PAST
//             if (!activeMedIds.has(medId)) {
//                 const logDate = new Date(log.date);
//                 const [h, m] = log.time.split(':').map(Number);
//                 logDate.setHours(h, m, 0, 0);
//                 return logDate <= now; 
//             }
//             return true;
//         });

//         const updatedLogs = [...validLogs];

//         // 2. Create a "Fingerprint" Map of existing logs
//         const existingLogSignatures = new Set();
        
//         validLogs.forEach(log => {
//             const medId = log.medicineId?._id || log.medicineId; // Real/Database ID
//             const medClientId = log.medicineClientId;            // Client/Temp ID
            
//             const dateStr = new Date(log.date).toISOString().split('T')[0];
//             const timeStr = log.time?.split(':').slice(0, 2).join(':'); 
            
//             if (medId) existingLogSignatures.add(`${medId}-${dateStr}-${timeStr}`);
//             if (medClientId) existingLogSignatures.add(`${medClientId}-${dateStr}-${timeStr}`);
//         });

//         // 3. Generate Ghosts ONLY if no signature exists
//         for (const med of currentMeds) {
//             if (med.isPaused || !med.isActive) continue;
            
//             const medId = med._id;
//             const medClientId = med.clientId;
//             const schedules = getScheduledTimesForMedicine(med, 7); 

//             for (const schedule of schedules) {
//                 const sig1 = `${medId}-${schedule.dateStr}-${schedule.timeStr}`;
//                 const sig2 = `${medClientId}-${schedule.dateStr}-${schedule.timeStr}`;

//                 // 🛑 BLOCK GHOST if any matching log exists (Real OR Temp)
//                 if (!existingLogSignatures.has(sig1) && !existingLogSignatures.has(sig2)) {
                    
//                     const tempLogId = `log_gen_${medId}_${schedule.dateStr}_${schedule.timeStr}`; 
                    
//                     updatedLogs.push({
//                         _id: tempLogId,
//                         clientLogId: tempLogId, 
//                         medicineId: { _id: medId, name: med.name },
//                         medicineClientId: medClientId || medId,
//                         status: 'pending',
//                         date: schedule.time.toISOString(), 
//                         time: schedule.timeStr,
//                         pendingSync: true
//                     });

//                     existingLogSignatures.add(sig1);
//                 }
//             }
//         }
        
//         return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
//     };

//     // --- QUEUE LOGIC ---
//     const queuePastPendingLogs = (allLogs) => {
//         let queue = getQueue();
//         let queueModified = false;
        
//         allLogs.forEach(log => {
//             if (!log._id.toString().startsWith('log_') || !log.pendingSync) return;
//             if (!isLogDueForUpload(log)) return;

//             const alreadyQueued = queue.some(q => 
//                 q.action === 'CREATE_LOG' && 
//                 (q.data.clientLogId === log.clientLogId || q.data.tempLogId === log._id)
//             );

//             if (!alreadyQueued) {
//                 const medClientId = log.medicineClientId || (log.medicineId?._id || log.medicineId);
//                 queue.push({
//                     action: 'CREATE_LOG',
//                     data: {
//                         clientLogId: log.clientLogId || log._id,
//                         medicineClientId: medClientId,
//                         status: log.status,
//                         date: log.date,
//                         time: log.time,
//                         tempLogId: log._id
//                     }
//                 });
//                 queueModified = true;
//             }
//         });

//         if (queueModified) {
//             saveQueue(queue);
//             Network.getStatus().then(status => {
//                 if (status.connected) syncOfflineData();
//             });
//         }
//     };

//    // --- 1. LOAD DATA (FINAL: LOCAL WINS STRATEGY) ---
//     const loadData = async (onlyCache = false) => {
//         let cachedMeds = getCachedMedicines();
//         let cachedLogs = getCachedLogs();

//         // 1. Get Pending Deletes (To hide zombies)
//         const queue = getQueue();
//         const pendingDeleteIds = new Set(
//             queue
//                 .filter(q => q.action === 'DELETE')
//                 .map(q => q.data.id ? String(q.data.id) : null)
//                 .filter(Boolean)
//         );

//         // 2. Initial Filter of Cache
//         cachedMeds = cachedMeds.filter(m => !pendingDeleteIds.has(String(m._id)));

//         // 3. Quick Render from Cache
//         if (onlyCache || cachedMeds.length > 0) {
//             const initialLogs = generatePendingLogs(cachedMeds, cachedLogs);
//             setMedicines(cachedMeds);
//             setLogs(initialLogs);
//             setLoading(false);
//             if (onlyCache) return;
//         }

//         const status = await Network.getStatus();
//         if (status.connected && token) {
//             try {
//                 // 4. Fetch Server Data
//                 const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
//                 const serverMedicines = resMeds.data.medicines;
                
//                 let serverLogs = [];
//                 try {
//                     const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
//                     serverLogs = resLogs.data.logs || [];
//                 } catch(e) { }

//                 // --- 🟢 MEDICINE MERGE LOGIC ---
//                 const serverClientIds = new Set(serverMedicines.map(m => m.clientId).filter(Boolean));
                
//                 const localTempMeds = cachedMeds.filter(localM => {
//                     const isTemp = localM._id.toString().startsWith('temp_');
//                     return isTemp && !serverClientIds.has(localM.clientId); 
//                 });

//                 let mergedMeds = [...localTempMeds, ...serverMedicines]
//                     .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                
//                 // 🛡️ STRICT ZOMBIE FILTER: Remove anything currently in delete queue
//                 mergedMeds = mergedMeds.filter(m => !pendingDeleteIds.has(String(m._id)));


//                 // --- 🟢 LOG MERGE LOGIC (CRITICAL FIX) ---
//                 // Strategy: Server Logs are base, but LOCAL logs override if pendingSync is true
//                 const mergedLogsMap = new Map();

//                 // A. Add Server Logs first
//                 serverLogs.forEach(log => mergedLogsMap.set(log._id, log)); 

//                 // B. Overlay Local Logs
//                 cachedLogs.forEach(localLog => {
//                     const serverLog = mergedLogsMap.get(localLog._id);

//                     if (localLog.pendingSync) {
//                         // 🏆 LOCAL WINS: If we have pending changes, ignore server's old data
//                         mergedLogsMap.set(localLog._id, localLog);
//                     } 
//                     else if (!serverLog) {
//                         // Keep local log if server doesn't have it yet (e.g. temp logs)
//                         // But only if it's a generated ID or we created it
//                         if (localLog._id.toString().startsWith('log_') || localLog.clientLogId) {
//                             mergedLogsMap.set(localLog._id, localLog);
//                         }
//                     }
//                 });

//                 const uniqueLogs = Array.from(mergedLogsMap.values());
                
//                 // 5. Final Generation & State Update
//                 const finalLogs = generatePendingLogs(mergedMeds, uniqueLogs); 
//                 queuePastPendingLogs(finalLogs);

//                 setMedicines(mergedMeds);
//                 saveMedicinesToCache(mergedMeds);
//                 setLogs(finalLogs);
//                 saveLogsToCache(finalLogs);

//                 const now = new Date().toISOString();
//                 setLastSyncTime(now);
//                 localStorage.setItem('last_sync_time', now);
//                 setLoading(false);

//             } catch (e) { console.log("Using offline cache due to error."); }
//         } else {
//             setLoading(false);
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
//                 clientId: tempId, 
//                 pendingSync: true,
//                 createdAt: new Date().toISOString(), 
//                 times: medicineData.times || [],
//                 duration: medicineData.duration || { startDate: new Date(), endDate: new Date() },
//                 isMuted: false, 
//                 isPaused: false,
//                 isActive: true 
//             };

//             const currentCache = getCachedMedicines();
//             const newMedList = [newMedicine, ...currentCache]; 
//             saveMedicinesToCache(newMedList);
//             setMedicines(newMedList); 
            
//             const currentLogs = getCachedLogs();
//             const newGeneratedLogs = generatePendingLogs([newMedicine], []);
//             const updatedLogs = [...currentLogs, ...newGeneratedLogs];
            
//             saveLogsToCache(updatedLogs);
//             setLogs(updatedLogs); 

//             triggerGlobalUpdate();
//             await scheduleMedicineReminder(newMedicine);
//             addToQueue('ADD', { ...newMedicine }); 

//             const status = await Network.getStatus();
//             if (status.connected) syncOfflineData(); 

//             return { success: true };
//         } finally {
//             isAddingRef.current = false;
//         }
//     };

//     // --- 3. UPDATE MEDICINE (OPTIMISTIC) ---
//     const updateMedicine = async (id, medicineData) => {
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
        
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
        
//         const currentLogs = getCachedLogs();
//         const finalLogs = generatePendingLogs(newList, currentLogs);
//         setLogs(finalLogs);
//         saveLogsToCache(finalLogs);
        
//         queuePastPendingLogs(finalLogs);
        
//         triggerGlobalUpdate();

//         const updatedMed = newList.find(m => m._id === id);
//         if(updatedMed && !updatedMed.isPaused) {
//             await scheduleMedicineReminder(updatedMed);
//         }

//         if (id.toString().startsWith('temp_')) {
//             let queue = getQueue();
//             const existingAddIndex = queue.findIndex(q => q.action === 'ADD' && q.data._id === id);
//             if (existingAddIndex !== -1) {
//                 queue[existingAddIndex].data = { ...queue[existingAddIndex].data, ...medicineData };
//                 saveQueue(queue);
//                 return { success: true };
//             }
//         }

//         addToQueue('UPDATE', { id, medicineData });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     // --- FIX 3: ROBUST ID SWAP ---
//     const swapIdInCache = async (tempId, realMedicine) => {
//         const realId = realMedicine._id;
//         console.log(`🔄 Swapping Temp ID: ${tempId} -> Real ID: ${realId}`);

//         const currentMeds = getCachedMedicines();
//         const cleanMeds = currentMeds.filter(m => m._id !== tempId && m._id !== realId);
//         const swappedMeds = [realMedicine, ...cleanMeds];
        
//         saveMedicinesToCache(swappedMeds);
//         setMedicines(swappedMeds);

//         const currentLogs = getCachedLogs();
//         const swappedLogs = currentLogs.map(log => {
//             const logMedId = log.medicineId?._id || log.medicineId;
//             if (logMedId === tempId) {
//                 return { 
//                     ...log, 
//                     medicineId: { _id: realId, name: realMedicine.name },
//                     medicineClientId: realMedicine.clientId
//                 };
//             }
//             return log;
//         });
//         saveLogsToCache(swappedLogs);
//         setLogs(swappedLogs);

//         let queue = getQueue();
//         let queueChanged = false;
//         queue = queue.map(q => {
//             if (q.data.medicineClientId === tempId) {
//                 q.data.medicineClientId = realId;
//                 q.data.medicineId = realId;
//                 queueChanged = true;
//             }
//             return q;
//         });
//         if(queueChanged) saveQueue(queue);

//         await cancelMedicineReminders(tempId);
//         await scheduleMedicineReminder(realMedicine);
        
//         triggerGlobalUpdate();
//     };

//     // --- FIX 4: OPTIMISTIC DELETE ---
//     const deleteMedicine = async (id) => {
//         cancelMedicineReminders(id);

//         const currentCache = getCachedMedicines();
//         const newList = currentCache.filter(m => m._id !== id);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);

//         setLogs(prevLogs => {
//             const now = new Date();
//             return prevLogs.filter(log => {
//                 const logMedId = log.medicineId?._id || log.medicineId;
//                 if (String(logMedId) !== String(id)) return true;
//                 const logDate = new Date(log.date);
//                 const [h, m] = log.time.split(':').map(Number);
//                 logDate.setHours(h, m, 0, 0);
//                 return logDate <= now;
//             });
//         });

//         let queue = getQueue();
        
//         const wasTempAdd = queue.some(q => q.action === 'ADD' && q.data._id === id);
        
//         queue = queue.filter(q => {
//              const dataId = q.data._id || q.data.medicineClientId || q.data.medicineId;
//              return String(dataId) !== String(id);
//         });

//         if (!wasTempAdd && !id.toString().startsWith('temp_')) {
//             queue.unshift({ action: 'DELETE', data: { id } });
//         }
        
//         saveQueue(queue);
//         triggerGlobalUpdate();

//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     // --- 5. MANUAL LOG ---
//     const addManualLog = async (medicineId, statusVal, medicineName) => {
//         const now = new Date();
//         const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
//         const nowDayStr = now.toISOString().split('T')[0];
        
//         let logToUpdateId = null;
//         let isNewLog = false;

//         setLogs(prevLogs => {
//             const targetIndex = prevLogs.findIndex(log => 
//                 (log.medicineId?._id === medicineId || log.medicineId === medicineId) && 
//                 new Date(log.date).toISOString().split('T')[0] === nowDayStr && 
//                 log.time === nowTimeStr 
//             );

//             let newLogs = [...prevLogs];

//             if (targetIndex !== -1) {
//                 logToUpdateId = newLogs[targetIndex]._id;
//                 newLogs[targetIndex] = { ...newLogs[targetIndex], status: statusVal, pendingSync: true };
//             } else {
//                 isNewLog = true;
//                 const tempId = `log_manual_${Date.now()}`;
//                 logToUpdateId = tempId;
                
//                 const med = medicines.find(m => m._id === medicineId);
//                 const finalName = med?.name || medicineName || 'Unknown';
//                 const finalClientId = med?.clientId || medicineId;

//                 newLogs.unshift({
//                     _id: tempId,
//                     clientLogId: tempId,
//                     medicineId: { _id: medicineId, name: finalName }, 
//                     medicineClientId: finalClientId,
//                     status: statusVal, 
//                     date: now.toISOString(),
//                     time: nowTimeStr,
//                     pendingSync: true
//                 });
//             }
//             saveLogsToCache(newLogs);
//             return newLogs;
//         });

//         triggerGlobalUpdate();
        
//         const med = medicines.find(m => m._id === medicineId);
//         const finalClientId = med?.clientId || medicineId;

//         if (isNewLog) {
//              addToQueue('CREATE_LOG', {
//                  clientLogId: logToUpdateId,
//                  medicineClientId: finalClientId,
//                  status: statusVal,
//                  date: now.toISOString(),
//                  time: nowTimeStr,
//                  tempLogId: logToUpdateId 
//              });
//         } else {
//              if (logToUpdateId.toString().startsWith('log_')) {
//                  const cachedLogs = getCachedLogs();
//                  const logData = cachedLogs.find(l => l._id === logToUpdateId);
//                  if (logData) {
//                      addToQueue('CREATE_LOG', {
//                          clientLogId: logData.clientLogId || logToUpdateId,
//                          medicineClientId: finalClientId,
//                          status: statusVal,
//                          date: logData.date,
//                          time: logData.time,
//                          tempLogId: logToUpdateId 
//                      });
//                  }
//              } else { 
//                  addToQueue('UPDATE_LOG', { logId: logToUpdateId, status: statusVal });
//              }
//         }

//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();

//         return { success: true };
//     };

//     // --- 6. UPDATE LOG STATUS ---
//     const updateLogStatus = async (logId, statusVal) => {
//         setLogs(prevLogs => {
//             const updated = prevLogs.map(log => {
//                 if (log._id === logId) {
//                     return { ...log, status: statusVal, pendingSync: true };
//                 }
//                 return log;
//             });
//             saveLogsToCache(updated);
//             return updated;
//         });

//         triggerGlobalUpdate();
        
//         const currentLogs = getCachedLogs();
//         const logToUpdate = currentLogs.find(log => log._id === logId);

//         if (!logToUpdate) {
//              addToQueue('UPDATE_LOG', { logId, status: statusVal });
//              return { success: true };
//         }
        
//         if (logToUpdate._id.toString().startsWith('log_')) { 
//             let queue = getQueue();
//             const existingCreateLogIndex = queue.findIndex(q => 
//                 q.action === 'CREATE_LOG' && (q.data.clientLogId === logId || q.data.tempLogId === logId)
//             );

//             if (existingCreateLogIndex !== -1) {
//                 queue[existingCreateLogIndex].data.status = statusVal;
//                 saveQueue(queue);
//             } else {
//                 addToQueue('CREATE_LOG', {
//                      clientLogId: logToUpdate.clientLogId || logToUpdate._id,
//                      medicineClientId: logToUpdate.medicineClientId || logToUpdate.medicineId._id,
//                      status: statusVal,
//                      date: logToUpdate.date,
//                      time: logToUpdate.time,
//                      tempLogId: logToUpdate._id 
//                 });
//             }
//         } else { 
//             addToQueue('UPDATE_LOG', { logId: logToUpdate._id, status: statusVal });
//         }

//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();

//         return { success: true };
//     };

//     // --- 7. MUTE/PAUSE ---
//     const toggleMuteMedicine = async (id) => {
//         const currentCache = getCachedMedicines();
//         const med = currentCache.find(m => m._id === id);
//         if (!med) return;

//         const newMuteStatus = !med.isMuted;
//         const updatedMeds = currentCache.map(m => m._id === id ? { ...m, isMuted: newMuteStatus } : m);
//         saveMedicinesToCache(updatedMeds);
//         setMedicines(updatedMeds);
//         triggerGlobalUpdate();

//         if (id.toString().startsWith('temp_')) {
//             let queue = getQueue();
//             const idx = queue.findIndex(q => q.data._id === id && (q.action === 'ADD' || q.action === 'UPDATE'));
//             if (idx !== -1) {
//                 queue[idx].data.isMuted = newMuteStatus;
//                 saveQueue(queue);
//                 return { success: true };
//             }
//         }
//         addToQueue('UPDATE', { id, medicineData: { isMuted: newMuteStatus } });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     const togglePauseMedicine = async (id, extendDuration = false) => {
//         const currentCache = getCachedMedicines();
//         const med = currentCache.find(m => m._id === id);
//         if (!med) return;

//         const isPausing = !med.isPaused;
//         let updatePayload = { isPaused: isPausing };

//         if (isPausing) {
//             updatePayload.pausedDate = new Date().toISOString();
//             await cancelMedicineReminders(id);
//         } else {
//             if (extendDuration && med.pausedDate) {
//                 // Calculation logic if needed, simplified here
//                updatePayload.pausedDate = null;
//             } else {
//                 updatePayload.pausedDate = null;
//             }
//         }

//         const updatedMeds = currentCache.map(m => m._id === id ? { ...m, ...updatePayload } : m);
//         saveMedicinesToCache(updatedMeds);
//         setMedicines(updatedMeds);
        
//         const currentLogs = getCachedLogs();
//         const finalLogs = generatePendingLogs(updatedMeds, currentLogs);
//         setLogs(finalLogs);
//         saveLogsToCache(finalLogs);

//         triggerGlobalUpdate();
        
//         addToQueue('UPDATE', { id, medicineData: updatePayload });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     const handleNotificationAction = async (medicineId, actionId, medicineName) => {
//         let statusVal;
//         switch (actionId) {
//             case 'taken_action': statusVal = 'taken'; break;
//             case 'skip_action': statusVal = 'skipped'; break;
//             default: return;
//         }
//         await addManualLog(medicineId, statusVal, medicineName);
//     };

//     // --- 9. SYNC FUNCTION ---
//     const syncOfflineData = async () => {
//         if (isSyncingGlobal) return;
//         const status = await Network.getStatus();
//         if (!status.connected) return;

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
//                         const payload = { ...item.data, clientId: item.data._id };
//                         const res = await axios.post(`${API_BASE_URL}/medicines`, payload, { headers: { Authorization: `Bearer ${token}` } });
//                         if (res.status === 200 || res.status === 201) {
//                             success = true;
//                             await swapIdInCache(item.data._id, res.data.medicine);
//                         }
//                     } 
//                     else if (item.action === 'CREATE_LOG') {
//                         if (isLogDueForUpload(item.data)) {
//                              const res = await axios.post(`${API_BASE_URL}/medicines/logs`, item.data, { headers: { Authorization: `Bearer ${token}` } });
//                              if (res.status === 200 || res.status === 201) {
//                                  success = true;
//                                  const realLog = res.data.log;
//                                  const currentLogs = getCachedLogs();
//                                  const syncedLogs = currentLogs.map(l => l._id === item.data.tempLogId ? { ...l, _id: realLog._id, pendingSync: false } : l);
//                                  saveLogsToCache(syncedLogs);
//                                  setLogs(syncedLogs);
//                              }
//                         } else {
//                             success = true; 
//                         }
//                     }
//                     else if (item.action === 'UPDATE_LOG') {
//                          try {
//                              await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
//                              success = true;
//                          } catch (updateError) {
//                              if (updateError.response?.status === 404) success = true; 
//                              else throw updateError;
//                          }
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

//                 } catch (e) { 
//                     if (e.response?.status === 404 && item.action === 'DELETE') success = true; 
//                     else console.error("Sync Error:", e);
//                 }

//                 if (success) {
//                     queue.splice(i, 1);
//                     saveQueue(queue); 
//                 } else {
//                     i++; 
//                 }
//             }
//             triggerGlobalUpdate();
//         } finally {
//             isSyncingGlobal = false;
//         }
//     };

//     const syncAlarms = async () => {
//         const currentMeds = getCachedMedicines();
//         if (currentMeds.length === 0) return { success: false, message: "No medicines to sync." };
//         try {
//             let count = 0;
//             for (const med of currentMeds) {
//                 if (med.isActive && !med.isPaused) {
//                     await scheduleMedicineReminder(med);
//                     count++;
//                 }
//             }
//             return { success: true, message: `Rescheduled ${count} active medicines.` };
//         } catch (error) {
//             return { success: false, message: "Failed to sync alarms." };
//         }
//     };

//     const fetchLogs = async () => getCachedLogs();
//     const fetchFullHistory = async () => {}; 

//     return { 
//         medicines, logs, loading, lastSyncTime, 
//         fetchMedicines: loadData, fetchFullHistory,
//         addMedicine, updateMedicine, deleteMedicine, toggleMuteMedicine, togglePauseMedicine,
//         handleNotificationAction, addManualLog, updateLogStatus, syncOfflineData, fetchLogs,
//         syncAlarms
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

// // --- HELPERS ---
// const getScheduledTimesForMedicine = (medicine, days = 7) => {
//     const schedules = [];
//     if (!medicine.times || medicine.times.length === 0) return schedules;
//     const today = new Date(); 
//     today.setHours(0, 0, 0, 0);
    
//     const endDate = new Date(medicine.duration?.endDate || '2100-01-01'); 
//     endDate.setHours(23, 59, 59, 999);

//     for (let day = 0; day < days; day++) {
//         const checkDate = new Date(today); 
//         checkDate.setDate(today.getDate() + day);
        
//         if (checkDate > endDate) break;
//         const startDate = new Date(medicine.duration?.startDate || today);
//         startDate.setHours(0,0,0,0);
//         if (checkDate < startDate) continue;

//         for (const timeStr of medicine.times) {
//             const [hours, minutes] = timeStr.split(':').map(Number);
//             const scheduleTime = new Date(checkDate); 
//             scheduleTime.setHours(hours, minutes, 0, 0);
            
//             if (scheduleTime <= endDate && scheduleTime >= startDate) {
//                 schedules.push({ 
//                     time: scheduleTime, 
//                     timeStr: timeStr, 
//                     dateStr: scheduleTime.toISOString().split('T')[0] 
//                 });
//             }
//         }
//     }
//     return schedules;
// };

// const isLogDueForUpload = (log) => {
//     if (log.status !== 'pending') return true;
//     const now = new Date();
//     const logDate = new Date(log.date);
//     const [hours, minutes] = log.time.split(':').map(Number);
//     logDate.setHours(hours, minutes, 0, 0);
//     return logDate <= now;
// };

// export const useMedicines = () => {
//     const [medicines, setMedicines] = useState([]);
//     const [logs, setLogs] = useState([]); 
//     const [loading, setLoading] = useState(true);
//     const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('last_sync_time'));
    
//     const { token, API_BASE_URL } = useAuth();
//     const isAddingRef = useRef(false);

//     // Initial Load & Event Listeners
//     useEffect(() => {
//         loadData(true); 
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

//     // Reload on Login
//     useEffect(() => {
//         if (token) loadData(false);
//         else {
//             setMedicines([]);
//             setLogs([]);
//         }
//     }, [token]);
    
//     // --- 🟢 FIX 1: DEDUPLICATE LOG GENERATION ---
//     // const generatePendingLogs = (currentMeds, currentLogs) => {
//     //     const activeMedIds = new Set(currentMeds.map(m => m._id));
//     //     const now = new Date();

//     //     // 1. Filter existing logs (Keep History, Keep Pending only if valid)
//     //     const validLogs = currentLogs.filter(log => {
//     //         if (log.status !== 'pending') return true; // Keep history
            
//     //         const medId = log.medicineId?._id || log.medicineId;
            
//     //         // If the medicine is missing (deleted), only keep logs in the PAST
//     //         if (!activeMedIds.has(medId)) {
//     //             const logDate = new Date(log.date);
//     //             const [h, m] = log.time.split(':').map(Number);
//     //             logDate.setHours(h, m, 0, 0);
//     //             return logDate <= now; 
//     //         }
//     //         return true;
//     //     });

//     //     // 2. Map existing logs to avoid duplicates
//     //     // Key format: "MedID-Date-Time"
//     //     const updatedLogs = [...validLogs];
//     //     const logMap = new Set();
        
//     //     validLogs.forEach(log => {
//     //         const medId = log.medicineId?._id || log.medicineId;
//     //         const dateStr = new Date(log.date).toISOString().split('T')[0];
//     //         const timeStr = log.time?.split(':').slice(0, 2).join(':'); 
//     //         logMap.add(`${medId}-${dateStr}-${timeStr}`);
//     //     });

//     //     // 3. Generate future logs ONLY if they don't exist
//     //     for (const med of currentMeds) {
//     //         if (med.isPaused || !med.isActive) continue;
//     //         const medId = med._id;
//     //         const schedules = getScheduledTimesForMedicine(med, 7); 

//     //         for (const schedule of schedules) {
//     //             // Check if log exists for Real ID OR Temp ID (prevents double logs during sync)
//     //             const mapKeyReal = `${medId}-${schedule.dateStr}-${schedule.timeStr}`;
//     //             const mapKeyClient = `${med.clientId}-${schedule.dateStr}-${schedule.timeStr}`;
                
//     //             if (!logMap.has(mapKeyReal) && !logMap.has(mapKeyClient)) {
//     //                 const tempLogId = `log_gen_${Date.now()}_${Math.random()}`; 
//     //                 updatedLogs.push({
//     //                     _id: tempLogId,
//     //                     medicineId: { _id: medId, name: med.name },
//     //                     status: 'pending',
//     //                     date: schedule.time.toISOString(), 
//     //                     time: schedule.timeStr,
//     //                     pendingSync: true,
//     //                     clientLogId: tempLogId,
//     //                     medicineClientId: med.clientId || medId
//     //                 });
//     //                 logMap.add(mapKeyReal); 
//     //             }
//     //         }
//     //     }
//     //     return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
//     // };



//     // --- GENERATE MISSING LOGS (Aggressive Deduplication) ---
//     const generatePendingLogs = (currentMeds, currentLogs) => {
//         const activeMedIds = new Set(currentMeds.map(m => m._id));
//         const now = new Date();

//         // 1. Filter existing logs (Keep History, Keep Pending only if valid)
//         const validLogs = currentLogs.filter(log => {
//             // Always keep logs that have a status (Taken/Missed/Skipped)
//             if (log.status !== 'pending') return true; 
            
//             const medId = log.medicineId?._id || log.medicineId;
            
//             // If the medicine is missing (deleted), only keep logs in the PAST
//             // (This prevents "ghost" future logs for deleted medicines)
//             if (!activeMedIds.has(medId)) {
//                 const logDate = new Date(log.date);
//                 const [h, m] = log.time.split(':').map(Number);
//                 logDate.setHours(h, m, 0, 0);
//                 return logDate <= now; 
//             }
//             return true;
//         });

//         const updatedLogs = [...validLogs];

//         // 2. Create a "Fingerprint" Map of existing logs
//         // We add signatures for BOTH the Real ID and the Client/Temp ID.
//         // This ensures we catch duplicates even if the ID hasn't synced perfectly yet.
//         const existingLogSignatures = new Set();
        
//         validLogs.forEach(log => {
//             const medId = log.medicineId?._id || log.medicineId; // Real/Database ID
//             const medClientId = log.medicineClientId;            // Client/Temp ID
            
//             const dateStr = new Date(log.date).toISOString().split('T')[0];
//             const timeStr = log.time?.split(':').slice(0, 2).join(':'); 
            
//             if (medId) existingLogSignatures.add(`${medId}-${dateStr}-${timeStr}`);
//             if (medClientId) existingLogSignatures.add(`${medClientId}-${dateStr}-${timeStr}`);
//         });

//         // 3. Generate Ghosts ONLY if no signature exists
//         for (const med of currentMeds) {
//             if (med.isPaused || !med.isActive) continue;
            
//             const medId = med._id;
//             const medClientId = med.clientId;
//             const schedules = getScheduledTimesForMedicine(med, 7); 

//             for (const schedule of schedules) {
//                 // Generate signatures for the potential new log
//                 const sig1 = `${medId}-${schedule.dateStr}-${schedule.timeStr}`;
//                 const sig2 = `${medClientId}-${schedule.dateStr}-${schedule.timeStr}`;

//                 // 🛑 BLOCK GHOST if any matching log exists (Real OR Temp)
//                 if (!existingLogSignatures.has(sig1) && !existingLogSignatures.has(sig2)) {
                    
//                     // Create a deterministic ID (so it doesn't change on re-render)
//                     const tempLogId = `log_gen_${medId}_${schedule.dateStr}_${schedule.timeStr}`; 
                    
//                     updatedLogs.push({
//                         _id: tempLogId,
//                         clientLogId: tempLogId, // Use this as the stable ID
//                         medicineId: { _id: medId, name: med.name },
//                         medicineClientId: medClientId || medId,
//                         status: 'pending',
//                         date: schedule.time.toISOString(), 
//                         time: schedule.timeStr,
//                         pendingSync: true
//                     });

//                     // Add to map so we don't generate duplicates in this same loop
//                     existingLogSignatures.add(sig1);
//                 }
//             }
//         }
        
//         // Sort: Newest First
//         return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
//     };

//     // --- QUEUE LOGIC ---
//     const queuePastPendingLogs = (allLogs) => {
//         let queue = getQueue();
//         let queueModified = false;
        
//         allLogs.forEach(log => {
//             if (!log._id.toString().startsWith('log_') || !log.pendingSync) return;
//             if (!isLogDueForUpload(log)) return;

//             const alreadyQueued = queue.some(q => 
//                 q.action === 'CREATE_LOG' && 
//                 (q.data.clientLogId === log.clientLogId || q.data.tempLogId === log._id)
//             );

//             if (!alreadyQueued) {
//                 const medClientId = log.medicineClientId || (log.medicineId?._id || log.medicineId);
//                 queue.push({
//                     action: 'CREATE_LOG',
//                     data: {
//                         clientLogId: log.clientLogId || log._id,
//                         medicineClientId: medClientId,
//                         status: log.status,
//                         date: log.date,
//                         time: log.time,
//                         tempLogId: log._id
//                     }
//                 });
//                 queueModified = true;
//             }
//         });

//         if (queueModified) {
//             saveQueue(queue);
//             Network.getStatus().then(status => {
//                 if (status.connected) syncOfflineData();
//             });
//         }
//     };

//     // --- 1. LOAD DATA (MERGE FIX) ---
//     const loadData = async (onlyCache = false) => {
//         let cachedMeds = getCachedMedicines();
//         let cachedLogs = getCachedLogs();

//         // 🛑 1. CHECK QUEUE FOR PENDING DELETES
//         // If we are waiting to delete ID "123", we must hide it 
//         // even if the server or cache says it exists.
//         const queue = getQueue();
//         const pendingDeleteIds = new Set(
//             queue
//                 .filter(q => q.action === 'DELETE')
//                 .map(q => q.data.id ? String(q.data.id) : null)
//                 .filter(Boolean)
//         );
        
//         let finalLogs = generatePendingLogs(cachedMeds, cachedLogs);
//         if (onlyCache || cachedMeds.length > 0) {
//             setMedicines(cachedMeds);
//             setLogs(finalLogs);
//             setLoading(false);
//             if (onlyCache) return;
//         }

//         const status = await Network.getStatus();
//         if (status.connected && token) {
//             try {
//                 // Fetch Server Data
//                 const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
//                 const serverMedicines = resMeds.data.medicines;
                
//                 let serverLogs = [];
//                 try {
//                     const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
//                     serverLogs = resLogs.data.logs || [];
//                 } catch(e) { }

//                 // 🟢 FIX 2: INTELLIGENT MERGE (Server Wins)
//                 const serverClientIds = new Set(serverMedicines.map(m => m.clientId).filter(Boolean));
                
//                 // Only keep local temp meds that the server DOES NOT have yet
//                 const localTempMeds = cachedMeds.filter(localM => {
//                     const isTemp = localM._id.toString().startsWith('temp_');
//                     return isTemp && !serverClientIds.has(localM.clientId); 
//                 });

//                 const mergedMeds = [...localTempMeds, ...serverMedicines]
//                     .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                

//                     // 🛑 2. APPLY QUEUE FILTER TO SERVER DATA TOO
//                 // This stops the "Zombie Reappearance"
//                 mergedMeds = mergedMeds.filter(m => !pendingDeleteIds.has(String(m._id)));

//                 // Merge Logs
//                 const mergedLogsMap = new Map();
//                 serverLogs.forEach(log => mergedLogsMap.set(log._id, log)); // Server logs win

//                 cachedLogs.forEach(localLog => {
//                     const isLocal = localLog._id.toString().startsWith('log_') || localLog.pendingSync === true;
//                     if (isLocal && !mergedLogsMap.has(localLog._id)) {
//                         mergedLogsMap.set(localLog._id, localLog);
//                     }
//                 });

//                 const uniqueLogs = Array.from(mergedLogsMap.values());
//                 finalLogs = generatePendingLogs(mergedMeds, uniqueLogs); 
//                 queuePastPendingLogs(finalLogs);

//                 setMedicines(mergedMeds);
//                 saveMedicinesToCache(mergedMeds);
//                 setLogs(finalLogs);
//                 saveLogsToCache(finalLogs);

//                 const now = new Date().toISOString();
//                 setLastSyncTime(now);
//                 localStorage.setItem('last_sync_time', now);
//                 setLoading(false);

//             } catch (e) { console.log("Using offline cache due to error."); }
//         } else {
//             setLoading(false);
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
//                 clientId: tempId, 
//                 pendingSync: true,
//                 createdAt: new Date().toISOString(), 
//                 times: medicineData.times || [],
//                 duration: medicineData.duration || { startDate: new Date(), endDate: new Date() },
//                 isMuted: false, 
//                 isPaused: false,
//                 isActive: true 
//             };

//             const currentCache = getCachedMedicines();
//             const newMedList = [newMedicine, ...currentCache]; 
//             saveMedicinesToCache(newMedList);
//             setMedicines(newMedList); 
            
//             const currentLogs = getCachedLogs();
//             const newGeneratedLogs = generatePendingLogs([newMedicine], []);
//             const updatedLogs = [...currentLogs, ...newGeneratedLogs];
            
//             saveLogsToCache(updatedLogs);
//             setLogs(updatedLogs); 

//             triggerGlobalUpdate();
//             await scheduleMedicineReminder(newMedicine);
//             addToQueue('ADD', { ...newMedicine }); 

//             const status = await Network.getStatus();
//             if (status.connected) syncOfflineData(); 

//             return { success: true };
//         } finally {
//             isAddingRef.current = false;
//         }
//     };

//     // --- 3. UPDATE MEDICINE (OPTIMISTIC) ---
//     const updateMedicine = async (id, medicineData) => {
//         // Optimistic Update
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
        
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
        
//         const currentLogs = getCachedLogs();
//         const finalLogs = generatePendingLogs(newList, currentLogs);
//         setLogs(finalLogs);
//         saveLogsToCache(finalLogs);
        
//         queuePastPendingLogs(finalLogs); // Removed second arg (not needed)
        
//         triggerGlobalUpdate();

//         const updatedMed = newList.find(m => m._id === id);
//         if(updatedMed && !updatedMed.isPaused) {
//             await scheduleMedicineReminder(updatedMed);
//         }

//         // Queue Handling
//         if (id.toString().startsWith('temp_')) {
//             let queue = getQueue();
//             const existingAddIndex = queue.findIndex(q => q.action === 'ADD' && q.data._id === id);
//             if (existingAddIndex !== -1) {
//                 queue[existingAddIndex].data = { ...queue[existingAddIndex].data, ...medicineData };
//                 saveQueue(queue);
//                 return { success: true };
//             }
//         }

//         addToQueue('UPDATE', { id, medicineData });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     // --- 🟢 FIX 3: ROBUST ID SWAP (NO DUPLICATES) ---
//     const swapIdInCache = async (tempId, realMedicine) => {
//         const realId = realMedicine._id;
//         console.log(`🔄 Swapping Temp ID: ${tempId} -> Real ID: ${realId}`);

//         // 1. Medicine List: Filter out TEMP AND REAL (to prevent duplicates), then add REAL
//         const currentMeds = getCachedMedicines();
//         const cleanMeds = currentMeds.filter(m => m._id !== tempId && m._id !== realId);
//         const swappedMeds = [realMedicine, ...cleanMeds];
        
//         saveMedicinesToCache(swappedMeds);
//         setMedicines(swappedMeds);

//         // 2. Logs: Find any logs pointing to TempID and point them to RealID
//         const currentLogs = getCachedLogs();
//         const swappedLogs = currentLogs.map(log => {
//             const logMedId = log.medicineId?._id || log.medicineId;
//             if (logMedId === tempId) {
//                 return { 
//                     ...log, 
//                     medicineId: { _id: realId, name: realMedicine.name },
//                     medicineClientId: realMedicine.clientId
//                 };
//             }
//             return log;
//         });
//         saveLogsToCache(swappedLogs);
//         setLogs(swappedLogs);

//         // 3. Queue: Update any pending actions waiting on this ID
//         let queue = getQueue();
//         let queueChanged = false;
//         queue = queue.map(q => {
//             if (q.data.medicineClientId === tempId) {
//                 q.data.medicineClientId = realId;
//                 q.data.medicineId = realId;
//                 queueChanged = true;
//             }
//             return q;
//         });
//         if(queueChanged) saveQueue(queue);

//         // 4. Alarms
//         await cancelMedicineReminders(tempId);
//         await scheduleMedicineReminder(realMedicine);
        
//         triggerGlobalUpdate();
//     };

//     // --- 🟢 FIX 4: OPTIMISTIC DELETE (NO LAG) ---
//     const deleteMedicine = async (id) => {
//         // 1. Immediate UI Update
//         cancelMedicineReminders(id); // Fire and forget (don't await)

//         const currentCache = getCachedMedicines();
//         const newList = currentCache.filter(m => m._id !== id);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);

//         // 2. Clean Logs Immediately
//         setLogs(prevLogs => {
//             const now = new Date();
//             return prevLogs.filter(log => {
//                 const logMedId = log.medicineId?._id || log.medicineId;
//                 if (String(logMedId) !== String(id)) return true;
//                 // Keep history only
//                 const logDate = new Date(log.date);
//                 const [h, m] = log.time.split(':').map(Number);
//                 logDate.setHours(h, m, 0, 0);
//                 return logDate <= now;
//             });
//         });

//         // triggerGlobalUpdate();

//         // 3. Handle Queue (Prevent Add -> Delete loops)
//         let queue = getQueue();
        
//         // If we are deleting a temp item that hasn't synced yet, simply remove the ADD action
//         const wasTempAdd = queue.some(q => q.action === 'ADD' && q.data._id === id);
        
//         queue = queue.filter(q => {
//              const dataId = q.data._id || q.data.medicineClientId || q.data.medicineId;
//              return String(dataId) !== String(id);
//         });

//         if (!wasTempAdd && !id.toString().startsWith('temp_')) {
//             queue.unshift({ action: 'DELETE', data: { id } });
//         }
        
//         saveQueue(queue);
//         triggerGlobalUpdate();


//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     // --- 5. MANUAL LOG ---
//     const addManualLog = async (medicineId, statusVal, medicineName) => {
//         const now = new Date();
//         const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
//         const nowDayStr = now.toISOString().split('T')[0];
        
//         const currentLogs = getCachedLogs();
        
//         let med = medicines.find(m => m._id === medicineId);
//         if (!med && medicineName) med = medicines.find(m => m.name === medicineName);
//         if (med && med.isPaused) return { success: false, message: "Medicine is paused." };

//         const finalName = med?.name || medicineName || 'Unknown Medicine';
//         const finalMedId = med?._id || medicineId;
//         const finalClientId = med?.clientId || med?._id || medicineId;

//         const targetLogIndex = currentLogs.findIndex(log => 
//             (log.medicineId?._id === finalMedId || log.medicineId === finalMedId) && 
//             new Date(log.date).toISOString().split('T')[0] === nowDayStr && 
//             log.time === nowTimeStr 
//         );
        
//         let logToUpdate = null;
//         if (targetLogIndex !== -1) {
//             logToUpdate = currentLogs[targetLogIndex];
//         } else {
//              logToUpdate = {
//                  _id: `log_manual_${Date.now()}`,
//                  clientLogId: `log_manual_${Date.now()}`,
//                  medicineId: { _id: finalMedId, name: finalName }, 
//                  medicineClientId: finalClientId,
//                  status: 'pending', 
//                  date: now.toISOString(),
//                  time: nowTimeStr,
//                  pendingSync: true
//              };
//              if(targetLogIndex === -1) currentLogs.unshift(logToUpdate);
//         }

//         const updatedLogs = currentLogs.map(log => 
//             log._id === logToUpdate._id ? 
//             { ...log, status: statusVal, pendingSync: true } : log
//         );

//         saveLogsToCache(updatedLogs);
//         setLogs(updatedLogs); 
//         triggerGlobalUpdate();
        
//         if (logToUpdate._id.toString().startsWith('log_')) { 
//              addToQueue('CREATE_LOG', {
//                  clientLogId: logToUpdate.clientLogId || logToUpdate._id,
//                  medicineClientId: finalClientId,
//                  status: statusVal,
//                  date: logToUpdate.date,
//                  time: logToUpdate.time,
//                  tempLogId: logToUpdate._id 
//              });
//         } else { 
//              addToQueue('UPDATE_LOG', { logId: logToUpdate._id, status: statusVal });
//         }

//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();

//         return { success: true };
//     };

//     // --- 6. UPDATE LOG STATUS ---
//     const updateLogStatus = async (logId, statusVal) => {
//         const currentLogs = getCachedLogs();
//         const logToUpdate = currentLogs.find(log => log._id === logId);

//         if (!logToUpdate) {
//             loadData(false);
//             return { success: false, message: "Log not found." };
//         }
        
//         // Optimistic Update
//         const updatedLogs = currentLogs.map(log => 
//             log._id === logId ? { ...log, status: statusVal, pendingSync: true } : log
//         );

//         saveLogsToCache(updatedLogs);
//         setLogs(updatedLogs);
//         triggerGlobalUpdate();
        
//         if (logToUpdate._id.toString().startsWith('log_')) { 
//             let queue = getQueue();
//             const existingCreateLogIndex = queue.findIndex(q => 
//                 q.action === 'CREATE_LOG' && (q.data.clientLogId === logId || q.data.tempLogId === logId)
//             );

//             if (existingCreateLogIndex !== -1) {
//                 queue[existingCreateLogIndex].data.status = statusVal;
//                 saveQueue(queue);
//             } else {
//                 addToQueue('CREATE_LOG', {
//                      clientLogId: logToUpdate.clientLogId || logToUpdate._id,
//                      medicineClientId: logToUpdate.medicineClientId || logToUpdate.medicineId._id,
//                      status: statusVal,
//                      date: logToUpdate.date,
//                      time: logToUpdate.time,
//                      tempLogId: logToUpdate._id 
//                 });
//             }
//         } else { 
//             addToQueue('UPDATE_LOG', { logId: logToUpdate._id, status: statusVal });
//         }

//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();

//         return { success: true };
//     };

//     // --- 7. MUTE/PAUSE ACTIONS ---
//     const toggleMuteMedicine = async (id) => {
//         const currentCache = getCachedMedicines();
//         const med = currentCache.find(m => m._id === id);
//         if (!med) return;

//         const newMuteStatus = !med.isMuted;
//         const updatedMeds = currentCache.map(m => m._id === id ? { ...m, isMuted: newMuteStatus } : m);
//         saveMedicinesToCache(updatedMeds);
//         setMedicines(updatedMeds);
//         triggerGlobalUpdate();

//         // Queue logic same as before...
//         if (id.toString().startsWith('temp_')) {
//             let queue = getQueue();
//             const idx = queue.findIndex(q => q.data._id === id && (q.action === 'ADD' || q.action === 'UPDATE'));
//             if (idx !== -1) {
//                 queue[idx].data.isMuted = newMuteStatus;
//                 saveQueue(queue);
//                 return { success: true };
//             }
//         }
//         addToQueue('UPDATE', { id, medicineData: { isMuted: newMuteStatus } });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     const togglePauseMedicine = async (id, extendDuration = false) => {
//         // (Similar update logic to updateMedicine but specific for Pause)
//         // Re-using logic from your previous file to save space, but ensuring Optimistic Update
//         const currentCache = getCachedMedicines();
//         const med = currentCache.find(m => m._id === id);
//         if (!med) return;

//         const isPausing = !med.isPaused;
//         let updatePayload = { isPaused: isPausing };

//         if (isPausing) {
//             updatePayload.pausedDate = new Date().toISOString();
//             await cancelMedicineReminders(id);
//         } else {
//             // ... (Your duration extension logic) ...
//             if (extendDuration && med.pausedDate) {
//                // ... logic ...
//                updatePayload.pausedDate = null;
//             } else {
//                 updatePayload.pausedDate = null;
//             }
//         }

//         // Apply Optimistic Update
//         const updatedMeds = currentCache.map(m => m._id === id ? { ...m, ...updatePayload } : m);
//         saveMedicinesToCache(updatedMeds);
//         setMedicines(updatedMeds);
        
//         const currentLogs = getCachedLogs();
//         const finalLogs = generatePendingLogs(updatedMeds, currentLogs);
//         setLogs(finalLogs);
//         saveLogsToCache(finalLogs);

//         triggerGlobalUpdate();
        
//         // Queue ...
//         addToQueue('UPDATE', { id, medicineData: updatePayload });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
//         return { success: true };
//     };

//     const handleNotificationAction = async (medicineId, actionId, medicineName) => {
//         let statusVal;
//         switch (actionId) {
//             case 'taken_action': statusVal = 'taken'; break;
//             case 'skip_action': statusVal = 'skipped'; break;
//             default: return;
//         }
//         await addManualLog(medicineId, statusVal, medicineName);
//     };

//     // --- 9. SYNC FUNCTION ---
//     const syncOfflineData = async () => {
//         if (isSyncingGlobal) return;
//         const status = await Network.getStatus();
//         if (!status.connected) return;

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
//                         const payload = { ...item.data, clientId: item.data._id };
//                         const res = await axios.post(`${API_BASE_URL}/medicines`, payload, { headers: { Authorization: `Bearer ${token}` } });
//                         if (res.status === 200 || res.status === 201) {
//                             success = true;
//                             // 🟢 CRITICAL: Swap ID immediately
//                             await swapIdInCache(item.data._id, res.data.medicine);
//                         }
//                     } 
//                     else if (item.action === 'CREATE_LOG') {
//                         if (isLogDueForUpload(item.data)) {
//                              const res = await axios.post(`${API_BASE_URL}/medicines/logs`, item.data, { headers: { Authorization: `Bearer ${token}` } });
//                              if (res.status === 200 || res.status === 201) {
//                                  success = true;
//                                  const realLog = res.data.log;
//                                  const currentLogs = getCachedLogs();
//                                  const syncedLogs = currentLogs.map(l => l._id === item.data.tempLogId ? { ...l, _id: realLog._id, pendingSync: false } : l);
//                                  saveLogsToCache(syncedLogs);
//                                  setLogs(syncedLogs);
//                              }
//                         } else {
//                             success = true; 
//                         }
//                     }
//                     else if (item.action === 'UPDATE_LOG') {
//                          try {
//                              await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
//                              success = true;
//                          } catch (updateError) {
//                              if (updateError.response?.status === 404) success = true; 
//                              else throw updateError;
//                          }
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

//                 } catch (e) { 
//                     // If server returns 404 for a delete action, consider it done
//                     if (e.response?.status === 404 && item.action === 'DELETE') success = true; 
//                     else console.error("Sync Error:", e);
//                 }

//                 if (success) {
//                     queue.splice(i, 1);
//                     saveQueue(queue); 
//                 } else {
//                     i++; 
//                 }
//             }
//             triggerGlobalUpdate();
//         } finally {
//             isSyncingGlobal = false;
//         }
//     };

//     const syncAlarms = async () => {
//         const currentMeds = getCachedMedicines();
//         if (currentMeds.length === 0) return { success: false, message: "No medicines to sync." };
//         try {
//             let count = 0;
//             for (const med of currentMeds) {
//                 if (med.isActive && !med.isPaused) {
//                     await scheduleMedicineReminder(med);
//                     count++;
//                 }
//             }
//             return { success: true, message: `Rescheduled ${count} active medicines.` };
//         } catch (error) {
//             return { success: false, message: "Failed to sync alarms." };
//         }
//     };

//     const fetchLogs = async () => getCachedLogs();
//     const fetchFullHistory = async () => {}; 

//     return { 
//         medicines, logs, loading, lastSyncTime, 
//         fetchMedicines: loadData, fetchFullHistory,
//         addMedicine, updateMedicine, deleteMedicine, toggleMuteMedicine, togglePauseMedicine,
//         handleNotificationAction, addManualLog, updateLogStatus, syncOfflineData, fetchLogs,
//         syncAlarms
//     };
// };
