import React, { useState, useEffect } from 'react';
import { useMedicines } from '../../hooks/useMedicines'; // Adjust path if needed
import LoadingSpinner from '../LoadingSpinner';
import { 
  Bell, 
  BellOff, 
  Clock, 
  Pill, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Zap, 
  Calendar 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Reminders = () => {
  const { medicines, loading,  toggleMuteMedicine } = useMedicines();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const { t } = useTranslation();

  // --- LOGIC (UNCHANGED) ---
  // useEffect(() => {
  //   fetchMedicines();
  // }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (medicines.length > 0) {
      generateUpcomingReminders();
    }
  }, [medicines, currentTime]);

  const generateUpcomingReminders = () => {
    const reminders = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    medicines.forEach(medicine => {
      if (!medicine.duration?.endDate || medicine.isPaused) return;

      const endDate = new Date(medicine.duration.endDate);
      endDate.setHours(23, 59, 59, 999);

      if (endDate >= today && medicine.times) {
        medicine.times.forEach(time => {
          const [hours, minutes] = time.split(':').map(Number);
          const reminderTime = new Date();
          reminderTime.setHours(hours, minutes, 0, 0);

          if (reminderTime >= currentTime && reminderTime.toDateString() === today.toDateString()) {
            const timeDiff = reminderTime - currentTime;
            const hoursUntil = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutesUntil = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

            reminders.push({
              id: `${medicine._id}-${time}`,
              originalMedicineId: medicine._id,
              medicine: medicine.name,
              dose: medicine.dose,
              isMuted: medicine.isMuted,
              time,
              reminderTime,
              hoursUntil,
              minutesUntil,
              isToday: true,
            });
          }
        });
      }
    });

    reminders.sort((a, b) => a.reminderTime - b.reminderTime);
    setUpcomingReminders(reminders.slice(0, 8));
  };

  const formatTimeUntil = (hours, minutes) => {
    if (hours === 0 && minutes <= 0) return 'Now';
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  // Simplified color logic for badges
  const getPriorityStyle = (hours, minutes) => {
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 0) return 'bg-red-500 text-white shadow-red-200';
    if (totalMinutes <= 60) return 'bg-orange-500 text-white shadow-orange-200';
    return 'bg-blue-50 text-blue-600 border border-blue-100';
  };
  

// BAAD MEIN:
if (loading && medicines.length === 0) {
    return (
        <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 pb-24 font-sans">
            <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] mb-0">
                <div className="h-8 w-32 bg-green-300/50 rounded animate-pulse mb-2"/>
                <div className="h-4 w-48 bg-green-300/50 rounded animate-pulse"/>
            </div>
            <div className="px-5 mt-6 space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-3xl p-5 border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-slate-100 rounded-2xl animate-pulse"/>
                            <div>
                                <div className="h-5 w-28 bg-slate-100 rounded animate-pulse mb-2"/>
                                <div className="h-3 w-16 bg-slate-100 rounded animate-pulse"/>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse"/>
                            <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse"/>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}


  return (
    <div className="min-h-full bg-slate-50 pb-24">
      
      {/* --- NATIVE STICKY HEADER (UNCHANGED) --- */}
      <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-0 sticky top-0 z-20 border-b border-slate-100">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('reminders.title')}</h1>
            <p className="text-slate-500 text-sm font-medium">
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {/* Live Digital Clock Badge */}
          <div className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
            <span className="text-sm font-mono font-bold text-slate-600">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-8">
        
        {/* --- UPCOMING LIST --- */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center space-x-2">
              <Clock className="text-slate-400" size={20} />
              <h2 className="text-lg font-bold text-slate-800">{t('reminders.upNext')}</h2>
            </div>
            {upcomingReminders.length > 0 && (
              <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-md">
                {upcomingReminders.length}
              </span>
            )}
          </div>

          {upcomingReminders.length > 0 ? (
            <div className="space-y-4">
              {upcomingReminders.map((reminder, index) => {
                const isUrgent = reminder.hoursUntil === 0 && reminder.minutesUntil < 30;
                
                return (
                  <div 
                    key={reminder.id}
                    className={`relative bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between transition-all active:scale-[0.98] overflow-hidden ${index === 0 ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
                  >
                    {/* Left Priority Indicator Line */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isUrgent ? 'bg-orange-500' : 'bg-blue-500'}`}></div>

                    {/* Left: Info */}
                    <div className="flex items-center space-x-4 pl-3">
                      {/* Time Box */}
                      <div className="flex flex-col items-center justify-center bg-slate-50 w-14 h-14 rounded-2xl border border-slate-100">
                        <span className="text-sm font-bold text-slate-800">{reminder.time}</span>
                        {index === 0 && (
                          <span className="text-[10px] text-blue-500 font-bold animate-pulse">{t('reminders.soon')}</span>
                        )}
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 leading-tight flex items-center gap-2">
                          {reminder.medicine}
                        </h3>
                        <div className="flex items-center text-slate-400 text-xs font-medium mt-1">
                          <Pill size={12} className="mr-1" />
                          {reminder.dose}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col items-end space-y-2">
                      {/* Countdown Badge */}
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide shadow-sm ${getPriorityStyle(reminder.hoursUntil, reminder.minutesUntil)}`}>
                        {t('reminders.in')} {formatTimeUntil(reminder.hoursUntil, reminder.minutesUntil)}
                      </span>

                      {/* Mute Button */}
                      <button
                        onClick={() => toggleMuteMedicine(reminder.originalMedicineId)}
                        className={`p-2 rounded-full transition-colors border ${
                          reminder.isMuted 
                            ? 'bg-red-50 text-red-400 border-red-100' 
                            : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                        }`}
                      >
                        {reminder.isMuted ? <BellOff size={16} /> : <Bell size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-400">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t('reminders.allClear')}</h3>
              <p className="text-slate-400 text-sm text-center max-w-[200px] mt-1">
                {t('reminders.allClearDesc')}
              </p>
            </div>
          )}
        </div>

      </div>

<div className="h-10 w-full flex-shrink-0 block"></div>

    </div>
  );
};

export default Reminders;