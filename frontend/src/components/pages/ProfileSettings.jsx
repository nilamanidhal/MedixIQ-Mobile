import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, User as UserIcon } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner'; // Adjust path if needed
import { useTranslation } from 'react-i18next';

const ProfileSettings = () => {
    const { user, token, API_BASE_URL } = useAuth();
    const navigate = useNavigate();

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    const [formData, setFormData] = useState({
        name: '',
        email: '', // Read-only for now
        age: '',
        gender: 'other'
    });
    const { t } = useTranslation();

    // Populate form with existing user data when component loads
    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                age: user.age || '',
                gender: user.gender || 'other'
            });
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            // Clean data to match your Mongoose schema requirements
            const payload = {
                name: formData.name.trim(),
                age: Number(formData.age),
                gender: formData.gender
            };

            const res = await axios.put(`${API_BASE_URL}/auth/profile`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            
            // Note: If you want the UI name to update immediately everywhere, 
            // you might need a function in AuthContext to refresh the user data.
            
        } catch (error) {
            console.error("Profile Update Failed:", error.response?.data);
            const errorMsg = error.response?.data?.message 
                          || error.response?.data?.errors?.[0]?.msg 
                          || "Failed to update profile. Please try again.";
            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-blue-600 px-6 pt-12 pb-6 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-3 text-white">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-blue-700 rounded-full transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <UserIcon /> {t('profile.title')}
                    </h1>
                </div>
            </div>

            <div className="p-4 max-w-lg mx-auto mt-4">
                {message.text && (
                    <div className={`p-4 mb-6 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                    
                    {/* Email - Disabled because backend doesn't support changing it via this route */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('profile.email')}</label>
                        <input 
                            type="email" 
                            value={formData.email} 
                            disabled 
                            className="w-full p-3 bg-slate-100 text-slate-500 rounded-xl border border-slate-200 cursor-not-allowed" 
                        />
                        <p className="text-xs text-slate-400 mt-1">{t('profile.emailDesc')}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('profile.fullName')}</label>
                        <input 
                            type="text" 
                            name="name"
                            value={formData.name} 
                            onChange={handleChange}
                            required
                            maxLength={100}
                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-700 mb-1">{t('profile.age')}</label>
                            <input 
                                type="number" 
                                name="age"
                                value={formData.age} 
                                onChange={handleChange}
                                required
                                min="1"
                                max="150"
                                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500" 
                            />
                        </div>

                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-700 mb-1">{t('profile.gender')}</label>
                            <select 
                                name="gender"
                                value={formData.gender} 
                                onChange={handleChange}
                                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={saving}
                        className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2 mt-4 active:scale-95 transition-transform disabled:opacity-70"
                    >
                        {saving ? <LoadingSpinner size={24} color="white" /> : <><Save size={20} /> {t('profile.saveChanges')}</>}
                    </button>

                    <div className="pt-4 border-t border-slate-100 mt-4">
                    
                    
                    <button 
                        type="button"
                        onClick={() => navigate('/change-password')}
                        className="w-full bg-slate-100 text-slate-700 font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-slate-200"
                    >
                        {t('profile.changePassword')}
                    </button>
                </div>

                </form>
            </div>
        </div>
    );
};

export default ProfileSettings;