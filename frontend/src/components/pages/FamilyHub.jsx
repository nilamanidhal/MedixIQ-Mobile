import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Key, Users, Copy, Trash2, ArrowRight, AlertCircle, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const FamilyHub = () => {
    const { token, API_BASE_URL } = useAuth();
    const navigate = useNavigate();
    
    const [patients, setPatients] = useState([]);
    const [myInviteCode, setMyInviteCode] = useState(null);
    const [inputCode, setInputCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [caregivers, setCaregivers] = useState([]);

    // Online status listener
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (isOnline)
        fetchPatients();
        fetchCaregivers();
    }, [isOnline]);

    const fetchPatients = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/caregiver/patients`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setPatients(data);
        } catch (error) {
            console.error("Failed to fetch patients", error);
        }
    };

    const fetchCaregivers = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/caregiver/my-caregivers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setCaregivers(data);
        } catch (error) {
            console.error("Failed to fetch caregivers", error);
        }
    };

    const generateCode = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/caregiver/generate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setMyInviteCode(data.inviteCode);
        } catch (error) {
            alert("Failed to generate code.");
        }
        setLoading(false);
    };

    const linkAccount = async (e) => {
        e.preventDefault();
        if (!inputCode.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/caregiver/link`, {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ inviteCode: inputCode.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                alert("Successfully linked!");
                setInputCode('');
                fetchPatients(); // Refresh the list
            } else {
                alert(data.error || "Invalid code");
            }
        } catch (error) {
            alert("Failed to link account.");
        }
        setLoading(false);
    };

    const removeLink = async (linkId) => {
        if (!window.confirm("Are you sure you want to remove this patient?")) return;
        try {
            const res = await fetch(`${API_BASE_URL}/caregiver/remove/${linkId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok)
                 fetchPatients();
                 fetchCaregivers();
        } catch (error) {
            alert("Failed to remove.");
        }
    };

    if (!isOnline) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
                    <WifiOff size={40} />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Offline Mode</h2>
                <p className="text-slate-500">Caregiver features require an active internet connection to ensure medical data is live and accurate.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-indigo-600 text-white pt-12 pb-6 px-6 rounded-b-[2rem] shadow-md">
                <h1 className="text-2xl font-black flex items-center gap-2">
                    <Users size={28} /> Family & Caregivers
                </h1>
                <p className="text-indigo-200 mt-1 text-sm font-medium">Manage and view your family's health.</p>
            </div>

            <div className="p-5 space-y-6">
                
                {/* Section 1: Enter a Code (Caregiver Side) */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                        <HeartPulse className="text-indigo-500" size={20}/> Care for Someone
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Enter a 6-digit invite code to view someone's live health data.</p>
                    <form onSubmit={linkAccount} className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="e.g. 842915" 
                            value={inputCode}
                            onChange={(e) => setInputCode(e.target.value)}
                            maxLength={6}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center tracking-widest font-bold text-lg focus:outline-none focus:border-indigo-500"
                        />
                        <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-5 rounded-xl font-bold active:scale-95 transition-transform">
                            Link
                        </button>
                    </form>
                </div>

                {/* Section 2: People I Care For (The List) */}
                <div>
                    <h3 className="font-bold text-slate-800 mb-3 px-1">People I Care For</h3>
                    {patients.length === 0 ? (
                        <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
                            <p className="text-sm text-slate-400 font-medium">You haven't linked any patients yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {patients.map(patient => (
                                <div key={patient.linkId} onClick={() => navigate(`/caregiver/patient/${patient.patientId}`, { state: { patientName: patient.name } })} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-black text-lg">
                                            {patient.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{patient.name}</p>
                                            <p className="text-xs font-medium text-slate-500">{patient.age} yrs • {patient.gender}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); removeLink(patient.linkId); }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                                            <Trash2 size={18} />
                                        </button>
                                        <ArrowRight className="text-slate-300" size={20} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 3: Generate a Code (Patient Side) */}
                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 mt-8">
                    <h3 className="font-bold text-emerald-800 flex items-center gap-2 mb-2">
                        <Key className="text-emerald-500" size={20}/> Share My Data
                    </h3>
                    <p className="text-xs text-emerald-600/80 mb-4">Generate a secure 15-minute code to allow a family member to monitor your medicines.</p>
                    
                    {myInviteCode ? (
                        <div className="bg-white border-2 border-emerald-500 rounded-xl p-4 text-center">
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Your Code</p>
                            <p className="text-3xl font-black text-slate-800 tracking-[0.2em]">{myInviteCode}</p>
                            <p className="text-[10px] text-slate-400 mt-2 flex items-center justify-center gap-1"><AlertCircle size={10}/> Expires in 15 minutes</p>
                        </div>
                    ) : (
                        <button onClick={generateCode} disabled={loading} className="w-full bg-white text-emerald-600 border border-emerald-200 py-3 rounded-xl font-bold shadow-sm active:scale-95 transition-transform">
                            Generate Invite Code
                        </button>
                    )}
                </div>

                {/* Section 4: Who Has Access To My Data (Patient Side) */}
                <div className="mt-8">
                    <h3 className="font-bold text-slate-800 mb-3 px-1">People Caring For Me</h3>
                    {caregivers.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-200">
                            <p className="text-sm text-slate-400 font-medium">No one currently has access to your data.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {caregivers.map(caregiver => (
                                <div key={caregiver.linkId} className="bg-white p-4 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center font-black">
                                            {caregiver.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{caregiver.name}</p>
                                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider text-emerald-600">Active Access</p>
                                        </div>
                                    </div>
                                    
                                    {/* Patient can click this to kick the caregiver out */}
                                    <button 
                                        onClick={() => removeLink(caregiver.linkId)} 
                                        className="text-xs font-bold bg-red-50 text-red-600 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                                    >
                                        Revoke
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>


            </div>
        </div>
    );
};

export default FamilyHub;812087