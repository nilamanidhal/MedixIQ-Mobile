import React, { useState } from 'react';
import Login from './auth/Login';
import Register from './auth/Register';
import MedMindLogoBlank from '/images/MedMindLogoBlank.png'

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-2 flex flex-col items-center">
           <img src={MedMindLogoBlank} alt='Logo' className='w-20 h-20 scale-170' ></img>
          {/* <h1 className="text-4xl font-bold text-blue-600 mb-2">MedMind</h1> */}
          <p className="text-gray-600">Your Personal Healthcare Assistant</p>
        </div>
        
        {isLogin ? (
          <Login onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <Register onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </div>
    </div>
  );
};

export default AuthPage;