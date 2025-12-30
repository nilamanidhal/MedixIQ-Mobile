import React from 'react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Adjusted path to step out of 'pages' and 'components'
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../ConfirmationModal';

const MorePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    { 
      label: 'Prescriptions', 
      icon: '📄', 
      desc: 'Upload and manage scripts',
      path: '/medical-records'
    },
    { 
      label: 'History Logs', 
      icon: '📜', 
      desc: 'View past medication logs',
      path: '/history'
    },
    { 
      label: 'Profile Settings', 
      icon: '👤', 
      desc: 'Update email or password',
      action: () => alert("Edit Profile Coming Soon!")
    },
    { 
      label: 'Contact Support', 
      icon: '✉️', 
      desc: 'Get help with the app',
      path: '/contact'
    }
  ];

  return (
    <div className="bg-gray-50 min-h-full pb-0">
      {/* Header Profile Card */}
      <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-0 sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.name || 'User'}</h2>
            <p className="text-gray-500 text-sm">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="bg-white shadow-sm rounded-4xl m-2">
        {menuItems.map((item, index) => (
          <div key={index}>
            <button 
              onClick={() => item.path ? navigate(item.path) : item.action()}
              className="w-full flex items-center p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4 text-xl">
                {item.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{item.label}</h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <span className="text-gray-400 font-bold text-xl">›</span>
            </button>
            {/* Divider line except for last item */}
            {index < menuItems.length - 1 && <hr className="border-gray-100 ml-16" />}
          </div>
        ))}
      </div>

      {/* Logout Button */}
      <div className="px-4 mt-6">
        <button 
          onClick={() => setShowLogoutConfirm(true)} // 👈 OPEN MODAL
          className="w-full bg-white text-red-500 font-bold py-4 rounded-2xl border border-red-100 shadow-sm hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>Log Out</span>
        </button>
      </div>
      
      <div className="text-center mt-4 text-xs text-gray-400">
        MedMind v1.0.0
      </div>

      {/* 🟢 2. ADD THE CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        title="Confirm Logout?"
        message="Logging out will clear unsaved local data. Please ensure you are online to sync before leaving."
        confirmText="Yes, Logout"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={() => {
            setShowLogoutConfirm(false);
            logout(); // The real logout function
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

    </div>
  );
};

export default MorePage;