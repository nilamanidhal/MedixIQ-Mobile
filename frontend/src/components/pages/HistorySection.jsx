import React, { useState } from 'react';
import { useMedicines } from '../../hooks/useMedicines'; 
import { Network } from '@capacitor/network';

const HistorySection = () => {
  const { logs, updateLogStatus, fetchFullHistory } = useMedicines();
  const [loadingMore, setLoadingMore] = useState(false);

  // 1. Get Current Time
  const now = new Date();

  // 2. FILTER & SORT: 
  // - Show ALL 'taken' or 'missed' logs (Past history)
  // - Show 'pending' logs ONLY if they are due (Time has passed)
  const visibleLogs = logs.filter(log => {
      if (log.status !== 'pending') return true; // Always show finished logs
      const logDate = new Date(log.date);
      return logDate <= now; // Only show pending if time has passed
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleLoadMore = async () => {
      const status = await Network.getStatus();
      if (!status.connected) {
          alert("Please connect to internet to view older history.");
          return;
      }
      setLoadingMore(true);
      await fetchFullHistory();
      setLoadingMore(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">📜 History</h2>
      </div>
      
      {visibleLogs.length > 0 ? (
        <div className="space-y-4">
          {visibleLogs.slice(0, loadingMore ? undefined : 20).map((log) => (
            <div key={log._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-800">
                    {log.medicineId?.name || "Medicine"} 
                    {/* Show 'Due' label for pending items */}
                    {log.status === 'pending' && <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded ml-2 font-bold">● Due</span>}
                    {log.pendingSync && <span className="text-xs text-gray-400 ml-2"> (Offline)</span>}
                </p>
                <p className="text-sm text-gray-600">
                    {new Date(log.date).toLocaleDateString()} at {log.time}
                </p>
              </div>
              
              <div>
                {log.status === 'pending' ? (
                  <div className="space-x-2">
                    <button onClick={() => updateLogStatus(log._id, 'taken')} className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">Taken</button>
                    <button onClick={() => updateLogStatus(log._id, 'missed')} className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">Missed</button>
                  </div>
                ) : (
                  <span className={`px-3 py-1 rounded text-white text-sm ${log.status === 'taken' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {log.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
            <p>No due medicines or history.</p>
            <p className="text-xs mt-1">Upcoming medicines will appear here when due.</p>
        </div>
      )}

      <div className="mt-4 text-center">
          <button 
            onClick={handleLoadMore} 
            disabled={loadingMore}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            {loadingMore ? "Loading..." : "Load Full History"}
          </button>
      </div>
    </div>
  );
};

export default HistorySection;








// import React, { useState } from 'react';
// import { useMedicines } from '../../hooks/useMedicines'; 
// import { Network } from '@capacitor/network';

// const HistorySection = () => {
//   const { logs, updateLogStatus, fetchFullHistory } = useMedicines();
//   const [loadingMore, setLoadingMore] = useState(false);

//   // Sort logs: Newest first
//   const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

//   const handleLoadMore = async () => {
//       const status = await Network.getStatus();
//       if (!status.connected) {
//           alert("Please connect to internet to view older history.");
//           return;
//       }
//       setLoadingMore(true);
//       await fetchFullHistory();
//       setLoadingMore(false);
//   };

//   return (
//     <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
//       <div className="flex justify-between items-center mb-4">
//         <h2 className="text-2xl font-bold text-gray-900">📜 History</h2>
//       </div>
      
//       {sortedLogs.length > 0 ? (
//         <div className="space-y-4">
//           {sortedLogs.slice(0, loadingMore ? undefined : 20).map((log) => (
//             <div key={log._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
//               <div>
//                 <p className="font-semibold text-gray-800">
//                     {log.medicineId?.name || "Medicine"} 
//                     {log.status === 'pending' && <span className="text-xs text-orange-500 ml-2 font-bold">● Due</span>}
//                     {log.pendingSync && <span className="text-xs text-gray-400 ml-2"> (Offline)</span>}
//                 </p>
//                 <p className="text-sm text-gray-600">
//                     {new Date(log.date).toLocaleDateString()} at {log.time}
//                 </p>
//               </div>
              
//               <div>
//                 {/* Pending Actions */}
//                 {log.status === 'pending' ? (
//                   <div className="space-x-2">
//                     <button onClick={() => updateLogStatus(log._id, 'taken')} className="px-3 py-1 bg-green-500 text-white rounded text-sm">Taken</button>
//                     <button onClick={() => updateLogStatus(log._id, 'missed')} className="px-3 py-1 bg-red-500 text-white rounded text-sm">Missed</button>
//                   </div>
//                 ) : (
//                   // Completed Status
//                   <span className={`px-3 py-1 rounded text-white text-sm ${log.status === 'taken' ? 'bg-green-600' : 'bg-red-600'}`}>
//                     {log.status.toUpperCase()}
//                   </span>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       ) : (
//         <div className="text-center py-8 text-gray-500">No history found.</div>
//       )}

//       {/* Load More Button */}
//       <div className="mt-4 text-center">
//           <button 
//             onClick={handleLoadMore} 
//             disabled={loadingMore}
//             className="text-blue-600 hover:underline text-sm font-medium"
//           >
//             {loadingMore ? "Loading..." : "Load Full History"}
//           </button>
//       </div>
//     </div>
//   );
// };

// export default HistorySection;





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
