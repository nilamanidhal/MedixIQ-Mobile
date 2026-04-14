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
        return <div className="min-h-screen flex items-center justify-center text-indigo-600 font-bold">Loading Live Data...</div>;
    }

    // Quick calculations for the UI
    const activeMeds = data.medicines.filter(m => m.isActive);
    const todayLogs = data.logs.filter(l => new Date(l.date).toDateString() === new Date().toDateString());

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Caregiver Header - Distinct Purple/Indigo to prevent confusion */}
            <div className="bg-indigo-600 text-white pt-12 pb-6 px-6 rounded-b-[2rem] shadow-md sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => navigate('/family')} className="p-2 bg-indigo-500/50 rounded-full hover:bg-indigo-500 transition-colors">
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
                <div className="grid grid-cols-2 gap-3">
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
                <div>
                    <h3 className="font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
                        <Pill className="text-indigo-500" size={18}/> Current Medications
                    </h3>
                    <div className="space-y-3">
                        {activeMeds.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">No active medications.</p>
                        ) : (
                            activeMeds.map(med => (
                                <div key={med._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-slate-800 text-lg">{med.name}</p>
                                        <p className="text-xs font-medium text-slate-500">{med.dose} • {med.condition || 'General'}</p>
                                    </div>
                                    <div className="text-right">
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
                <div>
                    <h3 className="font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
                        <Clock className="text-indigo-500" size={18}/> Recent History
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {data.logs.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-6">No logs recorded yet.</p>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {data.logs.slice(0, 10).map(log => {
                                    const isTaken = log.status === 'taken';
                                    return (
                                        <div key={log._id} className="p-4 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400">{new Date(log.date).toLocaleDateString()} at {log.time}</p>
                                                <p className="font-bold text-slate-700 mt-0.5">{log.medicineId?.name || 'Unknown Medicine'}</p>
                                            </div>
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${isTaken ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {log.status.toUpperCase()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CaregiverPortal;