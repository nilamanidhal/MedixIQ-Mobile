// frontend/src/utils/offlineStorage.js

const QUEUE_KEY = 'offline_mutation_queue';
const MEDICINE_CACHE_KEY = 'cached_medicines';
const LOGS_CACHE_KEY = 'cached_medicine_logs';

// --- 1. QUEUE MANAGEMENT (The "To-Do List") ---

// Get the list of actions waiting for internet
export const getQueue = () => {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (e) {
    console.error("Error reading queue:", e);
    return [];
  }
};

// Add a new action to the queue
export const addToQueue = (action, data) => {
  try {
    const queue = getQueue();
    // 'data' will contain the full payload (tempId, medicine details, etc.)
    queue.push({ 
        action, 
        data, 
        timestamp: Date.now() 
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Error adding to queue:", e);
  }
};

// 🔥 NEW: Update the queue (Used when removing processed items one by one)
export const saveQueue = (updatedQueue) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
};

// Clear entire queue (Use with caution)
export const clearQueue = () => {
  localStorage.removeItem(QUEUE_KEY);
};


// --- 2. MEDICINE CACHE (The "Offline List") ---

export const saveMedicinesToCache = (medicines) => {
  localStorage.setItem(MEDICINE_CACHE_KEY, JSON.stringify(medicines));
};

export const getCachedMedicines = () => {
  try {
    const cached = localStorage.getItem(MEDICINE_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    return [];
  }
};


// --- 3. 🔥 NEW: LOGS CACHE (The "Offline History") ---

export const saveLogsToCache = (logs) => {
  localStorage.setItem(LOGS_CACHE_KEY, JSON.stringify(logs));
};

export const getCachedLogs = () => {
  try {
    const cached = localStorage.getItem(LOGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    return [];
  }
};













// // frontend/src/utils/offlineStorage.js

// const QUEUE_KEY = 'offline_mutation_queue';
// const MEDICINE_CACHE_KEY = 'cached_medicines';
// const LOGS_CACHE_KEY = 'cached_medicine_logs';

// // --- QUEUE ---
// export const getQueue = () => {
//   try {
//     const queue = localStorage.getItem(QUEUE_KEY);
//     return queue ? JSON.parse(queue) : [];
//   } catch (e) { return []; }
// };

// export const addToQueue = (action, data) => {
//   try {
//     const queue = getQueue();
//     queue.push({ action, data, timestamp: Date.now() });
//     localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
//   } catch (e) { console.error(e); }
// };

// export const saveQueue = (updatedQueue) => {
//     localStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
// };

// export const clearQueue = () => localStorage.removeItem(QUEUE_KEY);

// // --- MEDICINES ---
// export const saveMedicinesToCache = (medicines) => {
//   localStorage.setItem(MEDICINE_CACHE_KEY, JSON.stringify(medicines));
// };

// export const getCachedMedicines = () => {
//   try {
//     const cached = localStorage.getItem(MEDICINE_CACHE_KEY);
//     return cached ? JSON.parse(cached) : [];
//   } catch (e) { return []; }
// };

// // --- LOGS ---
// export const saveLogsToCache = (logs) => {
//   localStorage.setItem(LOGS_CACHE_KEY, JSON.stringify(logs));
// };

// export const getCachedLogs = () => {
//   try {
//     const cached = localStorage.getItem(LOGS_CACHE_KEY);
//     return cached ? JSON.parse(cached) : [];
//   } catch (e) { return []; }
// };








// // frontend/src/utils/offlineStorage.js

// const QUEUE_KEY = 'offline_mutation_queue';
// const CACHE_KEY = 'cached_medicines';

// // 1. Get the Queue (List of actions waiting for internet)
// export const getQueue = () => {
//   const queue = localStorage.getItem(QUEUE_KEY);
//   return queue ? JSON.parse(queue) : [];
// };

// // 2. Add Item to Queue
// export const addToQueue = (action, data) => {
//   const queue = getQueue();
//   // Action can be 'ADD', 'UPDATE', 'DELETE'
//   // We add a timestamp so we know when it happened
//   queue.push({ action, data, timestamp: Date.now() }); 
//   localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
// };

// // 3. Clear Queue (Run this after we successfully sync with DB)
// export const clearQueue = () => {
//   localStorage.removeItem(QUEUE_KEY);
// };

// // 4. Cache Medicines (Save latest list to phone so it loads instantly)
// export const saveMedicinesToCache = (medicines) => {
//   localStorage.setItem(CACHE_KEY, JSON.stringify(medicines));
// };

// export const getCachedMedicines = () => {
//   const cached = localStorage.getItem(CACHE_KEY);
//   return cached ? JSON.parse(cached) : [];
// };