import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Network } from '@capacitor/network';
import axios from 'axios';
import { addToQueue, getQueue, saveQueue, saveMedicinesToCache, getCachedMedicines, saveLogsToCache, getCachedLogs } from '../utils/offlineStorage';
import { scheduleMedicineReminder, cancelMedicineReminders } from '../utils/LocalNotificationManager';

const triggerGlobalUpdate = () => {
    window.dispatchEvent(new Event('medmind_data_updated'));
};

let isSyncingGlobal = false;

// Helper: Calculate Schedule
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

// Helper: Time Check
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

    useEffect(() => {
        loadData(true); 

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
    
    // --- GENERATE MISSING LOGS ---
    const generatePendingLogs = (currentMeds, currentLogs) => {
        const activeMedIds = new Set(currentMeds.map(m => m._id));
        const now = new Date();

        // 🛑 FIX 1: Don't hide orphan logs if they are in the PAST
        const validLogs = currentLogs.filter(log => {
            // 1. If user interacted (Taken/Missed), KEEP IT (History)
            if (log.status !== 'pending') return true;
            
            // 2. If Medicine exists, KEEP IT
            const medId = log.medicineId?._id || log.medicineId;
            if (activeMedIds.has(medId)) return true;

            // 3. If Medicine is DELETED, check time
            // If the log time is in the PAST, KEEP IT (It's an unclicked history item)
            // If the log time is in the FUTURE, REMOVE IT (It's a ghost plan)
            const logDate = new Date(log.date);
            const [hours, minutes] = log.time.split(':').map(Number);
            logDate.setHours(hours, minutes, 0, 0);
            
            return logDate <= now; 
        });

        const updatedLogs = [...validLogs];
        const logMap = new Set();
        
        validLogs.forEach(log => {
            const medId = log.medicineId?._id || log.medicineId;
            const dateStr = new Date(log.date).toISOString().split('T')[0];
            const timeStr = log.time?.split(':').slice(0, 2).join(':') || ''; 
            logMap.add(`${medId}-${dateStr}-${timeStr}`);
        });

        for (const med of currentMeds) {
            if (med.isPaused || !med.isActive) continue;
            const medId = med._id;
            const schedules = getScheduledTimesForMedicine(med, 7); 

            for (const schedule of schedules) {
                const mapKey = `${medId}-${schedule.dateStr}-${schedule.timeStr}`;
                if (!logMap.has(mapKey)) {
                    const tempLogId = `log_gen_${Date.now()}_${Math.random()}`; 
                    updatedLogs.push({
                        _id: tempLogId,
                        medicineId: { _id: medId, name: med.name },
                        status: 'pending',
                        date: schedule.time.toISOString(), 
                        time: schedule.timeStr,
                        pendingSync: true,
                        clientLogId: tempLogId,
                        medicineClientId: med.clientId || medId
                    });
                    logMap.add(mapKey); 
                }
            }
        }
        return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    // 🛑 FIX 2: Upload orphan logs if they are in the PAST
    const queuePastPendingLogs = (allLogs, activeMedicines) => {
        let queue = getQueue();
        let queueModified = false;
        
        allLogs.forEach(log => {
            if (!log._id.toString().startsWith('log_')) return;
            if (!log.pendingSync) return;

            // Strict Time Check: Only upload if "Due"
            if (!isLogDueForUpload(log)) return;

            // Duplicate Check
            const alreadyQueued = queue.some(q => 
                q.action === 'CREATE_LOG' && 
                (q.data.clientLogId === log.clientLogId || q.data.tempLogId === log._id)
            );

            if (!alreadyQueued) {
                const medClientId = log.medicineClientId || (log.medicineId?._id || log.medicineId);
                queue.push({
                    action: 'CREATE_LOG',
                    data: {
                        clientLogId: log.clientLogId || log._id,
                        medicineClientId: medClientId,
                        status: log.status,
                        date: log.date,
                        time: log.time,
                        tempLogId: log._id
                    }
                });
                queueModified = true;
            }
        });

        if (queueModified) {
            saveQueue(queue);
            Network.getStatus().then(status => {
                if (status.connected) syncOfflineData();
            });
        }
    };

    // --- 1. LOAD DATA ---
    const loadData = async (onlyCache = false) => {
        let cachedMeds = getCachedMedicines();
        let cachedLogs = getCachedLogs();
        
        let finalLogs = generatePendingLogs(cachedMeds, cachedLogs);
        queuePastPendingLogs(finalLogs, cachedMeds);

        if (onlyCache || cachedMeds.length > 0) {
            setMedicines(cachedMeds);
            setLogs(finalLogs);
            setLoading(false);
            if (onlyCache) return;
        }

        const status = await Network.getStatus();
        if (status.connected && token) {
            try {
                const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
                const serverMedicines = resMeds.data.medicines;
                
                let serverLogs = [];
                try {
                    const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
                    serverLogs = resLogs.data.logs || [];
                } catch(e) { /* ignore */ }

                const serverClientIds = new Set(serverMedicines.map(m => m.clientId).filter(Boolean));
                const localTempMeds = cachedMeds.filter(localM => {
                    const isTemp = localM._id.toString().startsWith('temp_');
                    const isAlreadyOnServer = serverClientIds.has(localM._id);
                    return isTemp && !isAlreadyOnServer;
                });

                const mergedMeds = [...localTempMeds, ...serverMedicines]
                    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                
                const mergedLogsMap = new Map();
                serverLogs.forEach(log => mergedLogsMap.set(log._id, log));

                cachedLogs.forEach(localLog => {
                    const isLocal = localLog._id.toString().startsWith('log_') || localLog.pendingSync === true;
                    if (isLocal && !mergedLogsMap.has(localLog._id)) {
                        mergedLogsMap.set(localLog._id, localLog);
                    }
                });

                const uniqueLogs = Array.from(mergedLogsMap.values());
                finalLogs = generatePendingLogs(mergedMeds, uniqueLogs); 
                queuePastPendingLogs(finalLogs, mergedMeds);

                setMedicines(mergedMeds);
                saveMedicinesToCache(mergedMeds);
                setLogs(finalLogs);
                saveLogsToCache(finalLogs);

                const now = new Date().toISOString();
                setLastSyncTime(now);
                localStorage.setItem('last_sync_time', now);
                setLoading(false);

            } catch (e) { console.log("Using offline cache."); }
        } else {
            setLoading(false);
        }
    };

    // --- 2. ADD MEDICINE ---
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
                duration: medicineData.duration || { startDate: new Date(), endDate: new Date() },
                isMuted: false, 
                isPaused: false,
                isActive: true 
            };

            const currentCache = getCachedMedicines();
            const newMedList = [newMedicine, ...currentCache]; 
            saveMedicinesToCache(newMedList);
            setMedicines(newMedList); 
            
            const currentLogs = getCachedLogs();
            const newGeneratedLogs = generatePendingLogs([newMedicine], []);
            const updatedLogs = [...currentLogs, ...newGeneratedLogs];
            
            saveLogsToCache(updatedLogs);
            setLogs(updatedLogs); 

            queuePastPendingLogs(updatedLogs, newMedList);

            triggerGlobalUpdate();
            await scheduleMedicineReminder(newMedicine);
            addToQueue('ADD', { ...newMedicine }); 

            const status = await Network.getStatus();
            if (status.connected) syncOfflineData(); 

            return { success: true };
        } finally {
            isAddingRef.current = false;
        }
    };

    // --- 3. UPDATE MEDICINE ---
    const updateMedicine = async (id, medicineData) => {
        const currentCache = getCachedMedicines();
        const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
        saveMedicinesToCache(newList);
        setMedicines(newList);
        
        const currentLogs = getCachedLogs();
        const finalLogs = generatePendingLogs(newList, currentLogs);
        setLogs(finalLogs);
        saveLogsToCache(finalLogs);
        
        queuePastPendingLogs(finalLogs, newList);
        
        triggerGlobalUpdate();

        const updatedMed = newList.find(m => m._id === id);
        if(updatedMed && !updatedMed.isPaused) {
            await scheduleMedicineReminder(updatedMed);
        }

        if (id.toString().startsWith('temp_')) {
            let queue = getQueue();
            const existingAddIndex = queue.findIndex(q => q.action === 'ADD' && q.data._id === id);
            if (existingAddIndex !== -1) {
                queue[existingAddIndex].data = { ...queue[existingAddIndex].data, ...medicineData };
                saveQueue(queue);
                return { success: true };
            }
        }

        addToQueue('UPDATE', { id, medicineData });
        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();
        return { success: true };
    };

    // --- 4. DELETE MEDICINE ---
    const deleteMedicine = async (id) => {
        await cancelMedicineReminders(id);

        const currentCache = getCachedMedicines();
        const newList = currentCache.filter(m => m._id !== id);
        saveMedicinesToCache(newList);
        setMedicines(newList);

        // 🛑 Filter OUT future logs, KEEP past logs
        setLogs(prevLogs => {
            const now = new Date();
            const cleanLogs = prevLogs.filter(log => {
                const logMedId = typeof log.medicineId === 'object' && log.medicineId !== null 
                    ? log.medicineId._id 
                    : log.medicineId;
                
                if (String(logMedId) !== String(id)) return true;

                // Keep if Past (History) - EVEN IF PENDING
                const logDate = new Date(log.date);
                const [hours, minutes] = log.time.split(':').map(Number);
                logDate.setHours(hours, minutes, 0, 0);
                return logDate <= now;
            });
            return cleanLogs;
        });

        triggerGlobalUpdate();

        let queue = getQueue();
        queue = queue.filter(q => {
             const dataId = q.data._id || q.data.medicineClientId || q.data.medicineId;
             return String(dataId) !== String(id);
        });

        if (!id.toString().startsWith('temp_')) {
            queue.unshift({ action: 'DELETE', data: { id } });
        }
        saveQueue(queue);

        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();
        return { success: true };
    };

    // --- 5. MANUAL LOG ---
    const addManualLog = async (medicineId, statusVal, medicineName) => {
        const now = new Date();
        const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const nowDayStr = now.toISOString().split('T')[0];
        
        const currentLogs = getCachedLogs();
        
        let med = medicines.find(m => m._id === medicineId);
        if (!med && medicineName) med = medicines.find(m => m.name === medicineName);
        if (med && med.isPaused) return { success: false, message: "Medicine is paused." };

        const finalName = med?.name || medicineName || 'Unknown Medicine';
        const finalMedId = med?._id || medicineId;
        const finalClientId = med?.clientId || med?._id || medicineId;

        const targetLogIndex = currentLogs.findIndex(log => 
            (log.medicineId?._id === finalMedId || log.medicineId === finalMedId) && 
            new Date(log.date).toISOString().split('T')[0] === nowDayStr && 
            log.time === nowTimeStr 
        );
        
        let logToUpdate = null;
        if (targetLogIndex !== -1) {
            logToUpdate = currentLogs[targetLogIndex];
        } else {
             logToUpdate = {
                 _id: `log_manual_${Date.now()}`,
                 clientLogId: `log_manual_${Date.now()}`,
                 medicineId: { _id: finalMedId, name: finalName }, 
                 medicineClientId: finalClientId,
                 status: 'pending', 
                 date: now.toISOString(),
                 time: nowTimeStr,
                 pendingSync: true
             };
             if(targetLogIndex === -1) currentLogs.unshift(logToUpdate);
        }

        const updatedLogs = currentLogs.map(log => 
            log._id === logToUpdate._id ? 
            { ...log, status: statusVal, pendingSync: true } : log
        );

        saveLogsToCache(updatedLogs);
        setLogs(updatedLogs); 
        triggerGlobalUpdate();
        
        if (logToUpdate._id.toString().startsWith('log_')) { 
             addToQueue('CREATE_LOG', {
                 clientLogId: logToUpdate.clientLogId || logToUpdate._id,
                 medicineClientId: finalClientId,
                 status: statusVal,
                 date: logToUpdate.date,
                 time: logToUpdate.time,
                 tempLogId: logToUpdate._id 
             });
        } else { 
             addToQueue('UPDATE_LOG', { logId: logToUpdate._id, status: statusVal });
        }

        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();

        return { success: true };
    };

    // --- 6. UPDATE LOG STATUS ---
    const updateLogStatus = async (logId, statusVal) => {
        const currentLogs = getCachedLogs();
        const logToUpdate = currentLogs.find(log => log._id === logId);

        if (!logToUpdate) {
            loadData(false);
            return { success: false, message: "Log not found." };
        }
        
        const updatedLogs = currentLogs.map(log => 
            log._id === logId ? { ...log, status: statusVal, pendingSync: true } : log
        );

        saveLogsToCache(updatedLogs);
        setLogs(updatedLogs);
        triggerGlobalUpdate();
        
        if (logToUpdate._id.toString().startsWith('log_')) { 
            let queue = getQueue();
            const existingCreateLogIndex = queue.findIndex(q => 
                q.action === 'CREATE_LOG' && (q.data.clientLogId === logId || q.data.tempLogId === logId)
            );

            if (existingCreateLogIndex !== -1) {
                queue[existingCreateLogIndex].data.status = statusVal;
                saveQueue(queue);
            } else {
                addToQueue('CREATE_LOG', {
                     clientLogId: logToUpdate.clientLogId || logToUpdate._id,
                     medicineClientId: logToUpdate.medicineClientId || logToUpdate.medicineId._id,
                     status: statusVal,
                     date: logToUpdate.date,
                     time: logToUpdate.time,
                     tempLogId: logToUpdate._id 
                });
            }
        } else { 
            addToQueue('UPDATE_LOG', { logId: logToUpdate._id, status: statusVal });
        }

        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();

        return { success: true };
    };

    const toggleMuteMedicine = async (id) => {
        const currentCache = getCachedMedicines();
        const med = currentCache.find(m => m._id === id);
        if (!med) return;

        const newMuteStatus = !med.isMuted;
        const updatedMeds = currentCache.map(m => m._id === id ? { ...m, isMuted: newMuteStatus } : m);
        saveMedicinesToCache(updatedMeds);
        setMedicines(updatedMeds);
        triggerGlobalUpdate();

        const medToUpdate = updatedMeds.find(m => m._id === id);
        if (medToUpdate && !medToUpdate.isPaused) {
            await scheduleMedicineReminder(medToUpdate);
        }

        if (id.toString().startsWith('temp_')) {
            let queue = getQueue();
            const idx = queue.findIndex(q => q.data._id === id && (q.action === 'ADD' || q.action === 'UPDATE'));
            if (idx !== -1) {
                queue[idx].data.isMuted = newMuteStatus;
                saveQueue(queue);
                return { success: true };
            }
        }

        addToQueue('UPDATE', { id, medicineData: { isMuted: newMuteStatus } });
        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();
        return { success: true };
    };

    const togglePauseMedicine = async (id, extendDuration = false) => {
        const currentCache = getCachedMedicines();
        const med = currentCache.find(m => m._id === id);
        if (!med) return;

        const isPausing = !med.isPaused;
        let updatePayload = { isPaused: isPausing };

        if (isPausing) {
            updatePayload.pausedDate = new Date().toISOString();
            await cancelMedicineReminders(id);
        } else {
            if (extendDuration && med.pausedDate) {
                const pausedTime = new Date().getTime() - new Date(med.pausedDate).getTime();
                const oldEndDate = new Date(med.duration.endDate).getTime();
                const newEndDate = new Date(oldEndDate + pausedTime).toISOString();
                updatePayload.duration = { ...med.duration, endDate: newEndDate };
                updatePayload.pausedDate = null; 
            } else {
                updatePayload.pausedDate = null;
            }
        }

        const updatedMeds = currentCache.map(m => m._id === id ? { ...m, ...updatePayload } : m);
        saveMedicinesToCache(updatedMeds);
        setMedicines(updatedMeds);
        
        const currentLogs = getCachedLogs();
        const finalLogs = generatePendingLogs(updatedMeds, currentLogs);
        setLogs(finalLogs);
        saveLogsToCache(finalLogs);

        triggerGlobalUpdate();
        if (!isPausing) {
            const medToUpdate = updatedMeds.find(m => m._id === id);
            await scheduleMedicineReminder(medToUpdate);
        }

        if (id.toString().startsWith('temp_')) {
            let queue = getQueue();
            const idx = queue.findIndex(q => q.data._id === id && q.action === 'ADD');
            if (idx !== -1) {
                queue[idx].data = { ...queue[idx].data, ...updatePayload };
                saveQueue(queue);
                return { success: true };
            }
        }
        addToQueue('UPDATE', { id, medicineData: updatePayload });
        const status = await Network.getStatus();
        if (status.connected) syncOfflineData();
        return { success: true };
    };

    const handleNotificationAction = async (medicineId, actionId, medicineName) => {
        let statusVal;
        switch (actionId) {
            case 'taken_action': statusVal = 'taken'; break;
            case 'skip_action': statusVal = 'skipped'; break;
            default: return;
        }
        await addManualLog(medicineId, statusVal, medicineName);
    };

    const swapIdInCache = async (tempId, realMedicine) => {
        const realId = realMedicine._id;
        const currentMeds = getCachedMedicines();
        const swappedMeds = currentMeds.map(m => m._id === tempId ? realMedicine : m);
        saveMedicinesToCache(swappedMeds);
        setMedicines(swappedMeds);

        const currentLogs = getCachedLogs();
        const swappedLogs = currentLogs.map(log => {
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
        loadData(false);
    };

    // --- 9. SYNC FUNCTION ---
    const syncOfflineData = async () => {
        if (isSyncingGlobal) return;
        const status = await Network.getStatus();
        if (!status.connected) return;

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
                            await swapIdInCache(item.data._id, res.data.medicine);
                        }
                    } 
                    else if (item.action === 'CREATE_LOG') {
                        if (isLogDueForUpload(item.data)) {
                             const res = await axios.post(`${API_BASE_URL}/medicines/logs`, item.data, { headers: { Authorization: `Bearer ${token}` } });
                             if (res.status === 200 || res.status === 201) {
                                 success = true;
                                 const realLog = res.data.log;
                                 const currentLogs = getCachedLogs();
                                 const syncedLogs = currentLogs.map(l => l._id === item.data.tempLogId ? { ...l, _id: realLog._id, pendingSync: false } : l);
                                 saveLogsToCache(syncedLogs);
                                 setLogs(syncedLogs);
                             }
                        } else {
                            success = true; // Future log: remove from queue
                        }
                    }
                    else if (item.action === 'UPDATE_LOG') {
                         try {
                             await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
                             success = true;
                         } catch (updateError) {
                             if (updateError.response?.status === 404) success = true; 
                             else throw updateError;
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

                } catch (e) { 
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
        medicines, logs, loading, lastSyncTime, 
        fetchMedicines: loadData, fetchFullHistory,
        addMedicine, updateMedicine, deleteMedicine, toggleMuteMedicine, togglePauseMedicine,
        handleNotificationAction, addManualLog, updateLogStatus, syncOfflineData, fetchLogs 
    };
};










//only history bug
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

// // 🛑 HELPER: Calculate Schedule (Now generates 7 days of future logs)
// const getScheduledTimesForMedicine = (medicine, days = 7) => {
//     const schedules = [];
//     if (!medicine.times || medicine.times.length === 0) return schedules;
//     const today = new Date(); 
//     today.setHours(0, 0, 0, 0);
    
//     // Default to far future if no end date
//     const endDate = new Date(medicine.duration?.endDate || '2100-01-01'); 
//     endDate.setHours(23, 59, 59, 999);

//     for (let day = 0; day < days; day++) {
//         const checkDate = new Date(today); 
//         checkDate.setDate(today.getDate() + day);
        
//         if (checkDate > endDate) break;
        
//         // Strict start date check
//         const startDate = new Date(medicine.duration?.startDate || today);
//         startDate.setHours(0,0,0,0);
        
//         // Skip days before start date
//         if (checkDate < startDate) continue;

//         for (const timeStr of medicine.times) {
//             const [hours, minutes] = timeStr.split(':').map(Number);
//             const scheduleTime = new Date(checkDate); 
//             scheduleTime.setHours(hours, minutes, 0, 0);
            
//             // Only add if within duration
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

// // 🛑 HELPER: Check if a log is in the Past/Present (Safe to Sync)
// const isLogDueForUpload = (log) => {
//     // 1. If user interacted (Taken/Skipped), always sync
//     if (log.status !== 'pending') return true;

//     // 2. If Pending, check strict time
//     const now = new Date();
//     const logDate = new Date(log.date);
//     const [hours, minutes] = log.time.split(':').map(Number);
//     logDate.setHours(hours, minutes, 0, 0);

//     // Return TRUE if time has passed (e.g., Log 9:00 AM, Now 1:00 PM)
//     return logDate <= now;
// };

// export const useMedicines = () => {
//     const [medicines, setMedicines] = useState([]);
//     const [logs, setLogs] = useState([]); 
//     const [loading, setLoading] = useState(true);
//     const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('last_sync_time'));
    
//     const { token, API_BASE_URL } = useAuth();
//     const isAddingRef = useRef(false);

//     useEffect(() => {
//         loadData(true); // Load cache immediately

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
    
//     // --- GENERATE MISSING LOGS (Schedule Builder) ---
//     const generatePendingLogs = (currentMeds, currentLogs) => {
//         // Start with existing logs (History + Manual)
//         const updatedLogs = [...currentLogs];
//         const logMap = new Set();
        
//         // Map existing logs to avoid duplicates
//         currentLogs.forEach(log => {
//             const medId = log.medicineId?._id || log.medicineId;
//             const dateStr = new Date(log.date).toISOString().split('T')[0];
//             const timeStr = log.time?.split(':').slice(0, 2).join(':') || ''; 
//             logMap.add(`${medId}-${dateStr}-${timeStr}`);
//         });

//         // Loop through ACTIVE medicines to generate future schedule
//         for (const med of currentMeds) {
//             if (med.isPaused || !med.isActive) continue;

//             const medId = med._id;
//             // Generate schedule for next 7 days
//             const schedules = getScheduledTimesForMedicine(med, 7); 

//             for (const schedule of schedules) {
//                 const mapKey = `${medId}-${schedule.dateStr}-${schedule.timeStr}`;

//                 // If this slot is missing, CREATE IT (Pending)
//                 if (!logMap.has(mapKey)) {
//                     const tempLogId = `log_gen_${Date.now()}_${Math.random()}`; 
//                     const newLogEntry = {
//                         _id: tempLogId,
//                         medicineId: { _id: medId, name: med.name },
//                         status: 'pending',
//                         date: schedule.time.toISOString(), 
//                         time: schedule.timeStr,
//                         pendingSync: true, // Mark as needing sync (scanner will decide when)
//                         clientLogId: tempLogId,
//                         medicineClientId: med.clientId || medId
//                     };
//                     updatedLogs.push(newLogEntry);
//                     logMap.add(mapKey); 
//                 }
//             }
//         }
//         return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
//     };

//     // 🛑 NEW: AUTO-QUEUE SCANNER
//     const queuePastPendingLogs = (allLogs) => {
//         let queue = getQueue();
//         let queueModified = false;

//         allLogs.forEach(log => {
//             // Only auto-queue if it's a LOCAL log and marked for sync
//             if (!log._id.toString().startsWith('log_')) return;
//             if (!log.pendingSync) return;

//             // Only queue if the time has PASSED (Due for upload)
//             if (!isLogDueForUpload(log)) return;

//             // Avoid duplicate queue entries
//             const alreadyQueued = queue.some(q => 
//                 q.action === 'CREATE_LOG' && 
//                 (q.data.clientLogId === log.clientLogId || q.data.tempLogId === log._id)
//             );

//             if (!alreadyQueued) {
//                 const medClientId = log.medicineClientId || (typeof log.medicineId === 'object' ? log.medicineId._id : log.medicineId);

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

//     // --- 1. LOAD DATA ---
//     const loadData = async (onlyCache = false) => {
//         let cachedMeds = getCachedMedicines();
//         let cachedLogs = getCachedLogs();
        
//         // 1. Initial Local Generation (Shows future logs instantly)
//         let finalLogs = generatePendingLogs(cachedMeds, cachedLogs);
        
//         // 2. Trigger Scanner (Uploads past pending logs)
//         queuePastPendingLogs(finalLogs);

//         if (onlyCache || cachedMeds.length > 0) {
//             setMedicines(cachedMeds);
//             setLogs(finalLogs);
//             setLoading(false);
//             if (onlyCache) return;
//         }

//         const status = await Network.getStatus();
//         if (status.connected && token) {
//             try {
//                 const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
//                 const serverMedicines = resMeds.data.medicines;
                
//                 let serverLogs = [];
//                 try {
//                     const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
//                     serverLogs = resLogs.data.logs || [];
//                 } catch(e) { /* ignore */ }

//                 // 3. Merge Medicines (Fix Duplicates)
//                 const serverClientIds = new Set(serverMedicines.map(m => m.clientId).filter(Boolean));
//                 const localTempMeds = cachedMeds.filter(localM => {
//                     const isTemp = localM._id.toString().startsWith('temp_');
//                     const isAlreadyOnServer = serverClientIds.has(localM._id);
//                     return isTemp && !isAlreadyOnServer;
//                 });

//                 const mergedMeds = [...localTempMeds, ...serverMedicines]
//                     .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                
//                 // 4. Merge Logs
//                 const mergedLogsMap = new Map();
//                 serverLogs.forEach(log => mergedLogsMap.set(log._id, log));

//                 cachedLogs.forEach(localLog => {
//                     const isLocal = localLog._id.toString().startsWith('log_') || localLog.pendingSync === true;
//                     // Keep local if it's pending upload OR not on server yet
//                     if (isLocal && !mergedLogsMap.has(localLog._id)) {
//                         mergedLogsMap.set(localLog._id, localLog);
//                     }
//                 });

//                 const uniqueLogs = Array.from(mergedLogsMap.values());
                
//                 // 5. RE-GENERATE SCHEDULE based on merged data
//                 // This ensures new future logs appear for server medicines too
//                 finalLogs = generatePendingLogs(mergedMeds, uniqueLogs); 
                
//                 // 6. Trigger Scanner Again
//                 queuePastPendingLogs(finalLogs);

//                 setMedicines(mergedMeds);
//                 saveMedicinesToCache(mergedMeds);
//                 setLogs(finalLogs);
//                 saveLogsToCache(finalLogs);

//                 const now = new Date().toISOString();
//                 setLastSyncTime(now);
//                 localStorage.setItem('last_sync_time', now);
//                 setLoading(false);

//             } catch (e) { console.log("Using offline cache."); }
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
            
//             // Generate logs instantly
//             const currentLogs = getCachedLogs();
//             const newGeneratedLogs = generatePendingLogs([newMedicine], []);
//             const updatedLogs = [...currentLogs, ...newGeneratedLogs];
            
//             saveLogsToCache(updatedLogs);
//             setLogs(updatedLogs); 

//             queuePastPendingLogs(updatedLogs);
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

//     // --- 3. UPDATE MEDICINE ---
//     const updateMedicine = async (id, medicineData) => {
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
        
//         // Re-generate logs
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

//     // --- 4. DELETE MEDICINE ---
//     const deleteMedicine = async (id) => {
//         await cancelMedicineReminders(id);

//         const currentCache = getCachedMedicines();
//         const newList = currentCache.filter(m => m._id !== id);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);

//         // 🛑 Filter OUT future logs, KEEP past logs
//         setLogs(prevLogs => {
//             const now = new Date();
//             const cleanLogs = prevLogs.filter(log => {
//                 const logMedId = typeof log.medicineId === 'object' && log.medicineId !== null 
//                     ? log.medicineId._id 
//                     : log.medicineId;
                
//                 if (String(logMedId) !== String(id)) return true;

//                 // Keep if Past (History)
//                 const logDate = new Date(log.date);
//                 const [hours, minutes] = log.time.split(':').map(Number);
//                 logDate.setHours(hours, minutes, 0, 0);
//                 return logDate <= now;
//             });
//             return cleanLogs;
//         });

//         triggerGlobalUpdate();

//         let queue = getQueue();
//         queue = queue.filter(q => {
//              const dataId = q.data._id || q.data.medicineClientId || q.data.medicineId;
//              return String(dataId) !== String(id);
//         });

//         if (!id.toString().startsWith('temp_')) {
//             queue.unshift({ action: 'DELETE', data: { id } });
//         }
//         saveQueue(queue);

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

//     const toggleMuteMedicine = async (id) => { /*...same...*/ }; 
//     // (You can copy the previous toggleMuteMedicine logic here if needed, it was correct)

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
//                 const pausedTime = new Date().getTime() - new Date(med.pausedDate).getTime();
//                 const oldEndDate = new Date(med.duration.endDate).getTime();
//                 const newEndDate = new Date(oldEndDate + pausedTime).toISOString();
//                 updatePayload.duration = { ...med.duration, endDate: newEndDate };
//                 updatePayload.pausedDate = null; 
//             } else {
//                 updatePayload.pausedDate = null;
//             }
//         }

//         const updatedMeds = currentCache.map(m => m._id === id ? { ...m, ...updatePayload } : m);
//         saveMedicinesToCache(updatedMeds);
//         setMedicines(updatedMeds);
        
//         // Regenerate logs to reflect pause status
//         const currentLogs = getCachedLogs();
//         const finalLogs = generatePendingLogs(updatedMeds, currentLogs);
//         setLogs(finalLogs);
//         saveLogsToCache(finalLogs);

//         triggerGlobalUpdate();
//         if (!isPausing) {
//             const medToUpdate = updatedMeds.find(m => m._id === id);
//             await scheduleMedicineReminder(medToUpdate);
//         }

//         if (id.toString().startsWith('temp_')) {
//             let queue = getQueue();
//             const idx = queue.findIndex(q => q.data._id === id && q.action === 'ADD');
//             if (idx !== -1) {
//                 queue[idx].data = { ...queue[idx].data, ...updatePayload };
//                 saveQueue(queue);
//                 return { success: true };
//             }
//         }
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

//     const swapIdInCache = async (tempId, realMedicine) => {
//         const realId = realMedicine._id;
//         const currentMeds = getCachedMedicines();
//         const swappedMeds = currentMeds.map(m => m._id === tempId ? realMedicine : m);
//         saveMedicinesToCache(swappedMeds);
//         setMedicines(swappedMeds);

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
//         loadData(false);
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
//                         // 🛑 TIME BARRIER CHECK
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
//                             success = true; // Future log: remove from queue, scanner will re-add later
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
//         medicines, logs, loading, lastSyncTime, 
//         fetchMedicines: loadData, fetchFullHistory,
//         addMedicine, updateMedicine, deleteMedicine, toggleMuteMedicine, togglePauseMedicine,
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

// // Helper to find next schedules (Required for log generation)
// const getScheduledTimesForMedicine = (medicine, days = 2) => {
//     const schedules = [];
//     if (!medicine.times || medicine.times.length === 0) return schedules;
//     const today = new Date(); 
//     today.setHours(0, 0, 0, 0);
    
//     // Default to far future if no end date
//     const endDate = new Date(medicine.duration?.endDate || '2100-01-01'); 
//     endDate.setHours(23, 59, 59, 999);

//     for (let day = 0; day < days; day++) {
//         const checkDate = new Date(today); 
//         checkDate.setDate(today.getDate() + day);
        
//         if (checkDate > endDate) break;
        
//         // Strict start date check
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

// export const useMedicines = () => {
//     const [medicines, setMedicines] = useState([]);
//     const [logs, setLogs] = useState([]); 
//     const [loading, setLoading] = useState(true);
//     const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('last_sync_time'));
    
//     const { token, API_BASE_URL } = useAuth();
//     const isAddingRef = useRef(false);

//     useEffect(() => {
//         loadData(true); // Load cache immediately

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
    
//     // --- GENERATE MISSING LOGS ---
//     const generatePendingLogs = (currentMeds, currentLogs) => {
//         const updatedLogs = [...currentLogs];
//         const logMap = new Set();
        
//         currentLogs.forEach(log => {
//             const medId = log.medicineId?._id || log.medicineId;
//             const dateStr = new Date(log.date).toISOString().split('T')[0];
//             const timeStr = log.time?.split(':').slice(0, 2).join(':') || ''; 
//             logMap.add(`${medId}-${dateStr}-${timeStr}`);
//         });

//         for (const med of currentMeds) {
//             if (med.isPaused || !med.isActive) continue;

//             const medId = med._id;
//             const schedules = getScheduledTimesForMedicine(med, 2); 

//             for (const schedule of schedules) {
//                 const mapKey = `${medId}-${schedule.dateStr}-${schedule.timeStr}`;

//                 if (!logMap.has(mapKey)) {
//                     const tempLogId = `log_gen_${Date.now()}_${Math.random()}`; 
//                     const newLogEntry = {
//                         _id: tempLogId,
//                         medicineId: { _id: medId, name: med.name },
//                         status: 'pending',
//                         date: schedule.time.toISOString(), 
//                         time: schedule.timeStr,
//                         pendingSync: medId.toString().startsWith('temp_') ? true : false,
//                         clientLogId: tempLogId,
//                         medicineClientId: med.clientId || medId
//                     };
//                     updatedLogs.push(newLogEntry);
//                     logMap.add(mapKey); 
//                 }
//             }
//         }
//         return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
//     };

//     // --- 1. LOAD DATA ---
//     const loadData = async (onlyCache = false) => {
//         let cachedMeds = getCachedMedicines();
//         // Sort by creation time (newest first)
//         const sortedMeds = cachedMeds.sort((a, b) => {
//             const dateA = new Date(a.createdAt || 0).getTime();
//             const dateB = new Date(b.createdAt || 0).getTime();
//             return dateB - dateA;
//         });
        
//         let cachedLogs = getCachedLogs();
        
//         // Initial Generate locally
//         let finalLogs = generatePendingLogs(sortedMeds, cachedLogs);

//         setMedicines(sortedMeds);
//         setLogs(finalLogs);
        
//         // 🔥 Show data immediately if we have cache
//         if (sortedMeds.length > 0) setLoading(false); 
        
//         if (!onlyCache) saveLogsToCache(finalLogs); 
//         if (onlyCache) return; 

//         const status = await Network.getStatus();
//         if (status.connected && token) {
//             try {
//                 const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
//                 const serverMedicines = resMeds.data.medicines;
                
//                 let serverLogs = [];
//                 try {
//                     const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
//                     serverLogs = resLogs.data.logs || [];
//                 } catch(e) { /* ignore */ }

//                 // Merge Medicines (Keep local temps)
//                 const localTempMeds = sortedMeds.filter(localM => {
//                     if (!localM._id.toString().startsWith('temp_')) return false;
//                     const alreadySynced = serverMedicines.some(serverM => serverM.clientId === localM._id);
//                     return !alreadySynced;
//                 });

//                 const mergedMeds = [...localTempMeds, ...serverMedicines]
//                     .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                
//                 // Merge Logs
//                 const mergedLogsMap = new Map();
//                 serverLogs.forEach(log => mergedLogsMap.set(log._id, log));

//                 cachedLogs.forEach(localLog => {
//                     if (localLog._id.toString().startsWith('log_') || localLog.pendingSync === true) {
//                         mergedLogsMap.set(localLog._id, localLog);
//                     }
//                 });

//                 const uniqueLogs = Array.from(mergedLogsMap.values());
//                 finalLogs = generatePendingLogs(mergedMeds, uniqueLogs); 

//                 setMedicines(mergedMeds);
//                 saveMedicinesToCache(mergedMeds);
//                 setLogs(finalLogs);
//                 saveLogsToCache(finalLogs);

//                 const now = new Date().toISOString();
//                 setLastSyncTime(now);
//                 localStorage.setItem('last_sync_time', now);

//                 setLoading(false);

//             } catch (e) { console.log("Using offline cache."); }
//         } else {
//             setLoading(false);
//         }
//     };

//     // --- 2. ADD MEDICINE (FIXED FOR INSTANT UPDATE) ---
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
//                 isActive: true // Ensure this is true
//             };

//             // 1. Save to Cache
//             const currentCache = getCachedMedicines();
//             const newMedList = [newMedicine, ...currentCache]; 
//             saveMedicinesToCache(newMedList);
            
//             // 2. Update React State INSTANTLY (Fixes Daily Goal Count)
//             setMedicines(newMedList); 
            
//             // 3. Generate Logs INSTANTLY (Fixes Today's Schedule List)
//             const currentLogs = getCachedLogs();
//             // Generate just for this new one to be fast
//             const newGeneratedLogs = generatePendingLogs([newMedicine], []);
//             const updatedLogs = [...currentLogs, ...newGeneratedLogs];
            
//             saveLogsToCache(updatedLogs);
//             setLogs(updatedLogs); // Update React State

//             // 4. Trigger Global Event & Schedule
//             triggerGlobalUpdate();
//             await scheduleMedicineReminder(newMedicine);
//             addToQueue('ADD', { ...newMedicine }); 

//             // 5. Try Sync (Only if Online)
//             const status = await Network.getStatus();
//             if (status.connected) {
//                  syncOfflineData(); 
//             } else {
//                 console.log("Offline: Medicine saved locally.");
//             }

//             return { success: true };
//         } finally {
//             isAddingRef.current = false;
//         }
//     };

//     // --- 3. UPDATE MEDICINE ---
//     const updateMedicine = async (id, medicineData) => {
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
        
//         // Re-generate logs in case time changed
//         const currentLogs = getCachedLogs();
//         const finalLogs = generatePendingLogs(newList, currentLogs);
//         setLogs(finalLogs);
//         saveLogsToCache(finalLogs);
        
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

//     // --- 4. DELETE MEDICINE ---
//     const deleteMedicine = async (id) => {
//         // 1. Cancel Notifications (Existing)
//         await cancelMedicineReminders(id);

//         // --- STEP 1: Remove from Medicine List (Existing) ---
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.filter(m => m._id !== id);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);

//        // --- 🛑 STEP 2: CORRECTED - Remove ONLY Future Logs (Matches Backend) ---
//     setLogs(prevLogs => {
//         const now = new Date();
        
//         const cleanLogs = prevLogs.filter(log => {
//             // 1. Get Log ID safely
//             const logMedId = typeof log.medicineId === 'object' && log.medicineId !== null 
//                 ? log.medicineId._id 
//                 : log.medicineId;
            
//             // 2. If it belongs to a DIFFERENT medicine, keep it.
//             if (String(logMedId) !== String(id)) {
//                 return true;
//             }

//             // 3. If it belongs to THIS medicine, check the time.
//             // We want to DELETE it only if it is in the FUTURE.
//             const logDate = new Date(log.date); // This is typically 00:00:00
//             const [hours, minutes] = log.time.split(':').map(Number);
//             logDate.setHours(hours, minutes, 0, 0);

//             // If log is in the past (History), KEEP it (return true).
//             // If log is in the future (Pending), DELETE it (return false).
//             return logDate <= now;
//         });
        
//         // Update Cache
//         // saveLogsToCache(cleanLogs); 
        
//         return cleanLogs;
//     });

//         triggerGlobalUpdate();

//         // --- STEP 3: Handle Offline Queue (Existing) ---
//         if (id.toString().startsWith('temp_')) {
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

//     // --- 5A. TOGGLE MUTE ---
//     const toggleMuteMedicine = async (id) => {
//         const currentCache = getCachedMedicines();
//         const med = currentCache.find(m => m._id === id);
//         if (!med) return;

//         const newMuteStatus = !med.isMuted;
//         const updatedMeds = currentCache.map(m => m._id === id ? { ...m, isMuted: newMuteStatus } : m);
//         saveMedicinesToCache(updatedMeds);
//         setMedicines(updatedMeds);
//         triggerGlobalUpdate();

//         const medToUpdate = updatedMeds.find(m => m._id === id);
//         if (medToUpdate && !medToUpdate.isPaused) {
//             await scheduleMedicineReminder(medToUpdate);
//         }

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

//     // --- 5B. TOGGLE PAUSE ---
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
//                 const pausedTime = new Date().getTime() - new Date(med.pausedDate).getTime();
//                 const oldEndDate = new Date(med.duration.endDate).getTime();
//                 const newEndDate = new Date(oldEndDate + pausedTime).toISOString();
//                 updatePayload.duration = { ...med.duration, endDate: newEndDate };
//                 updatePayload.pausedDate = null; 
//             } else {
//                 updatePayload.pausedDate = null;
//             }
//         }

//         const updatedMeds = currentCache.map(m => m._id === id ? { ...m, ...updatePayload } : m);
//         saveMedicinesToCache(updatedMeds);
//         setMedicines(updatedMeds);
//         triggerGlobalUpdate();

//         if (!isPausing) {
//             const medToUpdate = updatedMeds.find(m => m._id === id);
//             await scheduleMedicineReminder(medToUpdate);
//         }

//         if (id.toString().startsWith('temp_')) {
//             let queue = getQueue();
//             const idx = queue.findIndex(q => q.data._id === id && q.action === 'ADD');
//             if (idx !== -1) {
//                 queue[idx].data = { ...queue[idx].data, ...updatePayload };
//                 saveQueue(queue);
//                 return { success: true };
//             }
//         }

//         addToQueue('UPDATE', { id, medicineData: updatePayload });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
        
//         return { success: true };
//     };

//     // --- 6. LOGGING (Optimistic) ---
//     const addManualLog = async (medicineId, statusVal, medicineName) => {
//         const now = new Date();
//         const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
//         const nowDayStr = now.toISOString().split('T')[0];
        
//         const currentLogs = getCachedLogs();
        
//         // Find correct Medicine info
//         let med = medicines.find(m => m._id === medicineId);
//         if (!med && medicineName) med = medicines.find(m => m.name === medicineName);
//         if (med && med.isPaused) return { success: false, message: "Medicine is paused." };

//         const finalName = med?.name || medicineName || 'Unknown Medicine';
//         const finalMedId = med?._id || medicineId;
//         const finalClientId = med?.clientId || med?._id || medicineId;

//         // Optimistically update or create log
//         const targetLogIndex = currentLogs.findIndex(log => 
//             (log.medicineId?._id === finalMedId || log.medicineId === finalMedId) && 
//             log.status === 'pending' &&
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
//              // If manual entry and not in schedule, add to top
//              if(targetLogIndex === -1) currentLogs.unshift(logToUpdate);
//         }

//         const updatedLogs = currentLogs.map(log => 
//             log._id === logToUpdate._id ? 
//             { ...log, status: statusVal, pendingSync: true } : log
//         );

//         // ⚡ Update State INSTANTLY
//         saveLogsToCache(updatedLogs);
//         setLogs(updatedLogs); 
//         triggerGlobalUpdate();
        
//         // Queue Logic
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

//     // --- 7. NOTIFICATION ACTION ---
//     const handleNotificationAction = async (medicineId, actionId, medicineName) => {
//         let statusVal;
//         switch (actionId) {
//             case 'taken_action': statusVal = 'taken'; break;
//             case 'skip_action': statusVal = 'skipped'; break;
//             default: return;
//         }
//         await addManualLog(medicineId, statusVal, medicineName);
//     };

//     // --- 8. UPDATE LOG STATUS ---
//     const updateLogStatus = async (logId, statusVal) => {
//         const currentLogs = getCachedLogs();
//         const logToUpdate = currentLogs.find(log => log._id === logId);

//         if (!logToUpdate) {
//             loadData(false);
//             return { success: false, message: "Log not found." };
//         }
        
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

//     const swapIdInCache = async (tempId, realMedicine) => {
//         const realId = realMedicine._id;
//         const currentMeds = getCachedMedicines();
//         const swappedMeds = currentMeds.map(m => m._id === tempId ? realMedicine : m);
//         saveMedicinesToCache(swappedMeds);
//         setMedicines(swappedMeds);

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
//         loadData(false);
//     };

//     // --- 9. SYNC FUNCTION (Corrected) ---
//     const syncOfflineData = async () => {
//         if (isSyncingGlobal) return;

//         // 🛑 Strict Check before starting to prevent error logs
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
//                         const res = await axios.post(`${API_BASE_URL}/medicines/logs`, item.data, { headers: { Authorization: `Bearer ${token}` } });
//                         if (res.status === 200 || res.status === 201) {
//                             success = true;
//                             const realLog = res.data.log;
//                             const currentLogs = getCachedLogs();
//                             const syncedLogs = currentLogs.map(l => l._id === item.data.tempLogId ? { ...l, _id: realLog._id, pendingSync: false } : l);
//                             saveLogsToCache(syncedLogs);
//                             setLogs(syncedLogs);
//                         }
//                     }
//                     else if (item.action === 'UPDATE_LOG') {
//                          try {
//                              await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
//                              success = true;
//                          } catch (updateError) {
//                              if (updateError.response?.status === 404) {
//                                  // Handle 404 by recreating log (same as before)
//                                  const currentLogs = getCachedLogs();
//                                  const localLog = currentLogs.find(l => l._id === item.data.logId);
//                                  if (localLog) {
//                                      const createPayload = {
//                                          clientLogId: localLog.clientLogId || localLog._id, 
//                                          medicineClientId: localLog.medicineClientId || localLog.medicineId._id || localLog.medicineId,
//                                          status: item.data.status,
//                                          date: localLog.date,
//                                          time: localLog.time
//                                      };
//                                      const createRes = await axios.post(`${API_BASE_URL}/medicines/logs`, createPayload, { headers: { Authorization: `Bearer ${token}` } });
//                                      if (createRes.status === 200 || createRes.status === 201) {
//                                          success = true;
//                                          const newLogId = createRes.data.log._id;
//                                          const syncedLogs = currentLogs.map(l => l._id === item.data.logId ? { ...l, _id: newLogId, pendingSync: false } : l);
//                                          saveLogsToCache(syncedLogs);
//                                          setLogs(syncedLogs);
//                                      }
//                                  } else { success = true; } // Log gone locally too
//                              } else { throw updateError; }
//                          }
                         
//                          if (success) {
//                              const currentLogs = getCachedLogs();
//                              const updatedLogs = currentLogs.map(l => l._id === item.data.logId ? {...l, pendingSync: false} : l);
//                              saveLogsToCache(updatedLogs);
//                              setLogs(updatedLogs);
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
//                     if (e.response?.status === 404 && item.action !== 'CREATE_LOG' && item.action !== 'UPDATE_LOG') {
//                         success = true; // Item already gone on server
//                     }
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
//         medicines, logs, loading, lastSyncTime, 
//         fetchMedicines: loadData, fetchFullHistory,
//         addMedicine, updateMedicine, deleteMedicine, toggleMuteMedicine, togglePauseMedicine,
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

// // Helper to find next schedules
// const getScheduledTimesForMedicine = (medicine, days = 2) => {
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

//         for (const timeStr of medicine.times) {
//             const [hours, minutes] = timeStr.split(':').map(Number);
//             const scheduleTime = new Date(checkDate);
//             scheduleTime.setHours(hours, minutes, 0, 0);

//             if (scheduleTime <= endDate) {
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

// export const useMedicines = () => {
//     const [medicines, setMedicines] = useState([]);
//     const [logs, setLogs] = useState([]); 
//     const [loading, setLoading] = useState(true);
//     // 🔥 NEW: Initialize Sync Time from Local Storage
//     const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('last_sync_time'));
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
    
//     // --- GENERATE MISSING LOGS ---
//     const generatePendingLogs = (currentMeds, currentLogs) => {
//         const updatedLogs = [...currentLogs];
//         const logMap = new Set();
        
//         currentLogs.forEach(log => {
//             const medId = log.medicineId?._id || log.medicineId;
//             const dateStr = new Date(log.date).toISOString().split('T')[0];
//             const timeStr = log.time?.split(':').slice(0, 2).join(':') || ''; 
//             logMap.add(`${medId}-${dateStr}-${timeStr}`);
//         });

//         for (const med of currentMeds) {
//             // 🔥 PAUSE CHECK: Do not generate logs if paused
//             if (med.isPaused) continue;

//             const medId = med._id;
//             const schedules = getScheduledTimesForMedicine(med, 2); 

//             for (const schedule of schedules) {
//                 const mapKey = `${medId}-${schedule.dateStr}-${schedule.timeStr}`;

//                 if (!logMap.has(mapKey)) {
//                     const tempLogId = `log_gen_${Date.now()}_${Math.random()}`; 
//                     const newLogEntry = {
//                         _id: tempLogId,
//                         medicineId: { _id: medId, name: med.name },
//                         status: 'pending',
//                         date: schedule.time.toISOString(), 
//                         time: schedule.timeStr,
//                         pendingSync: medId.toString().startsWith('temp_') ? true : false,
//                         clientLogId: tempLogId,
//                         medicineClientId: med.clientId || medId
//                     };
//                     updatedLogs.push(newLogEntry);
//                     logMap.add(mapKey); 
//                 }
//             }
//         }
//         return updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
//     };

//     // --- 1. LOAD DATA ---
//     const loadData = async (onlyCache = false) => {
//         let cachedMeds = getCachedMedicines();
//         const sortedMeds = cachedMeds.sort((a, b) => {
//             const dateA = new Date(a.createdAt || 0).getTime();
//             const dateB = new Date(b.createdAt || 0).getTime();
//             return dateB - dateA;
//         });
        
//         let cachedLogs = getCachedLogs();
        
//         // Initial Generate locally
//         let finalLogs = generatePendingLogs(sortedMeds, cachedLogs);

//         setMedicines(sortedMeds);
//         setLogs(finalLogs);
//         setLoading(false);
//         if (!onlyCache) saveLogsToCache(finalLogs); 

// // 🔥 CRITICAL: If we have cached data, we are NOT loading anymore.
//         // This fixes the "Dashboard empty offline" bug.
//         if (cachedMeds.length > 0) setLoading(false);

//         if (onlyCache) return; 

//         const status = await Network.getStatus();
//         if (status.connected && token) {
//             try {
//                 const resMeds = await axios.get(`${API_BASE_URL}/medicines`, { headers: { Authorization: `Bearer ${token}` } });
//                 const serverMedicines = resMeds.data.medicines;
                
//                 let serverLogs = [];
//                 try {
//                     const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, { headers: { Authorization: `Bearer ${token}` } });
//                     serverLogs = resLogs.data.logs || [];
//                 } catch(e) { /* ignore */ }

//                 // Merge Medicines (Deduplication)
//                 const localTempMeds = sortedMeds.filter(localM => {
//                     if (!localM._id.toString().startsWith('temp_')) return false;
//                     const alreadySynced = serverMedicines.some(serverM => serverM.clientId === localM._id);
//                     return !alreadySynced;
//                 });

//                 const mergedMeds = [...localTempMeds, ...serverMedicines]
//                     .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                
//                 // Merge Logs
//                 const mergedLogsMap = new Map();
//                 serverLogs.forEach(log => mergedLogsMap.set(log._id, log));

//                 cachedLogs.forEach(localLog => {
//                     if (localLog._id.toString().startsWith('log_')) {
//                         mergedLogsMap.set(localLog._id, localLog);
//                     }
//                     else if (localLog.pendingSync === true) {
//                         mergedLogsMap.set(localLog._id, localLog);
//                     }
//                 });

//                 const uniqueLogs = Array.from(mergedLogsMap.values());
//                 finalLogs = generatePendingLogs(mergedMeds, uniqueLogs); 

//                 setMedicines(mergedMeds);
//                 saveMedicinesToCache(mergedMeds);
//                 setLogs(finalLogs);
//                 saveLogsToCache(finalLogs);

//                 // 🔥 UPDATE SYNC TIME
//                 const now = new Date().toISOString();
//                 setLastSyncTime(now);
//                 localStorage.setItem('last_sync_time', now);

//                 setLoading(false);

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
//                 clientId: tempId, 
//                 pendingSync: true,
//                 createdAt: new Date().toISOString(), 
//                 times: medicineData.times || [],
//                 duration: medicineData.duration || { startDate: new Date(), endDate: new Date() },
//                 isMuted: false, 
//                 isPaused: false 
//             };

//             const currentCache = getCachedMedicines();
//             const newList = [newMedicine, ...currentCache]; 
//             saveMedicinesToCache(newList);
//             setMedicines(newList); 
            
//             await loadData(true); 
//             await scheduleMedicineReminder(newMedicine);
//             addToQueue('ADD', { ...newMedicine }); 

//             const status = await Network.getStatus();
//             if (status.connected) {
//                  syncOfflineData(); 
//             } else {
//                 console.log("Offline: Medicine saved locally. Will sync later.");
//             }

//             return { success: true };
//         } finally {
//             isAddingRef.current = false;
//         }
//     };

//     // --- 3. UPDATE MEDICINE (Generic) ---
//     const updateMedicine = async (id, medicineData) => {
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
//         triggerGlobalUpdate();

//         // Reschedule alarms (unless paused)
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

//     // --- 4. DELETE MEDICINE ---
//     const deleteMedicine = async (id) => {
//         await cancelMedicineReminders(id);
//         const currentCache = getCachedMedicines();
//         const newList = currentCache.filter(m => m._id !== id);
//         saveMedicinesToCache(newList);
//         setMedicines(newList);
//         triggerGlobalUpdate();

//         if (id.toString().startsWith('temp_')) {
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

//     // --- 5A. TOGGLE MUTE (SILENT MODE) ---
//     const toggleMuteMedicine = async (id) => {
//         const currentCache = getCachedMedicines();
//         const med = currentCache.find(m => m._id === id);
//         if (!med) return;

//         const newMuteStatus = !med.isMuted;
        
//         // Update Local
//         const updatedMeds = currentCache.map(m => m._id === id ? { ...m, isMuted: newMuteStatus } : m);
//         saveMedicinesToCache(updatedMeds);
//         setMedicines(updatedMeds);
//         triggerGlobalUpdate();

//         // Reschedule (switches notification channel)
//         const medToUpdate = updatedMeds.find(m => m._id === id);
//         if (medToUpdate && !medToUpdate.isPaused) {
//             await scheduleMedicineReminder(medToUpdate);
//         }

//         // Queue Update
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

//     // --- 5B. TOGGLE PAUSE (TREATMENT SUSPENSION) ---
//     const togglePauseMedicine = async (id, extendDuration = false) => {
//         const currentCache = getCachedMedicines();
//         const med = currentCache.find(m => m._id === id);
//         if (!med) return;

//         const isPausing = !med.isPaused;
//         let updatePayload = { isPaused: isPausing };

//         if (isPausing) {
//             // ---> PAUSING (Works Offline)
//             updatePayload.pausedDate = new Date().toISOString();
//             await cancelMedicineReminders(id); // Stop alarms immediately
//         } else {
//             // ---> RESUMING
//             if (extendDuration && med.pausedDate) {
//                 const pausedTime = new Date().getTime() - new Date(med.pausedDate).getTime();
//                 const oldEndDate = new Date(med.duration.endDate).getTime();
//                 const newEndDate = new Date(oldEndDate + pausedTime).toISOString();
                
//                 updatePayload.duration = { ...med.duration, endDate: newEndDate };
//                 updatePayload.pausedDate = null; 
//             } else {
//                 updatePayload.pausedDate = null;
//             }
//         }

//         // Apply Local Update
//         const updatedMeds = currentCache.map(m => 
//             m._id === id ? { ...m, ...updatePayload } : m
//         );
//         saveMedicinesToCache(updatedMeds);
//         setMedicines(updatedMeds);
//         triggerGlobalUpdate();

//         // If resuming, re-schedule alarms
//         if (!isPausing) {
//             const medToUpdate = updatedMeds.find(m => m._id === id);
//             await scheduleMedicineReminder(medToUpdate);
//         }

//         // Queue Sync
//         if (id.toString().startsWith('temp_')) {
//             let queue = getQueue();
//             const idx = queue.findIndex(q => q.data._id === id && q.action === 'ADD');
//             if (idx !== -1) {
//                 queue[idx].data = { ...queue[idx].data, ...updatePayload };
//                 saveQueue(queue);
//                 return { success: true };
//             }
//         }

//         addToQueue('UPDATE', { id, medicineData: updatePayload });
//         const status = await Network.getStatus();
//         if (status.connected) syncOfflineData();
        
//         return { success: true };
//     };

//     // --- 6. LOGGING (Manual & Notification) ---
//     const addManualLog = async (medicineId, statusVal, medicineName) => {
//         const now = new Date();
//         const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
//         const nowDayStr = now.toISOString().split('T')[0];
        
//         const currentLogs = getCachedLogs();
        
//         // Find Medicine
//         let med = medicines.find(m => m._id === medicineId);
//         if (!med && medicineName) {
//             med = medicines.find(m => m.name === medicineName);
//         }
        
//         // Cannot log for paused medicine
//         if (med && med.isPaused) return { success: false, message: "Medicine is paused." };

//         const finalName = med?.name || medicineName || 'Unknown Medicine';
//         const finalMedId = med?._id || medicineId;
//         const finalClientId = med?.clientId || med?._id || medicineId;

//         const targetLogIndex = currentLogs.findIndex(log => 
//             (log.medicineId?._id === finalMedId || log.medicineId === finalMedId) && 
//             log.status === 'pending' &&
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

//     // --- 7. NOTIFICATION ACTION HANDLER ---
//     const handleNotificationAction = async (medicineId, actionId, medicineName) => {
//         let statusVal;
//         switch (actionId) {
//             case 'taken_action': statusVal = 'taken'; break;
//             case 'skip_action': statusVal = 'skipped'; break;
//             default: return;
//         }
//         await addManualLog(medicineId, statusVal, medicineName);
//     };

//     // --- 8. UPDATE LOG STATUS (For History UI) ---
//     const updateLogStatus = async (logId, statusVal) => {
//         const currentLogs = getCachedLogs();
//         const logToUpdate = currentLogs.find(log => log._id === logId);

//         if (!logToUpdate) {
//             loadData(false);
//             return { success: false, message: "Log not found." };
//         }
        
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

//     const swapIdInCache = async (tempId, realMedicine) => {
//         const realId = realMedicine._id;
//         const currentMeds = getCachedMedicines();
//         const swappedMeds = currentMeds.map(m => m._id === tempId ? realMedicine : m);
//         saveMedicinesToCache(swappedMeds);
//         setMedicines(swappedMeds);

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
//         loadData(false);
//     };

//     // --- 9. SYNC FUNCTION ---
//     const syncOfflineData = async () => {
//         if (isSyncingGlobal) return;

//         // 1. Strict Check before starting
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
//                         const res = await axios.post(`${API_BASE_URL}/medicines/logs`, item.data, { headers: { Authorization: `Bearer ${token}` } });
//                         if (res.status === 200 || res.status === 201) {
//                             success = true;
//                             const realLog = res.data.log;
//                             const currentLogs = getCachedLogs();
//                             const syncedLogs = currentLogs.map(l => l._id === item.data.tempLogId ? { ...l, _id: realLog._id, pendingSync: false } : l);
//                             saveLogsToCache(syncedLogs);
//                             setLogs(syncedLogs);
//                         }
//                     }
//                     else if (item.action === 'UPDATE_LOG') {
//                          try {
//                              await axios.put(`${API_BASE_URL}/medicines/logs/${item.data.logId}`, { status: item.data.status }, { headers: { Authorization: `Bearer ${token}` } });
//                              success = true;
//                          } catch (updateError) {
//                              if (updateError.response?.status === 404) {
//                                  const currentLogs = getCachedLogs();
//                                  const localLog = currentLogs.find(l => l._id === item.data.logId);
//                                  if (localLog) {
//                                      const createPayload = {
//                                          clientLogId: localLog.clientLogId || localLog._id, 
//                                          medicineClientId: localLog.medicineClientId || localLog.medicineId._id || localLog.medicineId,
//                                          status: item.data.status,
//                                          date: localLog.date,
//                                          time: localLog.time
//                                      };
//                                      const createRes = await axios.post(`${API_BASE_URL}/medicines/logs`, createPayload, { headers: { Authorization: `Bearer ${token}` } });
//                                      if (createRes.status === 200 || createRes.status === 201) {
//                                          success = true;
//                                          const newLogId = createRes.data.log._id;
//                                          const syncedLogs = currentLogs.map(l => l._id === item.data.logId ? { ...l, _id: newLogId, pendingSync: false } : l);
//                                          saveLogsToCache(syncedLogs);
//                                          setLogs(syncedLogs);
//                                      }
//                                  } else {
//                                      success = true; 
//                                  }
//                              } else {
//                                  throw updateError; 
//                              }
//                          }
                         
//                          if (success) {
//                              const currentLogs = getCachedLogs();
//                              const updatedLogs = currentLogs.map(l => l._id === item.data.logId ? {...l, pendingSync: false} : l);
//                              saveLogsToCache(updatedLogs);
//                              setLogs(updatedLogs);
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
//                     if (e.response?.status === 404 && item.action !== 'CREATE_LOG' && item.action !== 'UPDATE_LOG') {
//                         success = true; 
//                     }
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
//         medicines, logs, loading, lastSyncTime, 
//         fetchMedicines: loadData, fetchFullHistory,
//         addMedicine, updateMedicine, deleteMedicine, toggleMuteMedicine, togglePauseMedicine,
//         handleNotificationAction, addManualLog, updateLogStatus, syncOfflineData, fetchLogs 
//     };
// };

