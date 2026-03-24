import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useMedicines } from '../../hooks/useMedicines'; // Your existing hook
import QRCardDisplay from '../QRCardDisplay';
import { useSentinel } from '../../hooks/useSentinel'; // ← add karo
import LoadingSpinner from '../LoadingSpinner';
import { ShieldAlert, Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EmergencySetupPage = () => {
    const { token: authToken, API_BASE_URL, user } = useAuth();
    const { medicines } = useMedicines();
    const navigate = useNavigate();
    const { saveEmergencyDataForNative } = useSentinel(); // ← add karo
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profileExists, setProfileExists] = useState(false);
    const [qrToken, setQrToken] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: user?.name || '',
        age: '',
        bloodGroup: 'O+',
        allergies: [''],
        conditions: [''],
        medicines: [],
        emergencyContacts: [{ name: '', phone: '', relation: 'Family' }],
        doctorName: '',
        doctorPhone: ''
    });

    // 1. Fetch Existing Profile
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/emergency/profile`, {
                    headers: { Authorization: `Bearer ${authToken}` }
                });
                if (res.data.profile) {
                    setProfileExists(true);
                    setQrToken(res.data.profile.token);
                    
                    // Merge DB data with current active medicines
                    const dbData = res.data.profile.publicData;
                    
                    // Auto-sync medicines from Medicine.js hook
                    const activeMeds = medicines.filter(m => m.isActive).map(m => {
                        const existingPref = dbData.medicines?.find(dbM => dbM.name === m.name);
                        return {
                            name: m.name,
                            dosage: m.dose,
                            frequency: m.times.join(', '),
                            isPublic: existingPref ? existingPref.isPublic : true
                        };
                    });

                    setFormData({
                        ...dbData,
                        medicines: activeMeds,
                        allergies: dbData.allergies?.length ? dbData.allergies : [''],
                        conditions: dbData.conditions?.length ? dbData.conditions : [''],
                        emergencyContacts: dbData.emergencyContacts?.length ? dbData.emergencyContacts : [{ name: '', phone: '', relation: 'Family' }]
                    });
                }
            } catch (err) {
                // 404 means no profile yet, which is fine.
                if (err.response?.status === 404) {
                    // Populate initial meds
                    const activeMeds = medicines.filter(m => m.isActive).map(m => ({
                        name: m.name,
                        dosage: m.dose,
                        frequency: m.times.join(', '),
                        isPublic: true
                    }));
                    setFormData(prev => ({ ...prev, medicines: activeMeds }));
                }
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [authToken, API_BASE_URL, medicines]);

    // 2. Handlers for dynamic arrays
    const handleArrayChange = (index, field, value) => {
        const newArr = [...formData[field]];
        newArr[index] = value;
        setFormData({ ...formData, [field]: newArr });
    };

    const addArrayItem = (field) => setFormData({ ...formData, [field]: [...formData[field], ''] });
    const removeArrayItem = (index, field) => {
        const newArr = formData[field].filter((_, i) => i !== index);
        setFormData({ ...formData, [field]: newArr.length ? newArr : [''] });
    };



    // 3. Save Profile
  const handleSave = async () => {
    setSaving(true);
    try {
        const cleanData = {
            ...formData,
            allergies: formData.allergies.filter(a => a.trim() !== ''),
            conditions: formData.conditions.filter(c => c.trim() !== ''),
            emergencyContacts: formData.emergencyContacts.filter(
                c => c.name.trim() !== '' && c.phone.trim() !== ''
            )
        };

        const endpoint = profileExists ? '/emergency/update' : '/emergency/setup';
        const method = profileExists ? 'put' : 'post';

        const res = await axios[method](
            `${API_BASE_URL}${endpoint}`,
            { publicData: cleanData },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );

        if (!profileExists) {
            setProfileExists(true);
            setQrToken(res.data.profile.token);
        }

        // ✅ Native mein bhi save karo — direct data pass karo
        await saveEmergencyDataForNative(cleanData);

        // ✅ Preferences mein bhi store karo future ke liye
        await Preferences.set({
            key: 'emergency_profile_native',
            value: JSON.stringify({
                name: cleanData.name,
                bloodGroup: cleanData.bloodGroup,
                allergies: cleanData.allergies.join(', '),
                meds: cleanData.medicines?.filter(m => m.isPublic)?.map(m => m.name)?.join(', ') || 'None',
                emergencyPhone: cleanData.emergencyContacts?.[0]?.phone || '',
            })
        });

        alert("Emergency Profile Saved!");
} catch (err) {
    console.error("Full error:", err);
    console.error("Response:", err?.response?.data);
    
    const msg = err?.response?.data?.message 
        || err?.response?.data?.error
        || err?.message
        || "Unknown error";
    alert("Error: " + msg);
} finally {
        setSaving(false);
    }
};


    
    if (loading) return <LoadingSpinner text="Loading Profile..." />;

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-red-600 px-6 pt-12 pb-6 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-3 text-white mb-2">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-red-700 rounded-full transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <ShieldAlert /> Emergency Profile
                    </h1>
                </div>
                <p className="text-red-100 text-sm ml-11">Set up your Medical ID and QR Card.</p>
            </div>

            <div className="p-4 space-y-6 max-w-lg mx-auto">
                
                {/* QR Display (Only if profile exists) */}
                {profileExists && qrToken && (
                    <QRCardDisplay 
                        token={qrToken} 
                        profileData={formData} 
                        onTokenRegenerated={setQrToken} 
                    />
                )}

                {/* --- FORM SECTION --- */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Basic Info</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" />
                        <div className="flex gap-3">
                            <input type="number" placeholder="Age" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-1/2 p-3 bg-slate-50 rounded-xl border border-slate-200" />
                            <select value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})} className="w-1/2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 text-red-600">Allergies (Critical)</h3>
                    {formData.allergies.map((allergy, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                            <input type="text" placeholder="e.g. Peanuts, Penicillin" value={allergy} onChange={e => handleArrayChange(index, 'allergies', e.target.value)} className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200" />
                            <button onClick={() => removeArrayItem(index, 'allergies')} className="p-3 text-red-400 hover:text-red-600"><Trash2 size={20}/></button>
                        </div>
                    ))}
                    <button onClick={() => addArrayItem('allergies')} className="text-sm font-bold text-indigo-600 flex items-center gap-1 mt-2"><Plus size={16}/> Add Allergy</button>
                </div>

                {/* Add similar blocks for Conditions and Emergency Contacts based on formData structure */}
                {/* Emergency Contact (Critical for SMS) */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 text-red-600">Emergency Contact (SMS Alert)</h3>
                    <p className="text-xs text-slate-500 mb-3">This number will receive the automatic SMS if you are in an accident.</p>
                    
                    {formData.emergencyContacts.map((contact, index) => (
                        <div key={index} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <input 
                                type="text" 
                                placeholder="Contact Name (e.g., Mom, Spouse)" 
                                value={contact.name} 
                                onChange={e => {
                                    const newContacts = [...formData.emergencyContacts];
                                    newContacts[index].name = e.target.value;
                                    setFormData({...formData, emergencyContacts: newContacts});
                                }} 
                                className="w-full p-3 bg-white rounded-xl border border-slate-200" 
                            />
                            <input 
                                type="tel" 
                                placeholder="Phone Number (include country code)" 
                                value={contact.phone} 
                                onChange={e => {
                                    const newContacts = [...formData.emergencyContacts];
                                    newContacts[index].phone = e.target.value;
                                    setFormData({...formData, emergencyContacts: newContacts});
                                }} 
                                className="w-full p-3 bg-white rounded-xl border border-slate-200" 
                            />
                        </div>
                    ))}
                </div>
                
                
                {/* Medicines Visibility Toggle */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Public Medications</h3>
                    <p className="text-xs text-slate-500 mb-3">Select which active medicines should be visible to paramedics on your QR scan.</p>
                    {formData.medicines.map((med, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-2 border border-slate-100">
                            <div>
                                <p className="font-bold text-sm text-slate-800">{med.name}</p>
                                <p className="text-xs text-slate-500">{med.dosage}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={med.isPublic} onChange={e => {
                                    const newMeds = [...formData.medicines];
                                    newMeds[index].isPublic = e.target.checked;
                                    setFormData({...formData, medicines: newMeds});
                                }} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                    ))}
                </div>

                {/* Save Button */}
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-200 flex justify-center items-center gap-2 text-lg active:scale-95 transition-transform"
                >
                    {saving ? <LoadingSpinner size={24} color="white" /> : <><Save /> Save Emergency Profile</>}
                </button>
            </div>
        </div>
    );
};

export default EmergencySetupPage;