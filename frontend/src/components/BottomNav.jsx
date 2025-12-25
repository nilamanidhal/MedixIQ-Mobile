import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const NavItem = ({ path, icon, label }) => (
    <button 
      onClick={() => navigate(path)}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${
        isActive(path) ? 'text-blue-600' : 'text-gray-400 hover:text-gray-500'
      }`}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex items-center justify-around pb-[env(safe-area-inset-bottom)] z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <NavItem path="/dashboard" icon="🏠" label="Home" />
      <NavItem path="/active-medicines" icon="💊" label="Meds" />
      <NavItem path="/reminders" icon="⏰" label="Alerts" />
      <NavItem path="/health-tracking" icon="📊" label="Health" />
      {/* <NavItem path="/history" icon="📜" label="History" /> */}
      <NavItem path="/more" icon="☰" label="More" />
    </div>
  );
};

export default BottomNav;