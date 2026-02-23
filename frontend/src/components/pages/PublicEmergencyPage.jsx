import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Phone, Activity, Droplet, Clock } from 'lucide-react';

const PublicEmergencyPage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // We use the full URL from the browser, but fetch from the backend API
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchEmergencyData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/emergency/${token}`);
        setData(response.data.profile.publicData);
      } catch (err) {
        setError('Medical profile not found, invalid, or expired.');
      } finally {
        setLoading(false);
      }
    };
    fetchEmergencyData();
  }, [token]);

  if (loading) return <div className="flex justify-center items-center h-screen"><Activity className="animate-spin text-red-500" size={40} /></div>;
  if (error) return <div className="p-8 text-center text-red-600 font-bold mt-20">{error}</div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* HEADER (Red for Emergency) */}
      <div className="bg-red-600 p-6 text-white text-center shadow-md rounded-b-3xl">
        <h1 className="text-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2">
          <AlertTriangle /> EMERGENCY ID
        </h1>
        <p className="opacity-90 mt-1 text-sm">Official Medical Profile</p>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 relative z-10 space-y-4">
        
        {/* BASIC INFO */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          {data.photo ? (
            <img src={data.photo} alt="Patient" className="w-20 h-20 rounded-full object-cover border-4 border-red-100" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-xl">
              {data.name?.charAt(0)}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{data.name}</h2>
            <p className="text-slate-500 font-medium">Age: {data.age || 'N/A'}</p>
            <div className="mt-1 inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">
              <Droplet size={14} /> Blood: {data.bloodGroup || 'Unknown'}
            </div>
          </div>
        </div>

        {/* ALLERGIES (CRITICAL) */}
        {data.allergies?.length > 0 && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
            <h3 className="font-bold text-red-800 flex items-center gap-2 mb-2"><AlertTriangle size={18}/> KNOWN ALLERGIES</h3>
            <div className="flex flex-wrap gap-2">
              {data.allergies.map((allergy, i) => (
                <span key={i} className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-bold">{allergy}</span>
              ))}
            </div>
          </div>
        )}

        {/* MEDICAL CONDITIONS */}
        {data.conditions?.length > 0 && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-2">Chronic Conditions</h3>
            <ul className="list-disc list-inside text-slate-600">
              {data.conditions.map((cond, i) => <li key={i}>{cond}</li>)}
            </ul>
          </div>
        )}

        {/* MEDICINES */}
        {data.medicines?.length > 0 && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-2">Current Medications</h3>
            <div className="space-y-2">
              {data.medicines.map((med, i) => (
                <div key={i} className="flex justify-between border-b border-slate-50 pb-2 last:border-0">
                  <span className="font-medium text-slate-700">{med.name}</span>
                  <span className="text-slate-500 text-sm">{med.dosage}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EMERGENCY CONTACTS (CLICK TO CALL) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3">Emergency Contacts</h3>
          <div className="space-y-3">
            {data.emergencyContacts?.map((contact, i) => (
              <a key={i} href={`tel:${contact.phone}`} className="flex items-center justify-between bg-green-50 p-3 rounded-xl border border-green-100 active:scale-95 transition-transform">
                <div>
                  <p className="font-bold text-green-900">{contact.name}</p>
                  <p className="text-xs text-green-700 uppercase font-bold">{contact.relation}</p>
                </div>
                <div className="bg-green-600 text-white p-3 rounded-full">
                  <Phone size={20} />
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PublicEmergencyPage;