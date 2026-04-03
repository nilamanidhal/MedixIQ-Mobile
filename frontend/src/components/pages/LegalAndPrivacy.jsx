import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, Code, Info, ChevronDown, ChevronUp } from 'lucide-react';

const LegalAndPrivacy = () => {
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState('privacy');

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  const sections = [
    {
      id: 'privacy',
      title: 'Privacy Policy',
      icon: <Shield size={20} className="text-emerald-600" />,
      bg: 'bg-emerald-50',
      content: (
        <div className="space-y-3 text-sm text-slate-600">
          <p><strong>1. Data Collection:</strong> MedixIQ collects personal information (name, email) and health data (medication names, schedules, logs) solely to provide the reminder service.</p>
          <p><strong>2. Local Storage:</strong> Your health data is stored locally on your device for offline access and synced securely to our encrypted database.</p>
          <p><strong>3. Location Data:</strong> If you enable Sentinel Mode, we require background location access to detect accidents and send emergency SOS messages. We do not sell or track your location for ads.</p>
          <p><strong>4. Caregiver Access:</strong> By linking a Caregiver, you consent to sharing your medication logs with them. You may revoke this at any time.</p>
        </div>
      )
    },
    {
      id: 'terms',
      title: 'Terms & Conditions',
      icon: <FileText size={20} className="text-blue-600" />,
      bg: 'bg-blue-50',
      content: (
        <div className="space-y-3 text-sm text-slate-600">
          <p className="font-bold text-red-500 uppercase text-xs">Medical Disclaimer</p>
          <p>MedixIQ is a tracking tool, not a medical device. It does not provide medical advice, diagnosis, or treatment. Always consult a healthcare professional before making medical decisions.</p>
          <p><strong>Limitation of Liability:</strong> MedixIQ relies on your device's battery, settings, and network. We are not liable for missed alarms, failed syncs, or the failure of Sentinel Mode to trigger during an emergency.</p>
          <p>It is your responsibility to verify the accuracy of the dosages and schedules you enter into the app.</p>
        </div>
      )
    },
    {
      id: 'licenses',
      title: 'Open Source Licenses',
      icon: <Code size={20} className="text-indigo-600" />,
      bg: 'bg-indigo-50',
      content: (
        <div className="space-y-3 text-sm text-slate-600">
          <p>MedixIQ is built using incredible open-source software. We acknowledge and thank the following projects:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>React</strong> (MIT License)</li>
            <li><strong>Capacitor</strong> (MIT License)</li>
            <li><strong>Tailwind CSS</strong> (MIT License)</li>
            <li><strong>Lucide Icons</strong> (ISC License)</li>
            <li><strong>Axios</strong> (MIT License)</li>
          </ul>
        </div>
      )
    },
    {
      id: 'about',
      title: 'About MedixIQ',
      icon: <Info size={20} className="text-purple-600" />,
      bg: 'bg-purple-50',
      content: (
        <div className="space-y-3 text-sm text-slate-600 text-center py-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg">
             <span className="text-white font-extrabold text-2xl">M</span>
          </div>
          <p className="font-bold text-slate-800 text-lg">MedixIQ</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Version 1.0.1</p>
          <p className="mt-4">Built to help you and your loved ones stay on top of your health, securely and reliably.</p>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      {/* HEADER */}
      <div className="bg-white px-4 pt-12 pb-4 shadow-sm sticky top-0 z-20 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-slate-50 text-slate-600 rounded-full hover:bg-slate-100 active:scale-95 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-slate-800">Legal & Privacy</h1>
      </div>

      <div className="px-5 mt-6 max-w-lg mx-auto space-y-4">
        <p className="text-xs text-slate-500 mb-6 text-center">
          Please read these documents carefully. Using MedixIQ indicates your agreement to these terms.
        </p>

        {/* ACCORDION LIST */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          {sections.map((section, index) => (
            <div key={section.id}>
              <button 
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 ${section.bg} rounded-xl flex items-center justify-center shrink-0`}>
                    {section.icon}
                  </div>
                  <span className="font-bold text-slate-800 text-sm">{section.title}</span>
                </div>
                {openSection === section.id ? (
                  <ChevronUp size={20} className="text-slate-400" />
                ) : (
                  <ChevronDown size={20} className="text-slate-400" />
                )}
              </button>

              {/* Collapsible Content */}
              {openSection === section.id && (
                <div className="p-5 bg-slate-50 border-t border-slate-100">
                  {section.content}
                </div>
              )}

              {index < sections.length - 1 && <hr className="border-slate-50 ml-16" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LegalAndPrivacy;