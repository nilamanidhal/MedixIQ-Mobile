import React, { useState } from 'react';
import { X, Check, Clock, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from 'react-i18next';

// Helper to convert 24hr (14:30) to 12hr (02:30 PM)
const formatTime12Hr = (time24) => {
    if (!time24) return "";
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${m} ${suffix}`;
};

const PendingReviewModal = ({ logs, onAction, onClose }) => {
    const { t } = useTranslation();
  // Track IDs processed in this session to hide them immediately
  const [processingIds, setProcessingIds] = useState(new Set());

  if (!logs || logs.length === 0) return null;

  const handleActionClick = (logId, status) => {
      // Prevent double click
      if (processingIds.has(logId)) return;

      // Add to processing set
      setProcessingIds(prev => new Set(prev).add(logId));

      // Call parent action
      onAction(logId, status);
  };

  // Filter visible logs - Hiding processed ones instantly
  const visibleLogs = logs.filter(log => !processingIds.has(log._id));

  // Auto-close logic
  if (visibleLogs.length === 0 && logs.length > 0) {
      setTimeout(onClose, 300);
      return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      {/* Locked height to 85vh to ensure scrolling works flawlessly */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        <div className="bg-blue-600 px-6 py-5 text-white flex-shrink-0">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Clock className="text-blue-200" size={24} />
                        {t('review.title')}
                    </h2>
                    <p className="text-blue-100 text-sm mt-1">
                       {t('review.pending', { count: visibleLogs.length })}
                    </p>
                </div>
                <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors"><X size={24} /></button>
            </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 min-h-0">
            {visibleLogs.map((log) => {
                const isProcessing = processingIds.has(log._id);
                return (
                    <div key={log._id} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4 transition-opacity duration-300 ${isProcessing ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-slate-800 text-xl leading-tight">
                                    {log.medicineId?.name || t('common.unknown')}
                                </h3>
                                <span className="inline-block text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold mt-1">
                                    {log.medicineId?.dose || log.dose || "Dose"}
                                </span>
                            </div>

                            {/* HUGE 12-Hour Time Badge */}
                            <div className="flex flex-col items-center justify-center bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-center min-w-[80px]">
                                <span className="text-[9px] font-black text-orange-400 uppercase tracking-wider mb-0.5">{t('review.scheduled')}</span>
                                <span className="text-lg font-black text-orange-600 tracking-tighter leading-none">{formatTime12Hr(log.time)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                            <button onClick={() => handleActionClick(log._id, 'missed')} disabled={isProcessing} className="flex items-center justify-center py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm active:scale-95 transition-transform hover:bg-red-100 disabled:opacity-70">
                                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><X size={18} className="mr-1.5" /> {t('review.missed')}</>}
                            </button>
                            <button onClick={() => handleActionClick(log._id, 'taken')} disabled={isProcessing} className="flex items-center justify-center py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-200 active:scale-95 transition-transform hover:bg-emerald-600 disabled:bg-emerald-300">
                                {isProcessing ? <Loader2 size={18} className="animate-spin text-white" /> : <><Check size={18} className="mr-1.5" /> {t('review.taken')}</>}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
        
        <div className="p-4 bg-white border-t border-slate-100 text-center flex-shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <button onClick={onClose} className="text-slate-400 text-sm font-bold hover:text-slate-600 w-full py-2">
                {t('review.remindLater')}
            </button>
        </div>
      </div>
    </div>
  );
};
export default PendingReviewModal;



















// import React, { useState } from 'react';
// import { X, Check, Clock, AlertCircle } from "lucide-react";

// const PendingReviewModal = ({ logs, onAction, onClose }) => {
//   // Track IDs processed in this session to hide them immediately
//   const [processingIds, setProcessingIds] = useState(new Set());

//   if (!logs || logs.length === 0) return null;

//   const handleActionClick = (logId, status) => {
//       // Prevent double clicks
//       if (processingIds.has(logId)) return;

//       // 1. Add to local blacklist immediately
//       setProcessingIds(prev => {
//           const next = new Set(prev);
//           next.add(logId);
//           return next;
//       });

//       // 2. Trigger the actual data update
//       onAction(logId, status);
//   };

//   // Filter visible logs - Hiding processed ones instantly
//   const visibleLogs = logs.filter(log => !processingIds.has(log._id));

//   // If all logs are processed, close the modal automatically (optional nice-to-have)
//   if (visibleLogs.length === 0 && logs.length > 0) {
//       setTimeout(onClose, 300); // Small delay for smooth exit
//       return null; 
//   }

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
//       <div 
//         className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
//         onClick={onClose}
//       ></div>

//       <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
//         <div className="bg-blue-600 px-6 py-5 text-white">
//             <div className="flex items-start justify-between">
//                 <div>
//                     <h2 className="text-xl font-bold flex items-center gap-2">
//                         <Clock className="text-blue-200" size={24} />
//                         Daily Review
//                     </h2>
//                     <p className="text-blue-100 text-sm mt-1">
//                         You have {visibleLogs.length} pending meds.
//                     </p>
//                 </div>
//                 <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors">
//                     <X size={24} />
//                 </button>
//             </div>
//         </div>

//         <div className="max-h-[55vh] overflow-y-auto p-4 space-y-3 bg-slate-50">
//             {visibleLogs.map((log) => (
//                 <div key={log._id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                    
//                     <div className="flex justify-between items-start">
//                         <div>
//                             <h3 className="font-bold text-slate-800 text-lg">
//                                 {log.medicineId?.name || "Medicine"}
//                             </h3>
//                             <div className="flex items-center gap-2 text-xs font-medium mt-1">
//                                 <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
//                                     {log.medicineId?.dose || log.dose || "Dose"}
//                                 </span>
//                                 <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 flex items-center">
//                                     <AlertCircle size={10} className="mr-1"/>
//                                     Scheduled: {log.time}
//                                 </span>
//                             </div>
//                         </div>
//                     </div>

//                     <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
//                         <button 
//                             onClick={() => handleActionClick(log._id, 'missed')}
//                             className="flex items-center justify-center py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm active:scale-95 transition-transform hover:bg-red-100"
//                         >
//                             <X size={18} className="mr-1.5" /> Missed
//                         </button>
//                         <button 
//                             onClick={() => handleActionClick(log._id, 'taken')}
//                             className="flex items-center justify-center py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-200 active:scale-95 transition-transform hover:bg-emerald-600"
//                         >
//                             <Check size={18} className="mr-1.5" /> Taken
//                         </button>
//                     </div>

//                 </div>
//             ))}
//         </div>
        
//         <div className="p-4 bg-white border-t border-slate-100 text-center">
//             <button onClick={onClose} className="text-slate-400 text-xs font-medium hover:text-slate-600">
//                 Remind me later
//             </button>
//         </div>

//       </div>
//     </div>
//   );
// };

// export default PendingReviewModal;










// import React, { useState } from 'react';
// import { X, Check, Clock, AlertCircle, Loader2 } from "lucide-react";

// const PendingReviewModal = ({ logs, onAction, onClose }) => {
//   // Track which IDs are currently being acted upon to prevent double-clicks
//   const [processingIds, setProcessingIds] = useState(new Set());

//   if (!logs || logs.length === 0) return null;

//   const handleActionClick = (logId, status) => {
//       // Prevent double click
//       if (processingIds.has(logId)) return;

//       // Add to processing set
//       setProcessingIds(prev => new Set(prev).add(logId));

//       // Call parent action
//       onAction(logId, status);
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
//       {/* Backdrop */}
//       <div 
//         className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
//         onClick={onClose}
//       ></div>

//       {/* Modal Card */}
//       <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
//         {/* Header */}
//         <div className="bg-blue-600 px-6 py-5 text-white">
//             <div className="flex items-start justify-between">
//                 <div>
//                     <h2 className="text-xl font-bold flex items-center gap-2">
//                         <Clock className="text-blue-200" size={24} />
//                         Daily Review
//                     </h2>
//                     <p className="text-blue-100 text-sm mt-1">
//                         You have {logs.length} pending meds from earlier.
//                     </p>
//                 </div>
//                 <button 
//                     onClick={onClose} 
//                     className="text-blue-200 hover:text-white transition-colors"
//                 >
//                     <X size={24} />
//                 </button>
//             </div>
//         </div>

//         {/* List of Pending Items */}
//         <div className="max-h-[55vh] overflow-y-auto p-4 space-y-3 bg-slate-50">
//             {logs.map((log) => {
//                 const isProcessing = processingIds.has(log._id);

//                 return (
//                     <div key={log._id} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 transition-opacity duration-300 ${isProcessing ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        
//                         {/* Medicine Info */}
//                         <div className="flex justify-between items-start">
//                             <div>
//                                 <h3 className="font-bold text-slate-800 text-lg">
//                                     {log.medicineId?.name || "Medicine"}
//                                 </h3>
//                                 <div className="flex items-center gap-2 text-xs font-medium mt-1">
//                                     <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
//                                         {log.medicineId?.dose || log.dose || "Dose"}
//                                     </span>
//                                     <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 flex items-center">
//                                         <AlertCircle size={10} className="mr-1"/>
//                                         Scheduled: {log.time}
//                                     </span>
//                                 </div>
//                             </div>
//                         </div>

//                         {/* Action Buttons */}
//                         <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
//                             <button 
//                                 onClick={() => handleActionClick(log._id, 'missed')}
//                                 disabled={isProcessing}
//                                 className="flex items-center justify-center py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm active:scale-95 transition-transform hover:bg-red-100 disabled:opacity-70"
//                             >
//                                 {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><X size={18} className="mr-1.5" /> Missed</>}
//                             </button>
//                             <button 
//                                 onClick={() => handleActionClick(log._id, 'taken')}
//                                 disabled={isProcessing}
//                                 className="flex items-center justify-center py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-200 active:scale-95 transition-transform hover:bg-emerald-600 disabled:bg-emerald-300"
//                             >
//                                 {isProcessing ? <Loader2 size={18} className="animate-spin text-white" /> : <><Check size={18} className="mr-1.5" /> Taken</>}
//                             </button>
//                         </div>

//                     </div>
//                 );
//             })}
//         </div>
        
//         {/* Footer */}
//         <div className="p-4 bg-white border-t border-slate-100 text-center">
//             <button onClick={onClose} className="text-slate-400 text-xs font-medium hover:text-slate-600">
//                 Remind me later
//             </button>
//         </div>

//       </div>
//     </div>
//   );
// };

// export default PendingReviewModal;









// import React from 'react';
// import { X, Check, Clock, AlertCircle } from "lucide-react";

// const PendingReviewModal = ({ logs, onAction, onClose }) => {
//   if (!logs || logs.length === 0) return null;

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
//       {/* Backdrop */}
//       <div 
//         className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
//         onClick={onClose}
//       ></div>

//       {/* Modal Card */}
//       <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
//         {/* Header */}
//         <div className="bg-blue-600 px-6 py-5 text-white">
//             <div className="flex items-start justify-between">
//                 <div>
//                     <h2 className="text-xl font-bold flex items-center gap-2">
//                         <Clock className="text-blue-200" size={24} />
//                         Daily Review
//                     </h2>
//                     <p className="text-blue-100 text-sm mt-1">
//                         You have {logs.length} pending meds from earlier.
//                     </p>
//                 </div>
//                 <button 
//                     onClick={onClose} 
//                     className="text-blue-200 hover:text-white transition-colors"
//                 >
//                     <X size={24} />
//                 </button>
//             </div>
//         </div>

//         {/* List of Pending Items */}
//         <div className="max-h-[55vh] overflow-y-auto p-4 space-y-3 bg-slate-50">
//             {logs.map((log) => (
//                 <div key={log._id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                    
//                     {/* Medicine Info */}
//                     <div className="flex justify-between items-start">
//                         <div>
//                             <h3 className="font-bold text-slate-800 text-lg">
//                                 {log.medicineId?.name || "Medicine"}
//                             </h3>
//                             <div className="flex items-center gap-2 text-xs font-medium mt-1">
//                                 <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
//                                     {log.medicineId?.dose || log.dose || "Dose"}
//                                 </span>
//                                 <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 flex items-center">
//                                     <AlertCircle size={10} className="mr-1"/>
//                                     Scheduled: {log.time}
//                                 </span>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Action Buttons */}
//                     <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
//                         <button 
//                             onClick={() => onAction(log._id, 'missed')}
//                             className="flex items-center justify-center py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm active:scale-95 transition-transform hover:bg-red-100"
//                         >
//                             <X size={18} className="mr-1.5" />
//                             Missed
//                         </button>
//                         <button 
//                             onClick={() => onAction(log._id, 'taken')}
//                             className="flex items-center justify-center py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-200 active:scale-95 transition-transform hover:bg-emerald-600"
//                         >
//                             <Check size={18} className="mr-1.5" />
//                             Taken
//                         </button>
//                     </div>

//                 </div>
//             ))}
//         </div>
        
//         {/* Footer */}
//         <div className="p-4 bg-white border-t border-slate-100 text-center">
//             <button onClick={onClose} className="text-slate-400 text-xs font-medium hover:text-slate-600">
//                 Remind me later
//             </button>
//         </div>

//       </div>
//     </div>
//   );
// };

// export default PendingReviewModal;