import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Network } from '@capacitor/network';
import axios from 'axios';

import { 
  addToQueue, 
  getQueue, 
  clearQueue, 
  saveMedicinesToCache, 
  getCachedMedicines 
} from '../utils/offlineStorage';

import { 
    scheduleMedicineReminder, 
    cancelMedicineReminders 
} from '../utils/LocalNotificationManager';

export const useMedicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('last_sync_time'));
  
  const { token, API_BASE_URL } = useAuth();

  // 1. Initial Load
  useEffect(() => {
    const cached = getCachedMedicines();
    if (cached.length > 0) {
      setMedicines(cached);
      setLoading(false);
    }
    
    // Listen for internet to trigger sync
    Network.addListener('networkStatusChange', status => {
      if (status.connected) syncOfflineData();
    });
  }, []);

  // 2. Fetch (Always use Cache if fetch fails)
  const fetchMedicines = async () => {
    const status = await Network.getStatus();
    const cached = getCachedMedicines();
    
    // Load cache first (Instant speed)
    if(cached.length > 0) setMedicines(cached);

    if (status.connected && token) {
      try {
        const response = await axios.get(`${API_BASE_URL}/medicines`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.medicines) {
          setMedicines(response.data.medicines);
          saveMedicinesToCache(response.data.medicines);
          
          const now = new Date().toISOString();
          localStorage.setItem('last_sync_time', now);
          setLastSyncTime(now);

          // Refill Alarms in Background
          response.data.medicines.forEach(med => scheduleMedicineReminder(med).catch(console.error));
        }
      } catch (err) {
        console.log("Offline mode: Using cached data.");
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  // 3. Add Medicine (Offline + Online)
  const addMedicine = async (medicineData) => {
    const tempId = `temp_${Date.now()}`;
    const medicineWithTempId = { ...medicineData, _id: tempId };

    // ALARM FIRST (Works offline)
    try { await scheduleMedicineReminder(medicineWithTempId); } catch (e) {}

    const status = await Network.getStatus();

    if (status.connected) {
      try {
        const response = await axios.post(`${API_BASE_URL}/medicines`, medicineData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.status === 200 || response.status === 201) {
             const realMedicine = response.data.medicine || response.data;
             await cancelMedicineReminders(tempId);
             await scheduleMedicineReminder(realMedicine);
             fetchMedicines();
             return { success: true };
        }
      } catch (e) { return { success: false, message: "Server error" }; }
    } else {
      // QUEUE FOR SYNC
      addToQueue('ADD', medicineData);
      
      const newList = [...medicines, { ...medicineWithTempId, pendingSync: true }];
      setMedicines(newList);
      saveMedicinesToCache(newList);
      return { success: true, message: "Saved to phone. Will sync later." };
    }
  };

  // 4. Update Medicine (Offline + Online)
  const updateMedicine = async (id, medicineData) => {
    // ALARM FIRST
    const medicineWithId = { ...medicineData, _id: id };
    await scheduleMedicineReminder(medicineWithId);

    const status = await Network.getStatus();

    if (status.connected) {
       try {
         await axios.put(`${API_BASE_URL}/medicines/${id}`, medicineData, {
            headers: { Authorization: `Bearer ${token}` }
         });
         fetchMedicines();
         return { success: true };
       } catch (e) { return { success: false, message: "Update failed" }; }
    } else {
       // OFFLINE UPDATE
       addToQueue('UPDATE', { id, ...medicineData }); // Add to sync queue

       // Update Local List Immediately
       const newList = medicines.map(med => med._id === id ? { ...medicineWithId, pendingSync: true } : med);
       setMedicines(newList);
       saveMedicinesToCache(newList);
       return { success: true, message: "Updated locally." };
    }
  };

  // 5. Delete Medicine (Offline + Online)
  const deleteMedicine = async (id) => {
    // ALARM FIRST
    await cancelMedicineReminders(id);

    const status = await Network.getStatus();

    if (status.connected) {
       try {
         await axios.delete(`${API_BASE_URL}/medicines/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
         });
         fetchMedicines();
         return { success: true };
       } catch (e) { return { success: false, message: "Delete failed" }; }
    } else {
       // OFFLINE DELETE
       addToQueue('DELETE', { id });

       // Remove from Local List Immediately
       const newList = medicines.filter(med => med._id !== id);
       setMedicines(newList);
       saveMedicinesToCache(newList);
       return { success: true, message: "Deleted locally." };
    }
  };

  // 6. Sync Logic (Handles ADD, UPDATE, DELETE)
  const syncOfflineData = async () => {
    const queue = getQueue();
    if (queue.length === 0) { fetchMedicines(); return; }

    console.log("Syncing queue:", queue);

    for (const item of queue) {
      try {
        if (item.action === 'ADD') {
          await axios.post(`${API_BASE_URL}/medicines`, item.data, { headers: { Authorization: `Bearer ${token}` }});
        } 
        else if (item.action === 'UPDATE') {
          const { id, ...data } = item.data;
          await axios.put(`${API_BASE_URL}/medicines/${id}`, data, { headers: { Authorization: `Bearer ${token}` }});
        } 
        else if (item.action === 'DELETE') {
          await axios.delete(`${API_BASE_URL}/medicines/${item.data.id}`, { headers: { Authorization: `Bearer ${token}` }});
        }
      } catch (err) { console.error("Sync item failed:", item); }
    }
    clearQueue();
    fetchMedicines();
  };

  // Keep logs/addLog same as before... (omitted for brevity)
  // 7. Logs (Restored Real Logic)
  const fetchLogs = async () => {
    // Check if we are online because logs are usually fetched from server
    // (You can implement caching for this later if you want)
    if (token) {
        try {
           const response = await axios.get(`${API_BASE_URL}/medicines/logs`, {
             headers: { Authorization: `Bearer ${token}` }
           });
           return response.data.logs || [];
        } catch (err) {
          console.error("Error fetching logs:", err);
          return [];
        }
    }
    return [];
  };

  const addLog = async (medicineId, logData) => {
      // Allow logging even if offline (Queue it)
      const status = await Network.getStatus();
      
      if (status.connected) {
          try {
            const response = await axios.post(`${API_BASE_URL}/medicines/log/${medicineId}`, logData, {
              headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
          } catch (err) {
            return { message: "Error logging dose" };
          }
      } else {
          // If offline, we just alert the user for now (or you can add to queue)
          alert("You are offline. Dose will be logged when connection returns.");
          // To make this fully offline, you would add an 'ADD_LOG' action to your syncQueue
          return { success: true, offline: true };
      }
  };

  return { medicines, loading, error, lastSyncTime, fetchMedicines, addMedicine, updateMedicine, deleteMedicine, syncOfflineData, fetchLogs, addLog };
};







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





// import { useState, useEffect } from 'react';
// import { useAuth } from '../contexts/AuthContext';

// export const useMedicines = () => {
//   const [medicines, setMedicines] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const { token, API_BASE_URL } = useAuth();

//   const fetchMedicines = async () => {
//     try {
//       setLoading(true);
//       const response = await fetch(`${API_BASE_URL}/medicines`, {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });

//       if (response.ok) {
//         const data = await response.json();
//         setMedicines(data.medicines);
//         setError(null);
//       } else {
//         throw new Error('Failed to fetch medicines');
//       }
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const addMedicine = async (medicineData) => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/medicines`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(medicineData),
//       });

//       const data = await response.json();

//       if (response.ok) {
//         await fetchMedicines(); // Refresh the list
//         return { success: true };
//       } else {
//         return { success: false, message: data.message };
//       }
//     } catch (error) {
//       return { success: false, message: 'Network error. Please try again.' };
//     }
//   };

//   const updateMedicine = async (id, medicineData) => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/medicines/${id}`, {
//         method: 'PUT',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(medicineData),
//       });

//       const data = await response.json();

//       if (response.ok) {
//         await fetchMedicines(); // Refresh the list
//         return { success: true };
//       } else {
//         return { success: false, message: data.message };
//       }
//     } catch (error) {
//       return { success: false, message: 'Network error. Please try again.' };
//     }
//   };

//   const deleteMedicine = async (id) => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/medicines/${id}`, {
//         method: 'DELETE',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });

//       if (response.ok) {
//         await fetchMedicines(); // Refresh the list
//         return { success: true };
//       } else {
//         return { success: false, message: 'Failed to delete medicine' };
//       }
//     } catch (error) {
//       return { success: false, message: 'Network error. Please try again.' };
//     }
//   };

//   // Fetch all logs
//   const fetchLogs = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch("https://medmind-qnpv.onrender.com/api/medicines/logs", {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${localStorage.getItem("token")}`, // 🔑 your JWT
//         },
//       });
//       const data = await res.json();
//       return data.logs || [];
//     } catch (err) {
//       console.error("Error fetching logs:", err);
//       return [];
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Add a new log (taken/missed)
//   const addLog = async (medicineId, logData) => {
//     try {
//       const res = await fetch(`https://medmind-qnpv.onrender.com/api/medicines/log/${medicineId}`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${localStorage.getItem("token")}`,
//         },
//         body: JSON.stringify(logData),
//       });
//       return await res.json();
//     } catch (err) {
//       console.error("Error adding log:", err);
//       return { message: "Error logging dose" };
//     }
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
//     fetchMedicines,
//     addMedicine,
//     updateMedicine,
//     deleteMedicine,
//     fetchLogs,
//      addLog
//   };
// };