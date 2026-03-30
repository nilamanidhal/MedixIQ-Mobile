import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase'; 
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { ArrowLeft, Key, Save } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner'; 

const ChangePassword = () => {
    const navigate = useNavigate();

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        // 1. Client-side validation
        if (formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        if (formData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            setMessage({ type: 'error', text: 'Authentication error. Please log in again.' });
            return;
        }

        setSaving(true);

        try {
            // 🔥 2. Re-authenticate the user with their current password
            const credential = EmailAuthProvider.credential(user.email, formData.currentPassword);
            await reauthenticateWithCredential(user, credential);

            // 🔥 3. If re-auth succeeds, update the password in Firebase
            await updatePassword(user, formData.newPassword);

            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' }); // Clear form
            
        } catch (error) {
            console.error("Password Change Failed:", error);
            
            // Handle specific Firebase error codes beautifully
            let errorMsg = "Failed to change password. Please try again.";
            if (error.code === 'auth/invalid-credential') {
                errorMsg = "Your current password is incorrect.";
            } else if (error.code === 'auth/too-many-requests') {
                errorMsg = "Too many failed attempts. Please try again later.";
            }

            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-slate-800 px-6 pt-12 pb-6 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-3 text-white">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-700 rounded-full transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Key size={20} /> Security Settings
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
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Current Password</label>
                        <input 
                            type="password" 
                            name="currentPassword"
                            value={formData.currentPassword} 
                            onChange={handleChange}
                            required
                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-500" 
                        />
                    </div>

                    <hr className="border-slate-100" />

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">New Password</label>
                        <input 
                            type="password" 
                            name="newPassword"
                            value={formData.newPassword} 
                            onChange={handleChange}
                            required
                            minLength={6}
                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-500" 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Confirm New Password</label>
                        <input 
                            type="password" 
                            name="confirmPassword"
                            value={formData.confirmPassword} 
                            onChange={handleChange}
                            required
                            minLength={6}
                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-500" 
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={saving}
                        className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2 mt-4 active:scale-95 transition-transform disabled:opacity-70"
                    >
                        {saving ? <LoadingSpinner size={24} color="white" /> : <><Save size={20} /> Update Password</>}
                    </button>

                </form>
            </div>
        </div>
    );
};

export default ChangePassword;