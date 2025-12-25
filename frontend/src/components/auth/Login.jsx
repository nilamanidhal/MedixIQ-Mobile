import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  LogIn, 
  Activity 
} from "lucide-react";

const Login = ({ onSwitchToRegister }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
        
        {/* --- HEADER --- */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 transform transition-transform hover:scale-105">
            <Activity className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to continue your health journey
          </p>
        </div>

        {/* --- ERROR MESSAGE --- */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start animate-in fade-in slide-in-from-top-2">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Login Failed</h3>
              <div className="mt-1 text-sm text-red-700">{error}</div>
            </div>
          </div>
        )}

        {/* --- FORM --- */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1 ml-1">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 sm:text-sm"
                  placeholder="••••••••"
                />
                {/* Show/Hide Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                Forgot password?
              </a>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/30 active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <LogIn className="h-5 w-5 text-blue-500 group-hover:text-blue-400 transition-colors" aria-hidden="true" />
                </span>
                Sign In
              </>
            )}
          </button>
        </form>

        {/* --- FOOTER --- */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="font-bold text-blue-600 hover:text-blue-500 transition-colors"
            >
              Sign up free
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};

export default Login;






// import React, { useState } from 'react';
// import { useAuth } from '../../contexts/AuthContext';
// import { useNavigate } from 'react-router-dom';

// const Login = ({ onSwitchToRegister }) => {
//   const [formData, setFormData] = useState({
//     email: '',
//     password: '',
//   });
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
//   const { login } = useAuth();
//   const navigate = useNavigate();

//   const handleChange = (e) => {
//     setFormData({
//       ...formData,
//       [e.target.name]: e.target.value,
//     });
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     const result = await login(formData.email, formData.password);
    
//    if (result.success) {
//                 // 🚀 4. FORCE REDIRECT TO DASHBOARD
//                 navigate('/dashboard', { replace: true });
//             } else {
//                 setError(result.message || 'Failed to login');
//                  setLoading(false);
//             }

//   };

//   return (
//     <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
//       <div className="text-center mb-6">
//         <h2 className="text-3xl font-bold text-gray-900">Sign In</h2>
//         <p className="text-gray-600 mt-2">Welcome back to MedMind</p>
//       </div>

//       <form onSubmit={handleSubmit} className="space-y-4">
//         {error && (
//           <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
//             {error}
//           </div>
//         )}

//         <div>
//           <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
//             Email Address
//           </label>
//           <input
//             type="email"
//             id="email"
//             name="email"
//             value={formData.email}
//             onChange={handleChange}
//             required
//             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Enter your email"
//           />
//         </div>

//         <div>
//           <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
//             Password
//           </label>
//           <input
//             type="password"
//             id="password"
//             name="password"
//             value={formData.password}
//             onChange={handleChange}
//             required
//             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Enter your password"
//           />
//         </div>

//         <button
//           type="submit"
//           disabled={loading}
//           className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           {loading ? 'Signing In...' : 'Sign In'}
//         </button>
//       </form>

//       <div className="mt-6 text-center">
//         <p className="text-gray-600">
//           Don't have an account?{' '}
//           <button
//             onClick={onSwitchToRegister}
//             className="text-blue-600 hover:text-blue-700 font-medium"
//           >
//             Sign Up
//           </button>
//         </p>
//       </div>
//     </div>
//   );
// };

// export default Login;