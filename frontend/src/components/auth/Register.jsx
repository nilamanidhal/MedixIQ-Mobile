import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../LanguageSelector'; 
import { 
  User, Mail, Lock, Calendar, Eye, EyeOff, Loader2, Activity, Globe
} from "lucide-react";

const Register = ({ onSwitchToLogin }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '', age: '', gender: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
        alert("Please enter a valid email address.");
        return; 
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { confirmPassword, ...userData } = formData;
    userData.age = parseInt(userData.age);

    const result = await register(userData);
    
    if (result.success) {
        if (result.needsVerification) {
            alert("Account created successfully! 📧 Check your email inbox to verify your account before logging in.");
            onSwitchToLogin(); 
        } else {
            navigate('/dashboard', { replace: true });
        }
    } else {
        setError(result.message);
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      
      {/* --- PREMIUM BRAND HEADER --- */}
      <div className="bg-gradient-to-br from-indigo-600 via-blue-700 to-blue-600 px-6 pt-16 pb-12 rounded-b-[3rem] shadow-xl relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 left-10 w-24 h-24 bg-indigo-400/20 rounded-full blur-xl"></div>

        {/* LANGUAGE SELECTOR BUTTON */}
        <button 
            onClick={() => setShowLanguage(true)}
            className="absolute top-12 right-6 p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-white shadow-sm border border-white/20 active:scale-95 transition-transform"
        >
            <Globe size={22} />
        </button>

        <div className="relative z-10 flex flex-col items-start mt-2">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-[0_4px_15px_rgba(255,255,255,0.2)]">
                    {/* <Activity className="h-6 w-6 text-blue-600" /> */}
                    <img className="h-full w-full object-contain rounded-xl" src="/images/MedixIQ_LOGO.png" alt="App Logo" />
                </div>
                <span className="text-2xl font-black text-white tracking-tight">MedixIQ</span>
            </div>
            <h2 className="text-2xl font-extrabold text-blue-50 mt-2">
                {t('auth.createAccount')}
            </h2>
            <p className="text-blue-200/80 font-medium text-sm mt-1">
                {t('auth.registerSubtitle', 'Start your journey with MedixIQ')}
            </p>
        </div>
      </div>

      {/* --- FORM SECTION --- */}
      <div className="flex-1 px-6 pt-8 pb-8 flex flex-col relative z-10 -mt-4">
        
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-5 flex items-start shadow-sm">
            <div className="ml-2 text-sm font-bold text-red-700">{error}</div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          
          {/* Name */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              name="name" type="text" required value={formData.name} onChange={handleChange}
              className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold shadow-[0_2px_8px_rgb(0,0,0,0.02)]"
              placeholder={t('auth.name')}
            />
          </div>

          {/* Email */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              name="email" type="email" required value={formData.email} onChange={handleChange}
              className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold shadow-[0_2px_8px_rgb(0,0,0,0.02)]"
              placeholder={t('auth.email')}
            />
          </div>

          {/* Age & Gender Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              </div>
              <input
                name="age" type="number" min="1" max="120" required value={formData.age} onChange={handleChange}
                className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold shadow-[0_2px_8px_rgb(0,0,0,0.02)]"
                placeholder={t('auth.age')}
              />
            </div>

            <div className="relative">
              <select
                name="gender" required value={formData.gender} onChange={handleChange}
                className="block w-full px-4 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-slate-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold appearance-none shadow-[0_2px_8px_rgb(0,0,0,0.02)]"
              >
                <option value="" disabled>{t('auth.gender')}</option>
                <option value="male">{t('profile.male')}</option>
                <option value="female">{t('profile.female')}</option>
                <option value="other">{t('profile.other')}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              name="password" type={showPassword ? "text" : "password"} required minLength="6" value={formData.password} onChange={handleChange}
              className="block w-full pl-12 pr-12 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold shadow-[0_2px_8px_rgb(0,0,0,0.02)]"
              placeholder={t('auth.passwordMin')}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center">
              {showPassword ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              name="confirmPassword" type="password" required minLength="6" value={formData.confirmPassword} onChange={handleChange}
              className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold shadow-[0_2px_8px_rgb(0,0,0,0.02)]"
              placeholder={t('auth.confirmPassword')}
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-4 rounded-[1.25rem] shadow-lg shadow-blue-600/30 flex justify-center items-center gap-2 text-lg active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : t('auth.createAccount')}
          </button>
        </form>

        {/* --- FOOTER --- */}
        <div className="mt-8 text-center pb-4">
          <p className="text-slate-500 font-medium text-sm">
            {t('auth.alreadyHaveAccount')}{' '}
            <button onClick={onSwitchToLogin} className="font-extrabold text-blue-600 active:scale-95 transition-transform ml-1">
              {t('auth.login')}
            </button>
          </p>
        </div>

      </div>

      {/*  LANGUAGE MODAL */}
      {showLanguage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm animate-in slide-in-from-bottom-10">
            <LanguageSelector onClose={() => setShowLanguage(false)} />
            <button
              onClick={() => setShowLanguage(false)}
              className="w-full mt-3 py-4 bg-white rounded-2xl font-bold text-slate-600 shadow-xl active:scale-95 transition-transform"
            >
              {t('language.cancel')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Register;
