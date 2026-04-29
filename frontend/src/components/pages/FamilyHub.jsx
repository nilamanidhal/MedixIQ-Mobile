import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    HeartPulse, Key, Users, Copy, Trash2, ArrowRight, 
    AlertCircle, WifiOff, Shield, CheckCircle2, UserPlus 
} from 'lucide-react';
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
    const [copied, setCopied] = useState(false); 

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
        if (isOnline) {
            fetchPatients();
            fetchCaregivers();
        }
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
                setInputCode('');
                fetchPatients(); 
            } else {
                alert(data.error || "Invalid code");
            }
        } catch (error) {
            alert("Failed to link account.");
        }
        setLoading(false);
    };

    const removeLink = async (linkId) => {
        if (!window.confirm("Are you sure you want to revoke this access?")) return;
        try {
            const res = await fetch(`${API_BASE_URL}/caregiver/remove/${linkId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                 fetchPatients();
                 fetchCaregivers();
            }
        } catch (error) {
            alert("Failed to remove.");
        }
    };

    const handleCopy = () => {
        if (myInviteCode) {
            navigator.clipboard.writeText(myInviteCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!isOnline) {
        return (
            <div className="h-[100dvh] w-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500 shadow-sm border border-red-100">
                    <WifiOff size={40} strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Offline Mode</h2>
                <p className="text-slate-500 font-medium px-4 leading-relaxed">
                    Family features require an active internet connection to ensure medical data is live and secure.
                </p>
            </div>
        );
    }

    return (
        //  THE BULLETPROOF FIX: h-[100dvh] (Dynamic Viewport Height) + overflow-y-auto + pb-32
        <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 font-sans pb-32">
            
            {/* --- PREMIUM HEADER --- */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white pt-14 pb-8 px-6 rounded-b-[2.5rem] shadow-[0_10px_30px_rgba(79,70,229,0.15)] relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                
                <h1 className="text-2xl font-black flex items-center gap-2.5 relative z-10 tracking-tight">
                    <Users size={28} strokeWidth={2.5} /> Family Hub
                </h1>
                <p className="text-blue-100 mt-2 text-sm font-medium relative z-10 opacity-90">
                    Securely share and monitor health data.
                </p>
            </div>

            <div className="p-5 space-y-8 -mt-2">
                
                {/* --- SECTION 1: LINK A PATIENT (CAREGIVER VIEW) --- */}
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">For Caregivers</h3>
                    <div className="bg-white p-5 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100/60 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                        
                        <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-lg">
                            <UserPlus className="text-blue-500" size={20} strokeWidth={2.5}/> Care for Someone
                        </h4>
                        <p className="text-[13px] text-slate-500 mb-5 font-medium leading-relaxed">
                            Enter the 6-digit invite code generated by your family member to monitor their live health data.
                        </p>
                        
                        <form onSubmit={linkAccount} className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="000000" 
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3.5 text-center tracking-[0.2em] font-black text-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300"
                            />
                            <button 
                                type="submit" 
                                disabled={loading || inputCode.length < 6} 
                                className="flex-shrink-0 bg-slate-900 text-white px-5 rounded-2xl font-bold shadow-md shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                            >
                                Link
                            </button>
                        </form>
                    </div>
                </div>

                {/* --- SECTION 2: PEOPLE I CARE FOR --- */}
                <div className="animate-in slide-in-from-bottom-6 duration-500 delay-100">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Monitoring List</h3>
                    {patients.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                            <HeartPulse className="mx-auto text-slate-300 mb-3" size={32} />
                            <p className="text-sm text-slate-400 font-bold">No linked patients yet.</p>
                            <p className="text-xs text-slate-400 mt-1">Enter a code above to start monitoring.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {patients.map(patient => (
                                <div 
                                    key={patient.linkId} 
                                    onClick={() => navigate(`/caregiver/patient/${patient.patientId}`, { state: { patientName: patient.name } })} 
                                    className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100/60 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner border border-white flex-shrink-0">
                                            {patient.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-lg tracking-tight truncate">{patient.name}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                                                <Shield size={12} className="text-blue-400 flex-shrink-0"/> Monitoring Active
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeLink(patient.linkId); }} 
                                            className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <div className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 rounded-full group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                            <ArrowRight size={18} strokeWidth={2.5} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="h-px bg-slate-200/60 w-full my-6"></div>

                {/* --- SECTION 3: SHARE MY DATA (PATIENT VIEW) --- */}
                <div className="animate-in slide-in-from-bottom-8 duration-500 delay-200">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">For Patients</h3>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50/30 p-5 rounded-3xl border border-emerald-100/60 shadow-[0_4px_20px_rgb(0,0,0,0.02)] relative">
                        <h4 className="font-bold text-emerald-900 flex items-center gap-2 mb-2 text-lg">
                            <Key className="text-emerald-500" size={20} strokeWidth={2.5}/> Share My Data
                        </h4>
                        <p className="text-[13px] text-emerald-700/80 mb-5 font-medium leading-relaxed pr-4">
                            Generate a highly secure, temporary code to allow a family member to monitor your medications and receive alerts.
                        </p>
                        
                        {myInviteCode ? (
                            <div className="bg-white border border-emerald-200 rounded-2xl p-5 text-center shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400"></div>
                                <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Secure Invite Code</p>
                                <p className="text-3xl sm:text-4xl font-black text-slate-800 tracking-[0.2em] mb-4 break-words">{myInviteCode}</p>
                                
                                <div className="flex gap-3">
                                    <button 
                                        onClick={handleCopy}
                                        className="flex-1 bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
                                    >
                                        {copied ? <CheckCircle2 size={18}/> : <Copy size={18}/>}
                                        {copied ? 'Copied!' : 'Copy Code'}
                                    </button>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 mt-4 flex items-center justify-center gap-1.5">
                                    <AlertCircle size={12}/> Auto-expires in 15 minutes
                                </p>
                            </div>
                        ) : (
                            <button 
                                onClick={generateCode} 
                                disabled={loading} 
                                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base"
                            >
                                <Shield size={18} /> Generate Secure Code
                            </button>
                        )}
                    </div>
                </div>

                {/* --- SECTION 4: MY CAREGIVERS --- */}
                <div className="animate-in slide-in-from-bottom-10 duration-500 delay-300">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">People Accessing My Data</h3>
                    {caregivers.length === 0 ? (
                        <div className="text-center py-6 bg-slate-100/50 rounded-3xl border border-slate-100">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No active caregivers</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {caregivers.map(caregiver => (
                                <div key={caregiver.linkId} className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100/60 flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-black text-lg border border-emerald-100 flex-shrink-0">
                                            {caregiver.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-base truncate">{caregiver.name}</p>
                                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1 mt-0.5 truncate">
                                                <CheckCircle2 size={10} className="flex-shrink-0"/> Access Granted
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => removeLink(caregiver.linkId)} 
                                        className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-600 px-4 py-2.5 rounded-xl active:scale-95 transition-transform hover:bg-red-100 ml-2"
                                    >
                                        Revoke
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Massive bottom spacer block so you can scroll past the bottom navigation */}
                <div className="h-32 w-full flex-shrink-0 block"></div>

            </div>
        </div>
    );
};

export default FamilyHub;