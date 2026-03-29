import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase'; // We will create this file during setup
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            // 🔥 THIS IS THE MAGIC FIREBASE FUNCTION
            await sendPasswordResetEmail(auth, email);
            
            setStatus({ 
                type: 'success', 
                message: 'Password reset link sent! Check your inbox (and spam folder).' 
            });
            setEmail(''); // Clear the input
        } catch (error) {
            console.error(error);
            // Firebase gives specific errors we can show the user
            const errorMessage = error.code === 'auth/user-not-found' 
                ? "No account found with this email." 
                : "Failed to send reset email. Please try again.";
            
            setStatus({ type: 'error', message: errorMessage });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center bg-slate-50 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full mx-auto space-y-8 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                
                {/* Back Button & Header */}
                <div>
                    <button onClick={() => navigate('/login')} className="text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors">
                        <ArrowLeft size={18} /> Back to login
                    </button>
                    <h2 className="text-2xl font-extrabold text-slate-900">Reset Password</h2>
                    <p className="mt-2 text-sm text-slate-500">
                        Enter the email associated with your account and we'll send you a link to reset your password.
                    </p>
                </div>

                {/* Status Messages */}
                {status.message && (
                    <div className={`p-4 rounded-xl flex items-start ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {status.type === 'success' && <CheckCircle2 className="h-5 w-5 mr-2 flex-shrink-0 text-green-500" />}
                        <p className="text-sm font-medium">{status.message}</p>
                    </div>
                )}

                {/* Form */}
                <form className="mt-8 space-y-6" onSubmit={handleReset}>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                            placeholder="you@example.com"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                    >
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Send Reset Link'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;