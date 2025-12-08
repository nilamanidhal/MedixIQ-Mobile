import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useMedicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token, API_BASE_URL } = useAuth();

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/medicines`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMedicines(data.medicines);
        setError(null);
      } else {
        throw new Error('Failed to fetch medicines');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addMedicine = async (medicineData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/medicines`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(medicineData),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchMedicines(); // Refresh the list
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const updateMedicine = async (id, medicineData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/medicines/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(medicineData),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchMedicines(); // Refresh the list
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const deleteMedicine = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/medicines/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await fetchMedicines(); // Refresh the list
        return { success: true };
      } else {
        return { success: false, message: 'Failed to delete medicine' };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  // Fetch all logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("https://medmind-qnpv.onrender.com/api/medicines/logs", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`, // 🔑 your JWT
        },
      });
      const data = await res.json();
      return data.logs || [];
    } catch (err) {
      console.error("Error fetching logs:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Add a new log (taken/missed)
  const addLog = async (medicineId, logData) => {
    try {
      const res = await fetch(`https://medmind-qnpv.onrender.com/api/medicines/log/${medicineId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(logData),
      });
      return await res.json();
    } catch (err) {
      console.error("Error adding log:", err);
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
    fetchMedicines,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    fetchLogs,
     addLog
  };
};