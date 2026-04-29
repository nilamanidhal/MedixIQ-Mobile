import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Pill, 
  Bell, 
  Activity, 
  Menu 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: '/dashboard', icon: Home, label: t('nav.home') },
    { path: '/active-medicines', icon: Pill, label: t('nav.meds') },
    { path: '/reminders', icon: Bell, label: t('nav.alerts') },
    { path: '/health-tracking', icon: Activity, label: t('nav.health') },
    { path: '/more', icon: Menu, label: t('nav.more') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Glassmorphism Container 
          - bg-white/90 + backdrop-blur-lg creates the "frosted glass" look
          - pb-[env(safe-area-inset-bottom)] handles iPhone X+ home bar area
      */}
      <div className="bg-white/95 backdrop-blur-lg border-t border-slate-200 h-[70px] pb-[env(safe-area-inset-bottom)] flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-90 group`}
            >
              {/* Active Indicator Line (Optional, iOS style) */}
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-blue-600 rounded-b-md shadow-[0_0_8px_rgba(37,99,235,0.5)]"></span>
              )}

              {/* Icon with transition */}
              <Icon 
                size={24} 
                strokeWidth={isActive ? 2.5 : 2} // Bolder icon when active
                className={`transition-colors duration-200 ${
                  isActive 
                    ? 'text-blue-600' 
                    : 'text-slate-400 group-hover:text-slate-600'
                }`} 
              />

              {/* Label */}
              <span className={`text-[10px] font-medium leading-none transition-colors duration-200 ${
                isActive 
                  ? 'text-blue-600' 
                  : 'text-slate-400 group-hover:text-slate-600'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
