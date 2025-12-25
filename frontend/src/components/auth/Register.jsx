import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Lock, 
  Calendar, 
  Eye, 
  EyeOff, 
  Loader2, 
  ArrowRight,
  Activity 
} from "lucide-react";

const Register = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    gender: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    const { confirmPassword, ...userData } = formData;
    userData.age = parseInt(userData.age);

    const result = await register(userData);
    
    if (result.success) {
        navigate('/dashboard', { replace: true });
    } else {
        setError(result.message);
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
        
        {/* --- HEADER --- */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Create Account
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Start your journey with MedMind
          </p>
        </div>

        {/* --- ERROR --- */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start animate-in fade-in slide-in-from-top-1">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <div className="text-sm text-red-700 font-medium">{error}</div>
            </div>
          </div>
        )}

        {/* --- FORM --- */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          
          {/* Name */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
              placeholder="Full Name"
            />
          </div>

          {/* Email */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
              placeholder="Email Address"
            />
          </div>

          {/* Age & Gender Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                id="age"
                name="age"
                type="number"
                min="1"
                max="120"
                required
                value={formData.age}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                placeholder="Age"
              />
            </div>

            <div className="relative">
              <select
                id="gender"
                name="gender"
                required
                value={formData.gender}
                onChange={handleChange}
                className="block w-full px-3 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm appearance-none"
              >
                <option value="" disabled>Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength="6"
              value={formData.password}
              onChange={handleChange}
              className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
              placeholder="Password (min 6 chars)"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength="6"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
              placeholder="Confirm Password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/30 active:scale-[0.98] mt-6"
          >
            {loading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                Create Account
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* --- FOOTER --- */}
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-600">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="font-bold text-blue-600 hover:text-blue-500 transition-colors"
            >
              Log in
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};

export default Register;







// import React, { useState } from 'react';
// import { useAuth } from '../../contexts/AuthContext';
// import { useNavigate } from 'react-router-dom';

// const Register = ({ onSwitchToLogin }) => {
//   const [formData, setFormData] = useState({
//     name: '',
//     email: '',
//     password: '',
//     confirmPassword: '',
//     age: '',
//     gender: '',
//   });
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
//   const { register } = useAuth();
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

//     if (formData.password !== formData.confirmPassword) {
//       setError('Passwords do not match');
//       return;
//     }

//     if (formData.password.length < 6) {
//       setError('Password must be at least 6 characters long');
//       return;
//     }

//     setLoading(true);

//     const { confirmPassword, ...userData } = formData;
//     userData.age = parseInt(userData.age);

//     const result = await register(userData);
    
//     if (result.success) {
//                 // 🚀 3. FORCE REDIRECT AFTER REGISTER
//                 navigate('/dashboard', { replace: true });
//             } else {
//                 setError(result.message);
//                  setLoading(false);
//             }
//   };

//   return (
//     <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
//       <div className="text-center mb-6">
//         <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
//         <p className="text-gray-600 mt-2">Join MedMind today</p>
//       </div>

//       <form onSubmit={handleSubmit} className="space-y-4">
//         {error && (
//           <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
//             {error}
//           </div>
//         )}

//         <div>
//           <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
//             Full Name
//           </label>
//           <input
//             type="text"
//             id="name"
//             name="name"
//             value={formData.name}
//             onChange={handleChange}
//             required
//             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Enter your full name"
//           />
//         </div>

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

//         <div className="grid grid-cols-2 gap-4">
//           <div>
//             <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
//               Age
//             </label>
//             <input
//               type="number"
//               id="age"
//               name="age"
//               value={formData.age}
//               onChange={handleChange}
//               required
//               min="1"
//               max="150"
//               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               placeholder="Age"
//             />
//           </div>

//           <div>
//             <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
//               Gender
//             </label>
//             <select
//               id="gender"
//               name="gender"
//               value={formData.gender}
//               onChange={handleChange}
//               required
//               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             >
//               <option value="">Select Gender</option>
//               <option value="male">Male</option>
//               <option value="female">Female</option>
//               <option value="other">Other</option>
//             </select>
//           </div>
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
//             minLength="6"
//             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Enter your password"
//           />
//         </div>

//         <div>
//           <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
//             Confirm Password
//           </label>
//           <input
//             type="password"
//             id="confirmPassword"
//             name="confirmPassword"
//             value={formData.confirmPassword}
//             onChange={handleChange}
//             required
//             minLength="6"
//             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Confirm your password"
//           />
//         </div>

//         <button
//           type="submit"
//           disabled={loading}
//           className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           {loading ? 'Creating Account...' : 'Create Account'}
//         </button>
//       </form>

//       <div className="mt-6 text-center">
//         <p className="text-gray-600">
//           Already have an account?{' '}
//           <button
//             onClick={onSwitchToLogin}
//             className="text-blue-600 hover:text-blue-700 font-medium"
//           >
//             Sign In
//           </button>
//         </p>
//       </div>
//     </div>
//   );
// };

// export default Register;