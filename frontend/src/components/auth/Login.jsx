import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../LanguageSelector'; 
import { 
  Mail, Lock, Eye, EyeOff, Loader2, Activity, Globe 
} from "lucide-react";

const Login = ({ onSwitchToRegister }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
        navigate('/dashboard', { replace: true });
    } else {
        setError(result.message || 'Failed to login');
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      
      {/* --- PREMIUM BRAND HEADER --- */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-6 pt-16 pb-12 rounded-b-[3rem] shadow-xl relative overflow-hidden">
        
        {/* Decorative background shapes */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl"></div>

        {/* 🌐 LANGUAGE SELECTOR BUTTON */}
        <button 
            onClick={() => setShowLanguage(true)}
            className="absolute top-12 right-6 p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-white shadow-sm border border-white/20 active:scale-95 transition-transform"
        >
            <Globe size={22} />
        </button>

        <div className="relative z-10 flex flex-col items-start mt-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-[0_4px_20px_rgba(255,255,255,0.3)]">
                <Activity className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight leading-tight">
                MedixIQ
            </h1>
            <h2 className="text-xl font-bold text-blue-100 mt-1 opacity-90">
                {t('auth.welcomeBack')}
            </h2>
            <p className="mt-1 text-blue-200/80 text-sm font-medium">
                {t('auth.loginSubtitle')}
            </p>
        </div>
      </div>

      {/* --- FORM SECTION --- */}
      <div className="flex-1 px-6 pt-8 pb-12 flex flex-col relative z-10 -mt-4">
        
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 flex items-start shadow-sm">
            <div className="ml-2">
              <div className="text-sm font-bold text-red-800">Login Failed</div>
              <div className="mt-1 text-sm text-red-600">{error}</div>
            </div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          
          {/* Email */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-6 w-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              name="email" type="email" required value={formData.email} onChange={handleChange}
              className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base font-bold shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
              placeholder={t('auth.email')}
            />
          </div>

          {/* Password */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-6 w-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              name="password" type={showPassword ? "text" : "password"} required value={formData.password} onChange={handleChange}
              className="block w-full pl-12 pr-12 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base font-bold shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
              placeholder={t('auth.password')}
            />
            <button
              type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center"
            >
              {showPassword ? <EyeOff className="h-6 w-6 text-slate-400" /> : <Eye className="h-6 w-6 text-slate-400" />}
            </button>
          </div>

          <div className="flex justify-end pt-1">
            <Link to="/forgot-password" className="text-xs font-bold text-blue-600 hover:text-blue-700 active:scale-95 transition-all">
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {/* Huge Touch-Friendly Button */}
          <button
            type="submit" disabled={loading}
            className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-4 rounded-[1.25rem] shadow-lg shadow-blue-600/30 flex justify-center items-center gap-2 text-lg active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : t('auth.loginBtn')}
          </button>
        </form>

        {/* --- FOOTER --- */}
        <div className="mt-auto pt-8 text-center pb-4">
          <p className="text-slate-500 font-medium text-sm">
            {t('auth.dontHaveAccount')}{' '}
            <button onClick={onSwitchToRegister} className="font-extrabold text-blue-600 active:scale-95 transition-transform ml-1">
              {t('auth.register')}
            </button>
          </p>
        </div>
      </div>

      {/* 🌐 LANGUAGE MODAL */}
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

export default Login;
















// import React, { useState } from 'react';
// import { useAuth } from '../../contexts/AuthContext';
// import { useNavigate, Link } from 'react-router-dom';
// import { 
//   Mail, 
//   Lock, 
//   Eye, 
//   EyeOff, 
//   Loader2, 
//   Activity,
//   Globe
// } from "lucide-react";
// import { useTranslation } from 'react-i18next';
// import LanguageSelector from '../LanguageSelector';

// const Login = ({ onSwitchToRegister }) => {
//   const [formData, setFormData] = useState({ email: '', password: '' });
//   const [showPassword, setShowPassword] = useState(false);
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
//   const { t } = useTranslation();
//   const [showLanguage, setShowLanguage] = useState(false);

//   const { login } = useAuth();
//   const navigate = useNavigate();

//   const handleChange = (e) => {
//     setFormData({ ...formData, [e.target.name]: e.target.value });
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     const result = await login(formData.email, formData.password);
    
//     if (result.success) {
//         navigate('/dashboard', { replace: true });
//     } else {
//         setError(result.message || 'Failed to login');
//         setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-white flex flex-col font-sans">
      
//       {/* --- NATIVE MOBILE HEADER (Curved Bottom) --- */}
//       <div className="bg-blue-50 px-6 pt-16 pb-10 rounded-b-[2.5rem] shadow-sm relative">

// {/* 🌐 LANGUAGE SELECTOR BUTTON */}
//         <button 
//             onClick={() => setShowLanguage(true)}
//             className="absolute top-12 right-6 p-2.5 bg-white/60 backdrop-blur-md rounded-full text-blue-600 shadow-sm border border-white/50 active:scale-95 transition-transform"
//         >
//             <Globe size={22} />
//         </button>

//         <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
//           <Activity className="h-8 w-8 text-white" />
//         </div>
//         <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
//          {t('auth.welcomeBack')}
//         </h2>
//         <p className="mt-2 text-slate-500 font-medium">
//           {t('auth.loginSubtitle')}
//         </p>
//       </div>

//       {/* --- FORM SECTION --- */}
//       <div className="flex-1 px-6 pt-8 pb-12 flex flex-col">
        
//         {error && (
//           <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 flex items-start">
//             <div className="ml-2">
//               <div className="text-sm font-bold text-red-800">Login Failed</div>
//               <div className="mt-1 text-sm text-red-600">{error}</div>
//             </div>
//           </div>
//         )}

//         <form className="space-y-5" onSubmit={handleSubmit}>
          
//           {/* Email */}
//           <div className="relative group">
//             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
//               <Mail className="h-6 w-6 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
//             </div>
//             <input
//               name="email"
//               type="email"
//               required
//               value={formData.email}
//               onChange={handleChange}
//               className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base font-medium"
//               placeholder={t('auth.email')}
//             />
//           </div>

//           {/* Password */}
//           <div className="relative group">
//             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
//               <Lock className="h-6 w-6 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
//             </div>
//             <input
//               name="password"
//               type={showPassword ? "text" : "password"}
//               required
//               value={formData.password}
//               onChange={handleChange}
//               className="block w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base font-medium"
//               placeholder={t('auth.password')}
//             />
//             <button
//               type="button"
//               onClick={() => setShowPassword(!showPassword)}
//               className="absolute inset-y-0 right-0 pr-4 flex items-center"
//             >
//               {showPassword ? <EyeOff className="h-6 w-6 text-slate-400" /> : <Eye className="h-6 w-6 text-slate-400" />}
//             </button>
//           </div>

//           <div className="flex justify-end pt-2">
//             <Link to="/forgot-password" className="text-sm font-bold text-blue-600 hover:text-blue-700 active:scale-95 transition-all">
//               {t('auth.forgotPassword')}
//             </Link>
//           </div>

//           {/* Huge Touch-Friendly Button */}
//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full mt-8 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 flex justify-center items-center gap-2 text-lg active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100"
//           >
//             {loading ? <Loader2 className="animate-spin h-6 w-6" /> : t('auth.loginBtn')}
//           </button>
//         </form>

//         {/* --- FOOTER (Pushed to bottom) --- */}
//         <div className="mt-auto pt-8 text-center pb-4">
//           <p className="text-slate-500 font-medium">
//             {t('auth.dontHaveAccount')}?{' '}
//             <button onClick={onSwitchToRegister} className="font-bold text-blue-600 active:scale-95 transition-transform">
//               {t('auth.register')}
//             </button>
//           </p>
//         </div>

//       </div>

//       {/* 🌐 LANGUAGE MODAL */}
//       {showLanguage && (
//         <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center p-4 animate-in fade-in duration-200">
//           <div className="w-full max-w-sm animate-in slide-in-from-bottom-10">
//             <LanguageSelector onClose={() => setShowLanguage(false)} />
//             <button
//               onClick={() => setShowLanguage(false)}
//               className="w-full mt-3 py-4 bg-white rounded-2xl font-bold text-slate-600 shadow-xl active:scale-95 transition-transform"
//             >
//               {t('language.cancel')}
//             </button>
//           </div>
//         </div>
//       )}

//     </div>
//   );
// };

// export default Login;
