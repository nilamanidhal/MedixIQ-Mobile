import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext'; 
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../ConfirmationModal';
import { useSentinelContext } from '../../contexts/SentinelContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../LanguageSelector';
import { 
  Siren, ShieldAlert, AlertTriangle, FileText, Globe,
  Activity, User, HelpCircle, LogOut, ChevronRight, Shield
} from 'lucide-react';

const MorePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isEnabled, toggleSentinel, simulateAccident } = useSentinelContext();

  const { t } = useTranslation();
    const [showLanguage, setShowLanguage] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Grouped Menu Items for a cleaner UI
  const menuGroups = [
    {
      title: t('more.safety'),
      items: [
        { 
          label: t('more.emergencyProfile'), 
          icon: <Siren size={20} className="text-red-600" />, 
          bg: 'bg-red-50',
          desc: 'Medical ID & Wallet Card',
          path: '/emergency-setup'
        },
        { 
          label: t('more.sentinelMode'), 
          icon: <ShieldAlert size={20} className="text-orange-600" />, 
          bg: 'bg-orange-50',
          desc: 'Auto-detect accidents & send SMS',
          type: 'toggle',
          value: isEnabled,
          action: () => toggleSentinel(!isEnabled)
        },
        { 
          label: t('more.testAccident'), 
          icon: <AlertTriangle size={20} className="text-amber-600" />, 
          bg: 'bg-amber-50',
          desc: 'Simulate a crash to test UI',
          action: () => simulateAccident() 
        }
      ]
    },
    {
      title: t('more.medicalRecords'),
      items: [
        { 
          label: t('more.prescriptions'), 
          icon: <FileText size={20} className="text-blue-600" />, 
          bg: 'bg-blue-50',
          desc: 'Upload and manage scripts',
          path: '/medical-records'
        },
        { 
          label: t('more.historyLogs'), 
          icon: <Activity size={20} className="text-emerald-600" />, 
          bg: 'bg-emerald-50',
          desc: 'View past medication logs',
          path: '/history'
        }
      ]
    },
    {
      title: t('more.accountSupport'),
      items: [
        { 
          label: t('more.profileSettings'), 
          icon: <User size={20} className="text-indigo-600" />, 
          bg: 'bg-indigo-50',
          desc: 'Update personal details',
          path: '/profile-settings'
        },
        { 
          label: t('more.contactSupport'), 
          icon: <HelpCircle size={20} className="text-purple-600" />, 
          bg: 'bg-purple-50',
          desc: 'Get help with the app',
          path: '/contact'
        },
        {
          label: t('more.language'),
          icon: <Globe size={20} className="text-cyan-600" />,
          bg: 'bg-cyan-50',
          desc: 'English · हिंदी · ଓଡ଼ିଆ',
          action: () => setShowLanguage(true)
        },
        { 
          label: t('more.legalPrivacy'), 
          icon: <Shield size={20} className="text-slate-600" />, 
          bg: 'bg-slate-100',
          desc: 'Terms, Privacy Policy & Licenses',
          path: '/legal'
        }
      ]
    }
  ];

  return (
    <div className="bg-slate-50 min-h-full pb-24 font-sans">
      
      {/* 🟢 HEADER PROFILE CARD */}
      <div className="bg-green-200 px-6 pt-12 pb-8 rounded-b-[2.5rem] shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl font-extrabold text-green-600">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
              {user?.name || t('common.unknown')}
            </h2>
            <p className="text-slate-600 text-sm font-medium">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-6 max-w-lg mx-auto">
        
        {/* 📋 MENU GROUPS */}
        {menuGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
              {group.title}
            </h3>
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              {group.items.map((item, index) => (
                <div key={index}>
                  <div 
                    onClick={() => {
                      if (item.path) navigate(item.path);
                      else if (item.action) item.action();
                    }}
                    className={`w-full flex items-center p-4 transition-colors text-left ${item.type !== 'toggle' ? 'hover:bg-slate-50 active:bg-slate-100 cursor-pointer' : 'cursor-pointer'}`}
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center mr-4 shrink-0`}>
                      {item.icon}
                    </div>
                    
                    {/* Text */}
                    <div className="flex-1 pr-4">
                      <h3 className="font-bold text-slate-800 text-sm">
                        {item.label}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">{item.desc}</p>
                    </div>

                    {/* Action Item (Toggle or Chevron) */}
                    {item.type === 'toggle' ? (
                      <div className="shrink-0">
                        <div className={`w-11 h-6 rounded-full flex items-center transition-colors p-1 ${item.value ? 'bg-red-500' : 'bg-slate-200'}`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform transform ${item.value ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    ) : (
                      <ChevronRight size={18} className="text-slate-300 shrink-0" />
                    )}

                  </div>
                  
                  {/* Divider line */}
                  {index < group.items.length - 1 && (
                    <hr className="border-slate-50 ml-16" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 🔴 LOGOUT BUTTON */}
        <div className="pt-4">
          <button 
            onClick={() => setShowLogoutConfirm(true)} 
            className="w-full bg-white text-red-500 font-bold py-4 rounded-2xl border border-red-100 shadow-sm hover:bg-red-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            <span>{t('more.logout')}</span>
          </button>
        </div>
        
        <div className="text-center mt-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          {t('more.version')}
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        title={t('more.confirmLogout')}
        message={t('more.logoutMsg')}
        confirmText={t('more.yesLogout')}
        cancelText={t('common.cancel')}
        isDanger={true}
        onConfirm={() => {
            setShowLogoutConfirm(false);
            logout(); 
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

            {/* Language Modal */}
            {showLanguage && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4">
                    <div className="w-full max-w-sm">
                        <LanguageSelector onClose={() => setShowLanguage(false)} />
                        <button
                            onClick={() => setShowLanguage(false)}
                            className="w-full mt-3 py-4 bg-white rounded-2xl font-bold text-slate-600"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            )}


    </div>
  );
};

export default MorePage;























// import React, { useState } from 'react';
// import { useAuth } from '../../contexts/AuthContext'; 
// import { useNavigate } from 'react-router-dom';
// import ConfirmationModal from '../ConfirmationModal';
// import { useSentinelContext } from '../../contexts/SentinelContext';

// const MorePage = () => {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();
//   const { isEnabled, toggleSentinel, simulateAccident } = useSentinelContext();

//   const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

//   const menuItems = [
//     // 🚨 ADDED EMERGENCY PROFILE
//     { 
//       label: 'Emergency Profile & QR', 
//       icon: '🚨', 
//       desc: 'Setup Medical ID & Wallet Card',
//       path: '/emergency-setup'
//     },
//     // 🛡️ ADDED SENTINEL MODE (Notice type: 'toggle')
//     { 
//       label: 'Sentinel Mode', 
//       icon: '🛡️', 
//       desc: 'Auto-detect accidents & send SMS',
//       type: 'toggle',
//       value: isEnabled,
//       action: (e) => toggleSentinel(e.target.checked)
//     },
//     { 
//       label: 'TEST ACCIDENT OVERLAY', 
//       icon: '⚠️', 
//       desc: 'Simulate a crash to test UI & SMS',
//       action: () => simulateAccident() 
//     },
//     { 
//       label: 'Prescriptions', 
//       icon: '📄', 
//       desc: 'Upload and manage scripts',
//       path: '/medical-records'
//     },
//     { 
//       label: 'History Logs', 
//       icon: '📜', 
//       desc: 'View past medication logs',
//       path: '/history'
//     },
//     { 
//       label: 'Profile Settings', 
//       icon: '👤', 
//       desc: 'Update personal details',
//       path: '/profile-settings'
//     },
//     { 
//       label: 'Contact Support', 
//       icon: '✉️', 
//       desc: 'Get help with the app',
//       path: '/contact'
//     }
//   ];

//   return (
//     <div className="bg-gray-50 min-h-full pb-0">
//       {/* Header Profile Card */}
//       <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-0 sticky top-0 z-20 border-b border-slate-100">
//         <div className="flex items-center space-x-4">
//           <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
//             {user?.name?.charAt(0).toUpperCase() || 'U'}
//           </div>
//           <div>
//             <h2 className="text-xl font-bold text-gray-900">{user?.name || 'User'}</h2>
//             <p className="text-gray-500 text-sm">{user?.email}</p>
//           </div>
//         </div>
//       </div>

//       {/* Menu List */}
//       <div className="bg-white shadow-sm rounded-4xl m-2">
//         {menuItems.map((item, index) => (
//           <div key={index}>
//             <div 
//               onClick={() => {
//                 if (item.path) navigate(item.path);
//                 else if (item.action && item.type !== 'toggle') item.action();
//               }}
//               className={`w-full flex items-center p-4 transition-colors text-left ${item.type !== 'toggle' ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
//             >
//               <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4 text-xl shrink-0">
//                 {item.icon}
//               </div>
              
//               <div className="flex-1 pr-4">
//                 <h3 className={`font-medium ${item.type === 'toggle' && item.value ? 'text-red-600' : 'text-gray-900'}`}>
//                   {item.label}
//                 </h3>
//                 <p className="text-xs text-gray-500">{item.desc}</p>
//               </div>

//               {/* 🟢 TOGGLE OR CHEVRON LOGIC */}
//               {item.type === 'toggle' ? (
//                 <label className="relative inline-flex items-center cursor-pointer shrink-0">
//                   <input 
//                     type="checkbox" 
//                     className="sr-only peer" 
//                     checked={item.value || false} 
//                     onChange={item.action} 
//                   />
//                   <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
//                 </label>
//               ) : (
//                 <span className="text-gray-400 font-bold text-xl shrink-0">›</span>
//               )}

//             </div>
//             {/* Divider line except for last item */}
//             {index < menuItems.length - 1 && <hr className="border-gray-100 ml-16" />}
//           </div>
//         ))}
//       </div>

//       {/* Logout Button */}
//       <div className="px-4 mt-6">
//         <button 
//           onClick={() => setShowLogoutConfirm(true)} 
//           className="w-full bg-white text-red-500 font-bold py-4 rounded-2xl border border-red-100 shadow-sm hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-2"
//         >
//           <span>Log Out</span>
//         </button>
//       </div>
      
//       <div className="text-center mt-4 pb-24 text-xs text-gray-400">
//         MedixIQ v1.0.0
//       </div>

//       {/* CONFIRMATION MODAL */}
//       <ConfirmationModal
//         isOpen={showLogoutConfirm}
//         title="Confirm Logout?"
//         message="Logging out will clear unsaved local data. Please ensure you are online to sync before leaving."
//         confirmText="Yes, Logout"
//         cancelText="Cancel"
//         isDanger={true}
//         onConfirm={() => {
//             setShowLogoutConfirm(false);
//             logout(); 
//         }}
//         onCancel={() => setShowLogoutConfirm(false)}
//       />
//     </div>
//   );
// };

// export default MorePage;