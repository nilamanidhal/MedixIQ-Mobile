import React, { useEffect, useState } from 'react';
import { useMedicines } from '../../hooks/useMedicines'; 

const HistorySection = ({ forceUpdateKey }) => {
  // 1. Get the new functions from the Hook
  const { fetchLogs, updateLogStatus, syncOfflineData } = useMedicines();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load Data
  const loadLogs = async () => {
    try {
      setLoading(true);
      // Attempt sync first so we get the latest data
      await syncOfflineData(); 
      const data = await fetchLogs();
      setLogs(data);
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Reload when component mounts or when Dashboard triggers an update (via notification)
  useEffect(() => {
    loadLogs();
  }, [forceUpdateKey]);

  // Handle "Taken" / "Missed" Click
  const handleLog = async (log, status) => {
    // A. OPTIMISTIC UPDATE (Instant UI Change)
    const originalLogs = [...logs];
    const updatedLogs = logs.map(l => 
        l._id === log._id ? { ...l, status: status } : l
    );
    setLogs(updatedLogs); // Update screen immediately

    // B. CALL HOOK (Handles Offline/Online Logic)
    const result = await updateLogStatus(log._id, status);

    // C. HANDLE ERRORS
    if (result.success) {
      // Optional: console.log(result.message);
      // We don't need to reload here because we already updated the UI in step A
    } else {
      alert(result.message || "Failed to update log.");
      setLogs(originalLogs); // Revert UI on failure
    }
  };

  if (loading && logs.length === 0) return <div className="p-6 text-center text-gray-500">Loading history...</div>;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">📜 Medicine History</h2>
        <button onClick={loadLogs} className="text-sm text-blue-600 hover:underline">
            Refresh
        </button>
      </div>
      
      {logs.length > 0 ? (
        <div className="space-y-4">
          {logs.slice(0, 20).map((log) => (
            <div key={log._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-800">
                    {log.medicineId?.name || "Unknown"} 
                    <span className="text-xs text-gray-500 ml-2">({log.medicineId?.dose})</span>
                </p>
                <p className="text-sm text-gray-600">
                    {new Date(log.date).toLocaleDateString()} at {log.time}
                </p>
              </div>
              
              <div>
                {log.status === 'pending' ? (
                  <div className="space-x-2">
                    <button
                      onClick={() => handleLog(log, 'taken')}
                      className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                    >
                      Taken
                    </button>

                    <button
                      onClick={() => handleLog(log, 'missed')}
                      className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                    >
                      Missed
                    </button>
                  </div>
                ) : (
                  <span className={`px-3 py-1 rounded-md text-white font-medium text-sm ${
                      log.status === 'taken' ? 'bg-green-600' : 'bg-red-600'
                  }`}>
                    {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No history records found.</p>
            <p className="text-xs text-gray-400 mt-1">Logs are generated daily for active medicines.</p>
        </div>
      )}
    </div>
  );
};

export default HistorySection;





// import React, { useEffect, useState } from 'react';
// import { useMedicines } from '../../hooks/useMedicines';

// const HistorySection = () => {
//   const { fetchLogs, addLog } = useMedicines();
//   const [logs, setLogs] = useState([]);

//   useEffect(() => {
//     const load = async () => {
//       const data = await fetchLogs();
//       setLogs(data);
//     };
//     load();
//   }, []);

//  const handleLog = async (log, status) => {
//   try {
//     const response = await fetch(`https://medmind-qnpv.onrender.com/api/medicines/logs/${log._id}`, {
//       method: "PUT",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${localStorage.getItem("token")}`
//       },
//       body: JSON.stringify({ status })   // ✅ sending status properly
//     });

//     const data = await response.json();

//     if (!response.ok) {
//       alert(data.message || "Something went wrong");
//       return;
//     }

//     alert(data.message);

//     // refresh logs
//     const updated = await fetchLogs();
//     setLogs(updated);
//   } catch (error) {
//     console.error("Error updating log:", error);
//     alert("Error updating log");
//   }
// };


//   return (
//     <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
//       <h2 className="text-2xl font-bold text-gray-900 mb-4">📜 Medicine History</h2>
//       {logs.length > 0 ? (
//         <div className="space-y-4">
//           {logs.slice(0, 20).map((log) => (
//             <div key={log._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
//               <div>
//                 <p className="font-semibold">{log.medicineId?.name} ({log.medicineId?.dose})</p>
//                 <p className="text-sm text-gray-600">{new Date(log.date).toLocaleDateString()} at {log.time}</p>
//               </div>
//               <div>
//                 {log.status === 'pending' ? (
//                   <div className="space-x-2">
//                    <button
//   onClick={() => handleLog(log, 'taken')}
//   className="px-3 py-1 bg-green-500 text-white rounded-md"
// >
//   Taken
// </button>

// <button
//   onClick={() => handleLog(log, 'missed')}
//   className="px-3 py-1 bg-red-500 text-white rounded-md"
// >
//   Missed
// </button>

//                   </div>
//                 ) : (
//                   <span className={`px-3 py-1 rounded-md text-white ${log.status === 'taken' ? 'bg-green-500' : 'bg-red-500'}`}>
//                     {log.status}
//                   </span>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       ) : (
//         <p className="text-gray-600">No history yet</p>
//       )}
//     </div>
//   );
// };

// export default HistorySection;
