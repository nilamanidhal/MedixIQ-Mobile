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
    <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 pb-32 font-sans">
      
      {/*  HEADER PROFILE CARD */}
      <div className="flex-shrink-0 bg-green-200 px-6 pt-14 pb-8 rounded-b-[2.5rem] shadow-sm sticky top-0 z-20">
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
        
        {/*  MENU GROUPS */}
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

        {/*  LOGOUT BUTTON */}
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
        cancelText={t('language.cancel')}
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
                            {t('language.cancel')}
                        </button>
                    </div>
                </div>
            )}
  <div className="h-32 w-full flex-shrink-0 block"></div>

    </div>
  );
};

export default MorePage;