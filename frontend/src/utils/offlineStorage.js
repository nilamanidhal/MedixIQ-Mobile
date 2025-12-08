// frontend/src/utils/offlineStorage.js

const QUEUE_KEY = 'offline_mutation_queue';
const CACHE_KEY = 'cached_medicines';

// 1. Get the Queue (List of actions waiting for internet)
export const getQueue = () => {
  const queue = localStorage.getItem(QUEUE_KEY);
  return queue ? JSON.parse(queue) : [];
};

// 2. Add Item to Queue
export const addToQueue = (action, data) => {
  const queue = getQueue();
  // Action can be 'ADD', 'UPDATE', 'DELETE'
  // We add a timestamp so we know when it happened
  queue.push({ action, data, timestamp: Date.now() }); 
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

// 3. Clear Queue (Run this after we successfully sync with DB)
export const clearQueue = () => {
  localStorage.removeItem(QUEUE_KEY);
};

// 4. Cache Medicines (Save latest list to phone so it loads instantly)
export const saveMedicinesToCache = (medicines) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(medicines));
};

export const getCachedMedicines = () => {
  const cached = localStorage.getItem(CACHE_KEY);
  return cached ? JSON.parse(cached) : [];
};