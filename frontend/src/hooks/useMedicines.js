import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Network } from '@capacitor/network';
import axios from 'axios';
import {
    addToQueue, getQueue, saveQueue,
    saveMedicinesToCache, getCachedMedicines,
    saveLogsToCache, getCachedLogs,
    migrateFromLocalStorage
} from '../utils/offlineStorage';
import { scheduleMedicineReminder, cancelMedicineReminders } from '../utils/LocalNotificationManager';

// Global flags — 3 hone chahiye
let isSyncingGlobal = false;
let isLoadingGlobal = false;
let pendingSyncAfterLoad = false;

const isSameItem = (item1, item2) => {
    if (!item1 || !item2) return false;
    if (item1.timestamp && item2.timestamp) return item1.timestamp === item2.timestamp;
    return item1.action === item2.action && JSON.stringify(item1.data) === JSON.stringify(item2.data);
};

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
        startDate.setHours(0, 0, 0, 0);
        if (checkDate < startDate) continue;

        for (const timeStr of medicine.times) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const scheduleTime = new Date(checkDate);
            scheduleTime.setHours(hours, minutes, 0, 0);
            if (scheduleTime <= endDate && scheduleTime >= startDate) {
                schedules.push({
                    time: scheduleTime,
                    timeStr,
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

// useMedicines.js ke top mein — initial state async load karo
export const useMedicines = () => {
    // Start with empty — Preferences async hai
    const [medicines, setMedicines] = useState([]);
    const [logs, setLogs] = useState([]);
    
    // loading: true by default — data aane tak spinner dikhao
    const [loading, setLoading] = useState(true);
    
    const [lastSyncTime, setLastSyncTime] = useState(
        () => localStorage.getItem('last_sync_time')
    );

    const { token, API_BASE_URL } = useAuth();
    const isAddingRef = useRef(false);
    const processingRef = useRef(new Set());

    // SINGLE init effect — migration + instant cache load
    useEffect(() => {
        const init = async () => {
            await migrateFromLocalStorage();
            
            // Turant cache se load karo — spinner hatao
            const cachedMeds = await getCachedMedicines();
            const cachedLogs = await getCachedLogs();
            
            if (cachedMeds.length > 0) {
                const finalLogs = generatePendingLogs(cachedMeds, cachedLogs);
                setMedicines(cachedMeds);
                setLogs(finalLogs);
                setLoading(false); // Data aa gaya — spinner hatao
            }
            
            // Background mein server se sync karo
            await loadData(false);
        };
        init();

        let syncTimeout = null;
        const netListener = Network.addListener('networkStatusChange', s => {
            if (s.connected) {
                clearTimeout(syncTimeout);
                syncTimeout = setTimeout(() => {
                    if (!isSyncingGlobal) syncOfflineData();
                }, 1000);
            }
        });

        const updateListener = () => {
            if (!isSyncingGlobal && !isLoadingGlobal) loadData(true);
        };
        window.addEventListener('medmind_data_updated', updateListener);

        return () => {
            netListener.remove();
            window.removeEventListener('medmind_data_updated', updateListener);
            clearTimeout(syncTimeout);
        };
    }, []);

    useEffect(() => {
        if (token) loadData(false);
        else { setMedicines([]); setLogs([]); setLoading(false); }
    }, [token]);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // generatePendingLogs — same as before (sync ok hai)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
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
                    updatedLogs.push({
                        _id: tempLogId, clientLogId: tempLogId,
                        medicineId: { _id: medId, name: med.name },
                        medicineClientId: medClientId || medId,
                        status: 'pending', date: schedule.time.toISOString(),
                        time: schedule.timeStr, pendingSync: true
                    });
                    existingLogSignatures.add(sig1);
                }
            }
        }
        return updatedLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // queuePastPendingLogs 
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const queuePastPendingLogs = async (allLogs) => {
        let queue = await getQueue();
        let queueModified = false;

        allLogs.forEach(log => {
            if (!log._id.toString().startsWith('log_') || !log.pendingSync) return;
            if (!isLogDueForUpload(log)) return;
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
                    },
                    timestamp: Date.now()
                });
                queueModified = true;
            }
        });

        if (queueModified) {
            await saveQueue(queue);
            Network.getStatus().then(s => {
                if (s.connected) syncOfflineData();
            });
        }
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // loadData fully async
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const loadData = async (onlyCache = false) => {
    if (isSyncingGlobal) { pendingSyncAfterLoad = true; return; }
    if (isLoadingGlobal) return;
    isLoadingGlobal = true;

    // Step 1: Cache se data lo — instant
    let cachedMeds = await getCachedMedicines();
    let cachedLogs = await getCachedLogs();
    let queue = await getQueue();

    let pendingDeleteIds = new Set(
        queue.filter(q => q.action === 'DELETE')
             .map(q => q.data.id ? String(q.data.id) : null)
             .filter(Boolean)
    );
    cachedMeds = cachedMeds.filter(m => !pendingDeleteIds.has(String(m._id)));

    // Turant UI update karo cache se
    const cacheBasedLogs = generatePendingLogs(cachedMeds, cachedLogs);
    setMedicines(cachedMeds);
    setLogs(cacheBasedLogs);
    setLoading(false); 

    if (onlyCache) { isLoadingGlobal = false; return; }

    // Step 2: Background mein server fetch (no spinner)
    const netStatus = await Network.getStatus();
    if (netStatus.connected && token) {
        try {
            const resMeds = await axios.get(`${API_BASE_URL}/medicines`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const serverMedicines = resMeds.data.medicines;

            let serverLogs = [];
            try {
                const resLogs = await axios.get(`${API_BASE_URL}/medicines/logs`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                serverLogs = resLogs.data.logs || [];
            } catch(e) {}

            queue = await getQueue();
            pendingDeleteIds = new Set(
                queue.filter(q => q.action === 'DELETE')
                     .map(q => q.data.id ? String(q.data.id) : null)
                     .filter(Boolean)
            );

            const queuedMedIds = new Set(
                queue.filter(q => q.action === 'UPDATE').map(q => String(q.data.id))
            );
            const queuedLogIds = new Set([
                ...queue.filter(q => q.action === 'UPDATE_LOG').map(q => String(q.data.logId)),
                ...queue.filter(q => q.action === 'CREATE_LOG').map(q => String(q.data.clientLogId))
            ]);

            const busyIds = processingRef.current;
            const serverClientIds = new Set(serverMedicines.map(m => m.clientId).filter(Boolean));
            const localTempMeds = cachedMeds.filter(m =>
                m._id.toString().startsWith('temp_') && !serverClientIds.has(m.clientId)
            );

            let mergedMeds = [...localTempMeds, ...serverMedicines]
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .filter(m => {
                    const idStr = String(m._id);
                    return !pendingDeleteIds.has(idStr) && !busyIds.has(idStr);
                })
                .map(serverMed => {
                    const idStr = String(serverMed._id);
                    if (queuedMedIds.has(idStr)) {
                        const localMed = cachedMeds.find(m => String(m._id) === idStr);
                        if (localMed) {
                            return {
                                ...serverMed,
                                isMuted: localMed.isMuted,
                                isPaused: localMed.isPaused,
                                pausedDate: localMed.pausedDate
                            };
                        }
                    }
                    return serverMed;
                });

            const mergedLogsMap = new Map();
            serverLogs.forEach(log => mergedLogsMap.set(log._id, log));
            cachedLogs.forEach(localLog => {
                if (busyIds.has(localLog._id)) {
                    mergedLogsMap.set(localLog._id, localLog);
                    return;
                }
                const serverLog = mergedLogsMap.get(localLog._id);
                if (localLog.pendingSync || queuedLogIds.has(String(localLog._id))) {
                    mergedLogsMap.set(localLog._id, localLog);
                } else if (serverLog) {
                    if (serverLog.status === 'pending' && localLog.status !== 'pending') {
                        mergedLogsMap.set(localLog._id, { ...serverLog, status: localLog.status });
                    }
                } else if (localLog._id.toString().startsWith('log_') || localLog.clientLogId) {
                    mergedLogsMap.set(localLog._id, localLog);
                }
            });

            const uniqueLogs = Array.from(mergedLogsMap.values());
            const finalLogs = generatePendingLogs(mergedMeds, uniqueLogs);
            await queuePastPendingLogs(finalLogs);

            //  Silent update — no spinner, just swap data
            setMedicines(mergedMeds);
            await saveMedicinesToCache(mergedMeds);
            setLogs(finalLogs);
            await saveLogsToCache(finalLogs);
            localStorage.setItem('last_sync_time', new Date().toISOString());
            setLastSyncTime(new Date().toISOString());

        } catch(e) {
            console.log("Using offline cache:", e);
        }
    }

    isLoadingGlobal = false;
};

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // addMedicine 
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const addMedicine = async (medicineData) => {
        if (isAddingRef.current) return { success: false, message: "Processing..." };
        isAddingRef.current = true;
        try {
            const tempId = `temp_${Date.now()}`;
            const newMedicine = {
                ...medicineData, _id: tempId, clientId: tempId,
                pendingSync: true, createdAt: new Date().toISOString(),
                times: medicineData.times || [],
                duration: medicineData.duration || { startDate: new Date(), endDate: new Date() },
                isMuted: false, isPaused: false, isActive: true
            };
            const currentCache = await getCachedMedicines();
            const newMedList = [newMedicine, ...currentCache];
            await saveMedicinesToCache(newMedList);
            setMedicines(newMedList);

            const currentLogs = await getCachedLogs();
            const newGeneratedLogs = generatePendingLogs([newMedicine], []);
            const updatedLogs = [...currentLogs, ...newGeneratedLogs];
            await saveLogsToCache(updatedLogs);
            setLogs(updatedLogs);

            await scheduleMedicineReminder(newMedicine);
            await addToQueue('ADD', { ...newMedicine });

            const s = await Network.getStatus();
            if (s.connected) syncOfflineData();
            return { success: true };
        } finally {
            isAddingRef.current = false;
        }
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // updateMedicine fully async
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const updateMedicine = async (id, medicineData) => {
        const currentCache = await getCachedMedicines();
        const newList = currentCache.map(m => m._id === id ? { ...m, ...medicineData } : m);
        await saveMedicinesToCache(newList);
        setMedicines(newList);

        const currentLogs = await getCachedLogs();
        const finalLogs = generatePendingLogs(newList, currentLogs);
        setLogs(finalLogs);
        await saveLogsToCache(finalLogs);
        await queuePastPendingLogs(finalLogs);

        const updatedMed = newList.find(m => m._id === id);
        if (updatedMed && !updatedMed.isPaused) await scheduleMedicineReminder(updatedMed);

        if (id.toString().startsWith('temp_')) {
            let queue = await getQueue();
            const existingAddIndex = queue.findIndex(q => q.action === 'ADD' && q.data._id === id);
            if (existingAddIndex !== -1) {
                queue[existingAddIndex].data = { ...queue[existingAddIndex].data, ...medicineData };
                await saveQueue(queue);
                return { success: true };
            }
        }

        await addToQueue('UPDATE', { id, medicineData });
        const s = await Network.getStatus();
        if (s.connected) syncOfflineData();
        return { success: true };
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // swapIdInCache fully async
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const swapIdInCache = async (tempId, realMedicine) => {
        const realId = realMedicine._id;
        const currentMeds = await getCachedMedicines();
        const cleanMeds = currentMeds.filter(m => m._id !== tempId && m._id !== realId);
        const swappedMeds = [realMedicine, ...cleanMeds];
        await saveMedicinesToCache(swappedMeds);
        setMedicines(swappedMeds);

        const currentLogs = await getCachedLogs();
        const swappedLogs = currentLogs.map(log => {
            if (log.medicineId && log.medicineId._id === tempId) {
                return { ...log, medicineId: { ...log.medicineId, _id: realId }, medicineClientId: realMedicine.clientId };
            }
            return log;
        });
        await saveLogsToCache(swappedLogs);
        setLogs(swappedLogs);

        let queue = await getQueue();
        let queueChanged = false;
        queue = queue.map(q => {
            if (q.data.medicineClientId === tempId) {
                q.data.medicineClientId = realId;
                q.data.medicineId = realId;
                queueChanged = true;
            }
            return q;
        });
        if (queueChanged) await saveQueue(queue);

        await cancelMedicineReminders(tempId);
        await scheduleMedicineReminder(realMedicine);
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // deleteMedicine fully async
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const deleteMedicine = async (id) => {
        processingRef.current.add(String(id));
        cancelMedicineReminders(id);

        const currentCache = await getCachedMedicines();
        const newList = currentCache.filter(m => m._id !== id);
        await saveMedicinesToCache(newList);
        setMedicines(newList);

        const currentLogs = await getCachedLogs();
        const now = new Date();
        const filteredLogs = currentLogs.filter(log => {
            const logMedId = log.medicineId?._id || log.medicineId;
            if (String(logMedId) !== String(id)) return true;
            const logDate = new Date(log.date);
            const [h, m] = log.time.split(':').map(Number);
            logDate.setHours(h, m, 0, 0);
            return logDate <= now;
        });
        await saveLogsToCache(filteredLogs);
        setLogs(filteredLogs);

        let queue = await getQueue();
        const wasTempAdd = queue.some(q => q.action === 'ADD' && q.data._id === id);
        queue = queue.filter(q => {
            const dataId = q.data._id || q.data.medicineClientId || q.data.medicineId;
            return String(dataId) !== String(id);
        });
        if (!wasTempAdd && !id.toString().startsWith('temp_')) {
            queue.unshift({ action: 'DELETE', data: { id }, timestamp: Date.now() });
        }
        await saveQueue(queue);

        const s = await Network.getStatus();
        if (s.connected) syncOfflineData();
        return { success: true };
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // toggleMuteMedicine  fully async
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const toggleMuteMedicine = async (id) => {
        processingRef.current.add(String(id));

        const currentCache = await getCachedMedicines();
        const med = currentCache.find(m => m._id === id);
        if (!med) { processingRef.current.delete(String(id)); return; }

        const newMuteStatus = !med.isMuted;
        const updatedMeds = currentCache.map(m =>
            m._id === id ? { ...m, isMuted: newMuteStatus } : m
        );
        await saveMedicinesToCache(updatedMeds);
        setMedicines(updatedMeds);

        if (id.toString().startsWith('temp_')) {
            let queue = await getQueue();
            const idx = queue.findIndex(q =>
                q.data._id === id && (q.action === 'ADD' || q.action === 'UPDATE')
            );
            if (idx !== -1) {
                queue[idx].data.isMuted = newMuteStatus;
                await saveQueue(queue);
                processingRef.current.delete(String(id));
                return { success: true };
            }
        }

        await addToQueue('UPDATE', { id, medicineData: { isMuted: newMuteStatus } });
        const s = await Network.getStatus();
        if (s.connected) await syncOfflineData();

        processingRef.current.delete(String(id));
        return { success: true };
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // togglePauseMedicine fully async
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const togglePauseMedicine = async (id, extendDuration = false) => {
        processingRef.current.add(String(id));

        const currentCache = await getCachedMedicines();
        const med = currentCache.find(m => m._id === id);
        if (!med) { processingRef.current.delete(String(id)); return; }

        const isPausing = !med.isPaused;
        let updatePayload = { isPaused: isPausing };
        if (isPausing) {
            updatePayload.pausedDate = new Date().toISOString();
            await cancelMedicineReminders(id);
        } else {
            updatePayload.pausedDate = null;
        }

        const updatedMeds = currentCache.map(m =>
            m._id === id ? { ...m, ...updatePayload } : m
        );
        await saveMedicinesToCache(updatedMeds);
        setMedicines(updatedMeds);

        const currentLogs = await getCachedLogs();
        const finalLogs = generatePendingLogs(updatedMeds, currentLogs);
        setLogs(finalLogs);
        await saveLogsToCache(finalLogs);

        await addToQueue('UPDATE', { id, medicineData: updatePayload });
        const s = await Network.getStatus();
        if (s.connected) await syncOfflineData();

        processingRef.current.delete(String(id));
        return { success: true };
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // addManualLog fully async
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const addManualLog = async (medicineId, statusVal, medicineName) => {
        const now = new Date();
        const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const nowDayStr = now.toISOString().split('T')[0];

        const currentLogs = await getCachedLogs();
        const targetIndex = currentLogs.findIndex(log =>
            (log.medicineId?._id === medicineId || log.medicineId === medicineId) &&
            new Date(log.date).toISOString().split('T')[0] === nowDayStr &&
            log.time === nowTimeStr
        );

        let logToUpdateId = null;
        let isNewLog = false;
        let newLogs = [...currentLogs];

        if (targetIndex !== -1) {
            logToUpdateId = newLogs[targetIndex]._id;
            newLogs[targetIndex] = { ...newLogs[targetIndex], status: statusVal, pendingSync: true };
        } else {
            isNewLog = true;
            const tempId = `log_manual_${Date.now()}`;
            logToUpdateId = tempId;
            const med = medicines.find(m => m._id === medicineId);
            const finalName = med?.name || medicineName || 'Unknown';
            const finalClientId = med?.clientId || medicineId;
            newLogs.unshift({
                _id: tempId, clientLogId: tempId,
                medicineId: { _id: medicineId, name: finalName },
                medicineClientId: finalClientId,
                status: statusVal, date: now.toISOString(),
                time: nowTimeStr, pendingSync: true
            });
        }

        await saveLogsToCache(newLogs);
        setLogs(newLogs);
        if (logToUpdateId) processingRef.current.add(logToUpdateId);

        const med = medicines.find(m => m._id === medicineId);
        const finalClientId = med?.clientId || medicineId;

        if (isNewLog) {
            await addToQueue('CREATE_LOG', {
                clientLogId: logToUpdateId, medicineClientId: finalClientId,
                status: statusVal, date: now.toISOString(),
                time: nowTimeStr, tempLogId: logToUpdateId
            });
        } else {
            if (logToUpdateId.toString().startsWith('log_')) {
                const logData = currentLogs.find(l => l._id === logToUpdateId);
                if (logData) {
                    await addToQueue('CREATE_LOG', {
                        clientLogId: logData.clientLogId || logToUpdateId,
                        medicineClientId: finalClientId,
                        status: statusVal, date: logData.date,
                        time: logData.time, tempLogId: logToUpdateId
                    });
                }
            } else {
                await addToQueue('UPDATE_LOG', { logId: logToUpdateId, status: statusVal });
            }
        }

        const s = await Network.getStatus();
        if (s.connected) syncOfflineData();
        return { success: true };
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // updateLogStatus 
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const updateLogStatus = async (logId, statusVal) => {
        processingRef.current.add(logId);

        const currentLogs = await getCachedLogs();
        const updated = currentLogs.map(log =>
            log._id === logId ? { ...log, status: statusVal, pendingSync: true } : log
        );
        await saveLogsToCache(updated);
        setLogs(updated);

        const logToUpdate = currentLogs.find(log => log._id === logId);
        if (!logToUpdate) {
            await addToQueue('UPDATE_LOG', { logId, status: statusVal });
            return { success: true };
        }

        if (logToUpdate._id.toString().startsWith('log_')) {
            let queue = await getQueue();
            const existingIdx = queue.findIndex(q =>
                q.action === 'CREATE_LOG' &&
                (q.data.clientLogId === logId || q.data.tempLogId === logId)
            );
            if (existingIdx !== -1) {
                queue[existingIdx].data.status = statusVal;
                await saveQueue(queue);
            } else {
                await addToQueue('CREATE_LOG', {
                    clientLogId: logToUpdate.clientLogId || logToUpdate._id,
                    medicineClientId: logToUpdate.medicineClientId || logToUpdate.medicineId._id,
                    status: statusVal, date: logToUpdate.date,
                    time: logToUpdate.time, tempLogId: logToUpdate._id
                });
            }
        } else {
            await addToQueue('UPDATE_LOG', { logId: logToUpdate._id, status: statusVal });
        }

        const s = await Network.getStatus();
        if (s.connected) syncOfflineData();
        return { success: true };
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // syncOfflineData 
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const syncOfflineData = async () => {
        if (isSyncingGlobal) return;
        const s = await Network.getStatus();
        if (!s.connected) return;

        const queue = await getQueue();
        if (queue.length === 0) return;

        isSyncingGlobal = true;
        try {
            while (true) {
                const currentQueue = await getQueue();
                if (currentQueue.length === 0) break;

                const item = currentQueue[0];
                let success = false;
                let processedId = null;

                try {
                    if (item.action === 'ADD') {
                        const res = await axios.post(
                            `${API_BASE_URL}/medicines`,
                            { ...item.data, clientId: item.data._id },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        if (res.status === 200 || res.status === 201) {
                            success = true;
                            await swapIdInCache(item.data._id, res.data.medicine);
                        }
                    }
                    else if (item.action === 'UPDATE') {
                        if (!item.data.id.toString().startsWith('temp_')) {
                            await axios.put(
                                `${API_BASE_URL}/medicines/${item.data.id}`,
                                item.data.medicineData,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                        }
                        success = true;
                        processedId = item.data.id;
                        const cache = await getCachedMedicines();
                        await saveMedicinesToCache(
                            cache.map(m => String(m._id) === String(item.data.id)
                                ? { ...m, ...item.data.medicineData, pendingSync: false }
                                : m
                            )
                        );
                    }
                    else if (item.action === 'CREATE_LOG') {
                        if (isLogDueForUpload(item.data)) {
                            const res = await axios.post(
                                `${API_BASE_URL}/medicines/logs`, item.data,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            if (res.status === 200 || res.status === 201) {
                                success = true;
                                processedId = item.data.tempLogId;
                                const logs = await getCachedLogs();
                                await saveLogsToCache(
                                    logs.map(l => l._id === item.data.tempLogId
                                        ? { ...l, _id: res.data.log._id, pendingSync: false }
                                        : l
                                    )
                                );
                            }
                        } else { success = true; }
                    }
                    else if (item.action === 'UPDATE_LOG') {
                        try {
                            await axios.put(
                                `${API_BASE_URL}/medicines/logs/${item.data.logId}`,
                                { status: item.data.status },
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            success = true;
                            processedId = item.data.logId;
                            const logs = await getCachedLogs();
                            await saveLogsToCache(
                                logs.map(l => String(l._id) === String(item.data.logId)
                                    ? { ...l, status: item.data.status, pendingSync: false }
                                    : l
                                )
                            );
                        } catch(e) {
                            if (e.response?.status === 404) success = true;
                            else throw e;
                        }
                    }
                    else if (item.action === 'DELETE') {
                        if (!item.data.id.toString().startsWith('temp_')) {
                            await axios.delete(
                                `${API_BASE_URL}/medicines/${item.data.id}`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                        }
                        success = true;
                        processedId = item.data.id;
                    }
                } catch(e) {
                    if (e.response?.status === 404 && item.action === 'DELETE') success = true;
                    else { console.error("Sync Error:", item.action, e); break; }
                }

                if (success) {
                    const fresh = await getQueue();
                    await saveQueue(fresh.filter(q => !isSameItem(q, item)));
                    if (processedId) processingRef.current.delete(String(processedId));
                } else { break; }
            }
        } finally {
            isSyncingGlobal = false;
            if (pendingSyncAfterLoad) {
                pendingSyncAfterLoad = false;
                setTimeout(() => loadData(false), 500);
            }
        }
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    // syncAlarms fully async
    // ━━━━━━━━━━━━━━━━━━━━━━━━━
    const syncAlarms = async () => {
        const currentMeds = await getCachedMedicines();
        if (currentMeds.length === 0) return { success: false, message: "No medicines." };
        try {
            let count = 0;
            for (const med of currentMeds) {
                if (med.isActive && !med.isPaused) {
                    await scheduleMedicineReminder(med);
                    count++;
                }
            }
            return { success: true, message: `Rescheduled ${count} medicines.` };
        } catch(e) {
            return { success: false, message: "Failed to sync alarms." };
        }
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

    const fetchLogs = async () => getCachedLogs();
    const fetchFullHistory = async () => {};

    return {
        medicines, logs, loading, lastSyncTime,
        fetchMedicines: loadData, fetchFullHistory,
        addMedicine, updateMedicine, deleteMedicine,
        toggleMuteMedicine, togglePauseMedicine,
        handleNotificationAction, addManualLog,
        updateLogStatus, syncOfflineData,
        fetchLogs, syncAlarms
    };
};
