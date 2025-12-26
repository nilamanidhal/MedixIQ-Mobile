import React, { useState } from 'react';
import { useMedicines } from '../../hooks/useMedicines'; 
import { Network } from '@capacitor/network';
import { 
    Check, 
    X, 
    Clock, 
    Calendar, 
    ChevronDown, 
    AlertCircle 
} from "lucide-react";

const HistorySection = () => {
    const { logs, updateLogStatus, fetchFullHistory } = useMedicines();
    const [loadingMore, setLoadingMore] = useState(false);

    const now = new Date();

    // 1. FILTER: Show Past Logs + Due Pending Logs
    const visibleLogs = logs.filter(log => {
        if (log.status !== 'pending') return true; 
        const logDate = new Date(log.date);
        return logDate <= now; 
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    // 2. GROUP BY DATE HELPER
    const groupLogsByDate = (logs) => {
        const groups = {};
        logs.forEach(log => {
            const dateObj = new Date(log.date);
            const dateStr = dateObj.toLocaleDateString([], { 
                weekday: 'long', month: 'short', day: 'numeric' 
            });
            
            // Check for Today/Yesterday
            const todayStr = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

            let header = dateStr;
            if (dateStr === todayStr) header = "Today";
            else if (dateStr === yesterdayStr) header = "Yesterday";

            if (!groups[header]) groups[header] = [];
            groups[header].push(log);
        });
        return groups;
    };

    const groupedLogs = groupLogsByDate(visibleLogs.slice(0, loadingMore ? undefined : 20));

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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-24">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="text-blue-500" size={20} /> History Log
                </h2>
                <span className="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200">
                    {visibleLogs.length} Entries
                </span>
            </div>

            {/* List Content */}
            {Object.keys(groupedLogs).length > 0 ? (
                <div>
                    {Object.entries(groupedLogs).map(([dateLabel, dayLogs]) => (
                        <div key={dateLabel}>
                            {/* Sticky Date Header */}
                            <div className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur-sm px-5 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide border-y border-slate-200/50">
                                {dateLabel}
                            </div>

                            {/* Logs for this Date */}
                            <div className="divide-y divide-slate-100">
                                {dayLogs.map((log) => {
                                    const isPending = log.status === 'pending';
                                    const isTaken = log.status === 'taken';
                                    const isMissed = log.status === 'missed' || log.status === 'skipped';

                                    return (
                                        <div key={log._id} className={`flex justify-between items-center p-4 transition-colors ${isPending ? 'bg-orange-50/30' : 'hover:bg-slate-50'}`}>
                                            
                                            {/* Left Info */}
                                            <div className="flex items-center gap-4">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    isTaken ? 'bg-green-500' : isMissed ? 'bg-red-500' : 'bg-orange-400 animate-pulse'
                                                }`}></div>
                                                
                                                <div>
                                                    <p className={`font-semibold text-sm ${isPending ? 'text-slate-900' : 'text-slate-700'}`}>
                                                        {log.medicineId?.name || "Unknown Medicine"}
                                                        {log.pendingSync && (
                                                            <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                                                Syncing...
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5 font-medium flex items-center">
                                                        {log.time} 
                                                        {isPending && <span className="ml-1 text-orange-500 font-bold">• Due Now</span>}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Right Actions / Status */}
                                            <div>
                                                {isPending ? (
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => updateLogStatus(log._id, 'taken')} 
                                                            className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 active:scale-90 transition-all shadow-sm"
                                                            title="Mark Taken"
                                                        >
                                                            <Check size={18} strokeWidth={3} />
                                                        </button>
                                                        <button 
                                                            onClick={() => updateLogStatus(log._id, 'missed')} 
                                                            className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 active:scale-90 transition-all shadow-sm"
                                                            title="Mark Missed"
                                                        >
                                                            <X size={18} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                                                        isTaken 
                                                            ? 'bg-green-50 text-green-700 border-green-200' 
                                                            : 'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                        {isTaken ? <Check size={12} /> : <X size={12} />}
                                                        {log.status.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Calendar className="text-slate-300" size={32} />
                    </div>
                    <p className="text-slate-500 font-medium">No history yet.</p>
                    <p className="text-slate-400 text-xs mt-1 max-w-[200px]">
                        Your medication logs will appear here organized by date.
                    </p>
                </div>
            )}

            {/* Load More Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
                <button 
                    onClick={handleLoadMore} 
                    disabled={loadingMore}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 w-full py-2"
                >
                    {loadingMore ? (
                        <span className="animate-pulse">Loading...</span>
                    ) : (
                        <>
                            Load Older History <ChevronDown size={14} />
                        </>
                    )}
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

//   // 1. Get Current Time
//   const now = new Date();

//   // 2. FILTER & SORT: 
//   // - Show ALL 'taken' or 'missed' logs (Past history)
//   // - Show 'pending' logs ONLY if they are due (Time has passed)
//   const visibleLogs = logs.filter(log => {
//       if (log.status !== 'pending') return true; // Always show finished logs
//       const logDate = new Date(log.date);
//       return logDate <= now; // Only show pending if time has passed
//   }).sort((a, b) => new Date(b.date) - new Date(a.date));

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
      
//       {visibleLogs.length > 0 ? (
//         <div className="space-y-4">
//           {visibleLogs.slice(0, loadingMore ? undefined : 20).map((log) => (
//             <div key={log._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
//               <div>
//                 <p className="font-semibold text-gray-800">
//                     {log.medicineId?.name || "Medicine"} 
//                     {/* Show 'Due' label for pending items */}
//                     {log.status === 'pending' && <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded ml-2 font-bold">● Due</span>}
//                     {log.pendingSync && <span className="text-xs text-gray-400 ml-2"> (Offline)</span>}
//                 </p>
//                 <p className="text-sm text-gray-600">
//                     {new Date(log.date).toLocaleDateString()} at {log.time}
//                 </p>
//               </div>
              
//               <div>
//                 {log.status === 'pending' ? (
//                   <div className="space-x-2">
//                     <button onClick={() => updateLogStatus(log._id, 'taken')} className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">Taken</button>
//                     <button onClick={() => updateLogStatus(log._id, 'missed')} className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">Missed</button>
//                   </div>
//                 ) : (
//                   <span className={`px-3 py-1 rounded text-white text-sm ${log.status === 'taken' ? 'bg-green-600' : 'bg-red-600'}`}>
//                     {log.status.toUpperCase()}
//                   </span>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       ) : (
//         <div className="text-center py-8 text-gray-500">
//             <p>No due medicines or history.</p>
//             <p className="text-xs mt-1">Upcoming medicines will appear here when due.</p>
//         </div>
//       )}

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
