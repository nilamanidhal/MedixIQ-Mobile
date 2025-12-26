import React from 'react';
import { X, Check, Clock, AlertCircle } from "lucide-react";

const PendingReviewModal = ({ logs, onAction, onClose }) => {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-blue-600 px-6 py-5 text-white">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Clock className="text-blue-200" size={24} />
                        Daily Review
                    </h2>
                    <p className="text-blue-100 text-sm mt-1">
                        You have {logs.length} pending meds from earlier.
                    </p>
                </div>
                <button 
                    onClick={onClose} 
                    className="text-blue-200 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* List of Pending Items */}
        <div className="max-h-[55vh] overflow-y-auto p-4 space-y-3 bg-slate-50">
            {logs.map((log) => (
                <div key={log._id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                    
                    {/* Medicine Info */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">
                                {log.medicineId?.name || "Medicine"}
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-medium mt-1">
                                <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    {log.medicineId?.dose || log.dose || "Dose"}
                                </span>
                                <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 flex items-center">
                                    <AlertCircle size={10} className="mr-1"/>
                                    Scheduled: {log.time}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
                        <button 
                            onClick={() => onAction(log._id, 'missed')}
                            className="flex items-center justify-center py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm active:scale-95 transition-transform hover:bg-red-100"
                        >
                            <X size={18} className="mr-1.5" />
                            Missed
                        </button>
                        <button 
                            onClick={() => onAction(log._id, 'taken')}
                            className="flex items-center justify-center py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-200 active:scale-95 transition-transform hover:bg-emerald-600"
                        >
                            <Check size={18} className="mr-1.5" />
                            Taken
                        </button>
                    </div>

                </div>
            ))}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 text-center">
            <button onClick={onClose} className="text-slate-400 text-xs font-medium hover:text-slate-600">
                Remind me later
            </button>
        </div>

      </div>
    </div>
  );
};

export default PendingReviewModal;