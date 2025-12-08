import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Network } from '@capacitor/network';
import axios from 'axios';

// Import the Utils you created
import { 
  addToQueue, 
  getQueue, 
  clearQueue, 
  saveMedicinesToCache, 
  getCachedMedicines 
} from '../utils/offlineStorage';

import { scheduleMedicineReminder } from '../utils/LocalNotificationManager';

export const useMedicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [networkStatus, setNetworkStatus] = useState({ connected: true });
  
  const { token, API_BASE_URL } = useAuth();

  // 1. Initial Load & Network Listener
  useEffect(() => {
    // Load cached data immediately so user sees something
    const cached = getCachedMedicines();
    if (cached.length > 0) {
      setMedicines(cached);
      setLoading(false);
    }

    // Check initial network status
    Network.getStatus().then(status => setNetworkStatus(status));

    // Listen for network changes
    const listener = Network.addListener('networkStatusChange', status => {
      console.log('Network status changed', status);
      setNetworkStatus(status);
      if (status.connected) {
        syncOfflineData();
      }
    });

    return () => {
      listener.remove();
    };
  }, []);

  // 2. Fetch Medicines (Cache-First Strategy)
  const fetchMedicines = async () => {
    const status = await Network.getStatus();
    
    // Always load cache first to ensure speed
    const cached = getCachedMedicines();
    if(cached.length > 0) setMedicines(cached);

    if (status.connected && token) {
      try {
        // Use axios for cleaner syntax
        const response = await axios.get(`${API_BASE_URL}/medicines`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.medicines) {
          setMedicines(response.data.medicines);
          saveMedicinesToCache(response.data.medicines); // Update Cache
          setError(null);
        }
      } catch (err) {
        console.error("Fetch error, using cache:", err);
        setError('Using offline data');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  // 3. Add Medicine (Handles Online & Offline)
 const addMedicine = async (medicineData) => {
    console.log("🚀 addMedicine called for:", medicineData.name); // DEBUG LOG

    // 1. ALWAYS Schedule the Alarm FIRST (Optimistic UI)
    // This ensures the alarm works even if the server fails or internet is slow.
    try {
        await scheduleMedicineReminder(medicineData);
        console.log("✅ Alarm Scheduled on Phone!");
    } catch (err) {
        console.error("❌ Failed to set alarm:", err);
    }

    const status = await Network.getStatus();

    // 2. Now try to save to Server or Offline Storage
    if (status.connected) {
      // --- ONLINE MODE ---
      try {
        console.log("🌐 Attempting to send to Server...");
        const response = await axios.post(`${API_BASE_URL}/medicines`, medicineData, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 201 || response.status === 200) {
          console.log("✅ Saved to Server DB");
          await fetchMedicines(); // Refresh list
          return { success: true };
        }
      } catch (error) {
        console.error("❌ Server Error:", error);
        // OPTIONAL: If server fails, maybe save to offline queue instead?
        // For now, we just return the error so the UI knows.
        return { success: false, message: error.response?.data?.message || 'Server error' };
      }
    } 
    
    // --- OFFLINE MODE ---
    else {
      try {
        console.log("🔌 Device Offline. Saving locally.");
        const tempId = `temp_${Date.now()}`;
        const tempMedicine = { ...medicineData, _id: tempId, pendingSync: true };

        addToQueue('ADD', medicineData);

        // Update UI immediately
        const updatedList = [...medicines, tempMedicine];
        setMedicines(updatedList);
        saveMedicinesToCache(updatedList);

        return { success: true, message: 'Saved Offline. Will sync when online.' };
      } catch (e) {
        return { success: false, message: 'Could not save offline.' };
      }
    }
  };

  // 4. Sync Function (Runs when internet comes back)
  const syncOfflineData = async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} items to server...`);

    for (const item of queue) {
      try {
        if (item.action === 'ADD') {
          await axios.post(`${API_BASE_URL}/medicines`, item.data, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        // Add logic for DELETE/UPDATE here if needed
      } catch (err) {
        console.error("Sync failed for item:", item, err);
      }
    }

    clearQueue(); // Clear queue after processing
    fetchMedicines(); // Get fresh data with real IDs from server
  };

  // 5. Update Medicine
 const updateMedicine = async (id, medicineData) => {
    // 1. Check Network
    const status = await Network.getStatus();
    if (!status.connected) {
        return { success: false, message: "Connect to internet to update details." };
    }

    try {
      console.log("🔄 Sending Update to Server...");
      
      // 2. Update MongoDB
      await axios.put(`${API_BASE_URL}/medicines/${id}`, medicineData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 3. IMPORTANT: Schedule the NEW Alarm on the Phone
      // We combine the form data with the ID so the notification manager knows who it is
      const medicineWithId = { ...medicineData, _id: id };
      
      console.log("🔔 Rescheduling Alarm for:", medicineData.name);
      await scheduleMedicineReminder(medicineWithId);

      // 4. Refresh List
      await fetchMedicines();
      return { success: true };

    } catch (error) {
      console.error("❌ Update failed:", error);
      return { success: false, message: 'Update failed on server' };
    }
  };

  // 6. Delete Medicine
  const deleteMedicine = async (id) => {
    const status = await Network.getStatus();
    if (!status.connected) return { success: false, message: "Connect to internet to delete." };

    try {
      await axios.delete(`${API_BASE_URL}/medicines/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchMedicines();
      return { success: true };
    } catch (error) {
      return { success: false, message: 'Delete failed' };
    }
  };

  // 7. Logs (History)
  const fetchLogs = async () => {
    // Logs are less critical, so we can keep them mostly online-first
    // or add caching later if needed.
    try {
       const res = await axios.get(`${API_BASE_URL}/medicines/logs`, {
         headers: { Authorization: `Bearer ${token}` }
       });
       return res.data.logs || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const addLog = async (medicineId, logData) => {
     try {
       const res = await axios.post(`${API_BASE_URL}/medicines/log/${medicineId}`, logData, {
         headers: { Authorization: `Bearer ${token}` }
       });
       return res.data;
     } catch (err) {
       return { message: "Error logging dose" };
     }
  };

  useEffect(() => {
    if (token) {
      fetchMedicines();
    }
  }, [token]);

  return {
    medicines,
    loading,
    error,
    networkStatus,
    fetchMedicines,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    fetchLogs,
    addLog,
    syncOfflineData
  };
};





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