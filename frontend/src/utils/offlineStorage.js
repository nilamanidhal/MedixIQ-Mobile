// frontend/src/utils/offlineStorage.js
import { Preferences } from '@capacitor/preferences';

const QUEUE_KEY = 'offline_mutation_queue';
const MEDICINE_CACHE_KEY = 'cached_medicines';
const LOGS_CACHE_KEY = 'cached_medicine_logs';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUEUE MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getQueue = async () => {
    try {
        const { value } = await Preferences.get({ key: QUEUE_KEY });
        return value ? JSON.parse(value) : [];
    } catch (e) {
        console.error("getQueue error:", e);
        return [];
    }
};

export const saveQueue = async (updatedQueue) => {
    try {
        await Preferences.set({
            key: QUEUE_KEY,
            value: JSON.stringify(updatedQueue)
        });
    } catch (e) {
        console.error("saveQueue error:", e);
    }
};

export const addToQueue = async (action, data) => {
    try {
        const queue = await getQueue();

        // ✅ Deduplication
        const isDuplicate = queue.some(q => {
            if (q.action !== action) return false;
            if (action === 'UPDATE') return q.data.id === data.id;
            if (action === 'UPDATE_LOG') return q.data.logId === data.logId;
            if (action === 'CREATE_LOG') return q.data.clientLogId === data.clientLogId;
            return false;
        });

        if (isDuplicate && action === 'UPDATE') {
            const updated = queue.map(q => {
                if (q.action === 'UPDATE' && q.data.id === data.id) {
                    return {
                        ...q,
                        data: {
                            ...q.data,
                            medicineData: {
                                ...q.data.medicineData,
                                ...data.medicineData
                            }
                        }
                    };
                }
                return q;
            });
            await saveQueue(updated);
            return;
        }

        if (isDuplicate && action === 'UPDATE_LOG') {
            const updated = queue.map(q => {
                if (q.action === 'UPDATE_LOG' && q.data.logId === data.logId) {
                    return { ...q, data: { ...q.data, status: data.status } };
                }
                return q;
            });
            await saveQueue(updated);
            return;
        }

        queue.push({ action, data, timestamp: Date.now() });
        await saveQueue(queue);
    } catch (e) {
        console.error("addToQueue error:", e);
    }
};

export const clearQueue = async () => {
    await Preferences.remove({ key: QUEUE_KEY });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEDICINE CACHE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const saveMedicinesToCache = async (medicines) => {
    try {
        await Preferences.set({
            key: MEDICINE_CACHE_KEY,
            value: JSON.stringify(medicines)
        });
    } catch (e) {
        console.error("saveMedicines error:", e);
    }
};

export const getCachedMedicines = async () => {
    try {
        const { value } = await Preferences.get({ key: MEDICINE_CACHE_KEY });
        return value ? JSON.parse(value) : [];
    } catch (e) {
        return [];
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGS CACHE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const saveLogsToCache = async (logs) => {
    try {
        await Preferences.set({
            key: LOGS_CACHE_KEY,
            value: JSON.stringify(logs)
        });
    } catch (e) {
        console.error("saveLogs error:", e);
    }
};

export const getCachedLogs = async () => {
    try {
        const { value } = await Preferences.get({ key: LOGS_CACHE_KEY });
        return value ? JSON.parse(value) : [];
    } catch (e) {
        return [];
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MIGRATION HELPER
// Pehli baar run karo — localStorage se Preferences mein copy karo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const migrateFromLocalStorage = async () => {
    try {
        const migrated = localStorage.getItem('prefs_migrated');
        if (migrated) return; // Already migrated

        console.log("🔄 Migrating from localStorage to Preferences...");

        const keys = [QUEUE_KEY, MEDICINE_CACHE_KEY, LOGS_CACHE_KEY];

        for (const key of keys) {
            const value = localStorage.getItem(key);
            if (value) {
                await Preferences.set({ key, value });
                localStorage.removeItem(key);
                console.log(`✅ Migrated: ${key}`);
            }
        }

        localStorage.setItem('prefs_migrated', 'true');
        console.log("✅ Migration complete");
    } catch (e) {
        console.error("Migration error:", e);
    }
};



















// // frontend/src/utils/offlineStorage.js

// const QUEUE_KEY = 'offline_mutation_queue';
// const MEDICINE_CACHE_KEY = 'cached_medicines';
// const LOGS_CACHE_KEY = 'cached_medicine_logs';

// // --- 1. QUEUE MANAGEMENT (The "To-Do List") ---

// // Get the list of actions waiting for internet
// export const getQueue = () => {
//   try {
//     const queue = localStorage.getItem(QUEUE_KEY);
//     return queue ? JSON.parse(queue) : [];
//   } catch (e) {
//     console.error("Error reading queue:", e);
//     return [];
//   }
// };

// // Add a new action to the queue
// export const addToQueue = (action, data) => {
//   try {
//     const queue = getQueue();
//     // 'data' will contain the full payload (tempId, medicine details, etc.)
//     queue.push({ 
//         action, 
//         data, 
//         timestamp: Date.now() 
//     });
//     localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
//   } catch (e) {
//     console.error("Error adding to queue:", e);
//   }
// };

// // 🔥 NEW: Update the queue (Used when removing processed items one by one)
// export const saveQueue = (updatedQueue) => {
//     localStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
// };

// // Clear entire queue (Use with caution)
// export const clearQueue = () => {
//   localStorage.removeItem(QUEUE_KEY);
// };


// // --- 2. MEDICINE CACHE (The "Offline List") ---

// export const saveMedicinesToCache = (medicines) => {
//   localStorage.setItem(MEDICINE_CACHE_KEY, JSON.stringify(medicines));
// };

// export const getCachedMedicines = () => {
//   try {
//     const cached = localStorage.getItem(MEDICINE_CACHE_KEY);
//     return cached ? JSON.parse(cached) : [];
//   } catch (e) {
//     return [];
//   }
// };


// // --- 3. 🔥 NEW: LOGS CACHE (The "Offline History") ---

// export const saveLogsToCache = (logs) => {
//   localStorage.setItem(LOGS_CACHE_KEY, JSON.stringify(logs));
// };

// export const getCachedLogs = () => {
//   try {
//     const cached = localStorage.getItem(LOGS_CACHE_KEY);
//     return cached ? JSON.parse(cached) : [];
//   } catch (e) {
//     return [];
//   }
// };
