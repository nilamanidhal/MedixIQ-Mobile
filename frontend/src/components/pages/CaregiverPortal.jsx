import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Pill, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const CaregiverPortal = () => {
    const { patientId } = useParams();
    const { token, API_BASE_URL } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // We pass the patient name via router state from the previous page
    const patientName = location.state?.patientName || "Patient";

    const [data, setData] = useState({ medicines: [], logs: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPatientData();
    }, [patientId]);

    const fetchPatientData = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/caregiver/patient/${patientId}/data`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await res.json();
            if (res.ok) {
                setData(result);
            } else {
                alert("Unauthorized or session expired.");
                navigate('/family');
            }
        } catch (error) {
            console.error("Error fetching patient data:", error);
        }
        setLoading(false);
    };

    if (loading) {
        return <div className="h-[100dvh] flex items-center justify-center text-indigo-600 font-bold bg-slate-50">Loading Live Data...</div>;
    }

    // Quick calculations for the UI
    const activeMeds = data.medicines.filter(m => m.isActive);
    const todayLogs = data.logs.filter(l => new Date(l.date).toDateString() === new Date().toDateString());

    return (
        // THE FIX: Added h-[100dvh], w-full, overflow-y-auto, and pb-32
        <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 pb-32 font-sans">
            
            {/* Caregiver Header - Sticky so it stays at the top while scrolling */}
            <div className="bg-indigo-600 text-white pt-12 pb-6 px-6 rounded-b-[2rem] shadow-md sticky top-0 z-10 flex-shrink-0 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => navigate('/family')} className="p-2 bg-indigo-500/50 rounded-full hover:bg-indigo-500 active:scale-95 transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-black truncate">Viewing {patientName}</h1>
                </div>
                
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider">Live Status</p>
                        <p className="text-sm font-medium flex items-center gap-1 mt-1">
                            <span className="relative flex h-2 w-2 mr-1">
                                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            Connected
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-6">
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 mb-1">Active Meds</p>
                        <p className="text-2xl font-black text-indigo-600">{activeMeds.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 mb-1">Today's Logs</p>
                        <p className="text-2xl font-black text-emerald-600">{todayLogs.length}</p>
                    </div>
                </div>

                {/* Patient's Medicines */}
                <div className="animate-in slide-in-from-bottom-6 duration-500 delay-100">
                    <h3 className="font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
                        <Pill className="text-indigo-500" size={18}/> Current Medications
                    </h3>
                    <div className="space-y-3">
                        {activeMeds.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-6 text-center">
                                <p className="text-sm text-slate-400 font-bold">No active medications.</p>
                            </div>
                        ) : (
                            activeMeds.map(med => (
                                <div key={med._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div className="min-w-0 pr-4">
                                        <p className="font-bold text-slate-800 text-lg truncate">{med.name}</p>
                                        <p className="text-xs font-medium text-slate-500 truncate">{med.dose} • {med.condition || 'General'}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Schedule</p>
                                        <div className="flex flex-wrap gap-1 justify-end">
                                            {med.times.map((t, i) => (
                                                <span key={i} className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Logs */}
                <div className="animate-in slide-in-from-bottom-8 duration-500 delay-200">
                    <h3 className="font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
                        <Clock className="text-indigo-500" size={18}/> Recent History
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {data.logs.length === 0 ? (
                            <p className="text-sm text-slate-400 font-bold text-center py-6">No logs recorded yet.</p>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {data.logs.slice(0, 10).map(log => {
                                    const isTaken = log.status === 'taken';
                                    return (
                                        <div key={log._id} className="p-4 flex items-center justify-between">
                                            <div className="min-w-0 pr-4">
                                                <p className="text-xs font-bold text-slate-400">{new Date(log.date).toLocaleDateString()} at {log.time}</p>
                                                <p className="font-bold text-slate-700 mt-0.5 truncate">{log.medicineId?.name || 'Unknown Medicine'}</p>
                                            </div>
                                            <span className={`text-[10px] flex-shrink-0 font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl ${isTaken ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                                {log.status}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/*  THE SPACER: Massive invisible block to allow scrolling past bottom nav */}
                <div className="h-32 w-full flex-shrink-0 block"></div>

            </div>
        </div>
    );
};

export default CaregiverPortal;