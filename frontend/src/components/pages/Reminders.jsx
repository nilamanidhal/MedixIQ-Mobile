import React, { useState, useEffect } from 'react';
import { useMedicines } from '../../hooks/useMedicines'; // Adjust path if needed
import LoadingSpinner from '../LoadingSpinner';

const Reminders = () => {
  const { medicines, loading, fetchMedicines, toggleMuteMedicine } = useMedicines();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [upcomingReminders, setUpcomingReminders] = useState([]);

  // --- LOGIC (UNCHANGED) ---
  useEffect(() => {
    fetchMedicines();
  }, []);

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
    if (totalMinutes <= 0) return 'bg-red-100 text-red-700 border-red-200';
    if (totalMinutes <= 60) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-blue-50 text-blue-700 border-blue-100';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      
      {/* --- NATIVE STICKY HEADER --- */}
      <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-0 sticky top-0 z-20 border-b border-slate-100">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reminders</h1>
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

      <div className="px-5 mt-6 space-y-6">
        
        {/* --- UPCOMING LIST --- */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-lg">⏰</span>
            <h2 className="text-lg font-bold text-slate-800">Up Next</h2>
          </div>

          {upcomingReminders.length > 0 ? (
            <div className="space-y-3">
              {upcomingReminders.map((reminder, index) => (
                <div 
                  key={reminder.id}
                  className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_4px_12px_rgb(0,0,0,0.03)] flex items-center justify-between transition-all active:scale-[0.98] ${index === 0 ? 'ring-2 ring-blue-100' : ''}`}
                >
                  {/* Left: Time & Icon */}
                  <div className="flex items-center space-x-4">
                    <div className="flex flex-col items-center justify-center bg-blue-50 w-14 h-14 rounded-xl">
                      <span className="text-lg font-bold text-blue-600">{reminder.time}</span>
                      <span className="text-[10px] text-blue-400 uppercase font-bold">Today</span>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 leading-tight">
                        {reminder.medicine}
                      </h3>
                      <p className="text-sm text-slate-500 font-medium">
                        {reminder.dose}
                      </p>
                    </div>
                  </div>

                  {/* Right: Countdown & Mute */}
                  <div className="flex flex-col items-end space-y-2">
                    {/* Time Left Badge */}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getPriorityStyle(reminder.hoursUntil, reminder.minutesUntil)}`}>
                      in {formatTimeUntil(reminder.hoursUntil, reminder.minutesUntil)}
                    </span>

                    {/* Mute Button */}
                    <button
                      onClick={() => toggleMuteMedicine(reminder.originalMedicineId)}
                      className={`p-2 rounded-full transition-colors ${
                        reminder.isMuted 
                          ? 'bg-slate-100 text-slate-400' 
                          : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'
                      }`}
                    >
                      {reminder.isMuted ? (
                        // Muted Icon
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                      ) : (
                        // Active Icon
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">🌙</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800">No Upcoming Reminders</h3>
              <p className="text-slate-400 text-sm text-center max-w-[200px] mt-1">
                You are all caught up for the rest of the day!
              </p>
            </div>
          )}
        </div>

        {/* --- SYSTEM STATUS (Redesigned as compact pills) --- */}
        <div className="pt-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">System Status</h3>
          <div className="flex space-x-3 overflow-x-auto pb-2">
            <div className="flex items-center space-x-2 bg-green-50 px-4 py-3 rounded-xl border border-green-100 min-w-max">
              <span className="text-green-600 text-lg">✅</span>
              <div>
                <p className="text-xs font-bold text-green-800">Notifications On</p>
                <p className="text-[10px] text-green-600">Alarms active</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 bg-indigo-50 px-4 py-3 rounded-xl border border-indigo-100 min-w-max">
              <span className="text-indigo-600 text-lg">🔄</span>
              <div>
                <p className="text-xs font-bold text-indigo-800">Auto Sync</p>
                <p className="text-[10px] text-indigo-600">Background ready</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Reminders;






// import React, { useState, useEffect } from 'react';
// import { useMedicines } from '../../hooks/useMedicines';
// import LoadingSpinner from '../LoadingSpinner';

// const Reminders = () => {
//   const { medicines, loading, fetchMedicines, toggleMuteMedicine } = useMedicines();
//   const [currentTime, setCurrentTime] = useState(new Date());
//   const [upcomingReminders, setUpcomingReminders] = useState([]);

//   useEffect(() => {
//     fetchMedicines();
//   }, []);

//   useEffect(() => {
//     const timer = setInterval(() => {
//       setCurrentTime(new Date());
//     }, 1000);

//     return () => clearInterval(timer);
//   }, []);

//   useEffect(() => {
//     if (medicines.length > 0) {
//       generateUpcomingReminders();
//     }
//   }, [medicines, currentTime]);

//   const generateUpcomingReminders = () => {
//     const reminders = [];
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     medicines.forEach(medicine => {
//       // Skip paused medicines
//       if (!medicine.duration?.endDate || medicine.isPaused) return;

//       const endDate = new Date(medicine.duration.endDate);
//       endDate.setHours(23, 59, 59, 999); // Allow until end of day

//       // Only include medicines that are still active
//       if (endDate >= today && medicine.times) {
//         medicine.times.forEach(time => {
//           const [hours, minutes] = time.split(':').map(Number);
//           const reminderTime = new Date();
//           reminderTime.setHours(hours, minutes, 0, 0);

//           // Only include reminders still in the future today
//           if (reminderTime >= currentTime && reminderTime.toDateString() === today.toDateString()) {
//             const timeDiff = reminderTime - currentTime;
//             const hoursUntil = Math.floor(timeDiff / (1000 * 60 * 60));
//             const minutesUntil = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

//             reminders.push({
//               id: `${medicine._id}-${time}`,
//               originalMedicineId: medicine._id, // Needed for toggling mute
//               medicine: medicine.name,
//               dose: medicine.dose,
//               isMuted: medicine.isMuted, // Pass mute status
//               time,
//               reminderTime,
//               hoursUntil,
//               minutesUntil,
//               isToday: true,
//             });
//           }
//         });
//       }
//     });

//     // Sort & keep only the next 8
//     reminders.sort((a, b) => a.reminderTime - b.reminderTime);
//     setUpcomingReminders(reminders.slice(0, 8));
//   };

//   const formatTimeUntil = (hours, minutes) => {
//     if (hours === 0 && minutes <= 0) return 'Now!';
//     if (hours === 0) return `${minutes}m`;
//     if (minutes === 0) return `${hours}h`;
//     return `${hours}h ${minutes}m`;
//   };

//   const getPriorityColor = (hours, minutes) => {
//     const totalMinutes = hours * 60 + minutes;
//     if (totalMinutes <= 0) return 'bg-red-500 text-white';
//     if (totalMinutes <= 60) return 'bg-orange-500 text-white';
//     if (totalMinutes <= 180) return 'bg-yellow-500 text-white';
//     return 'bg-green-500 text-white';
//   };

//   const getPriorityText = (hours, minutes) => {
//     const totalMinutes = hours * 60 + minutes;
//     if (totalMinutes <= 0) return 'Take Now!';
//     if (totalMinutes <= 60) return 'Very Soon';
//     if (totalMinutes <= 180) return 'Soon';
//     return 'Later';
//   };

//   if (loading) return <LoadingSpinner />;

//   return (
//     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
//       <div className="mb-8">
//         <h1 className="text-4xl font-bold text-gray-900 mb-3">Medicine Reminders ⏰</h1>
//         <p className="text-xl text-gray-600">Never miss a dose - stay on track with your medication schedule</p>
//         <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
//           <p className="text-blue-800 font-bold text-lg">
//             📅 Current Time: {currentTime.toLocaleTimeString()} - {currentTime.toLocaleDateString()}
//           </p>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//         {/* Upcoming Reminders List */}
//         <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-gray-200">
//           <div className="p-6 border-b border-gray-200">
//             <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
//               <span className="text-3xl mr-3">⏰</span>
//               Upcoming Reminders
//             </h2>
//             <p className="text-sm text-gray-600 mt-1">Your next medication schedule</p>
//           </div>

//           <div className="p-6">
//             {upcomingReminders.length > 0 ? (
//               <div className="space-y-4">
//                 {upcomingReminders.map((reminder) => (
//                   <div
//                     key={reminder.id}
//                     className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border-l-4 border-blue-500 hover:bg-gray-100 transition-colors"
//                   >
//                     <div className="flex items-center">
//                       <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
//                         <span className="text-white font-bold text-lg">💊</span>
//                       </div>
//                       <div className="ml-4">
//                         <h3 className="font-bold text-gray-900 text-lg">{reminder.medicine}</h3>
//                         <p className="text-sm text-gray-600 font-medium">{reminder.dose}</p>
//                         <p className="text-sm text-blue-600 font-bold">📅 at {reminder.time}</p>
//                       </div>
//                     </div>

//                     <div className="flex items-center space-x-3">
//                       {/* Mute Button integrated into each reminder */}
//                       <button
//                         onClick={() => toggleMuteMedicine(reminder.originalMedicineId)}
//                         className={`flex flex-col items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${
//                           reminder.isMuted 
//                             ? 'bg-gray-200 text-gray-500' // Muted Style
//                             : 'bg-purple-100 text-purple-600' // Active Style
//                         }`}
//                         title={reminder.isMuted ? "Unmute Alarm" : "Mute Alarm"}
//                       >
//                         {reminder.isMuted ? (
//                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
//                         ) : (
//                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
//                         )}
//                       </button>

//                       <div className="text-right">
//                         <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold shadow-md ${getPriorityColor(reminder.hoursUntil, reminder.minutesUntil)}`}>
//                           {formatTimeUntil(reminder.hoursUntil, reminder.minutesUntil)}
//                         </span>
//                         <p className="text-xs text-gray-500 mt-2 font-medium">
//                           {getPriorityText(reminder.hoursUntil, reminder.minutesUntil)}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <div className="text-center py-12">
//                 <span className="text-6xl mb-4 block">⏰</span>
//                 <h3 className="text-xl font-bold text-gray-900 mb-2">No Upcoming Reminders</h3>
//                 <p className="text-gray-600">Add medicines to see reminders here</p>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Reminder Settings & Info (Right Column) */}
//         <div className="space-y-6">
//           <div className="bg-white rounded-xl shadow-lg border border-gray-200">
//             <div className="p-6 border-b border-gray-200">
//               <h2 className="text-xl font-semibold text-gray-900 flex items-center">
//                 <span className="text-2xl mr-2">⚙️</span>
//                 Settings
//               </h2>
//             </div>
//             <div className="p-6 space-y-4">
//               {/* Static Info Cards */}
//               <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
//                 <div>
//                   <h3 className="font-bold text-green-900">Notifications</h3>
//                   <p className="text-sm text-green-700">Enabled for high priority</p>
//                 </div>
//                 <span className="text-2xl">✅</span>
//               </div>
              
//               <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
//                 <div>
//                   <h3 className="font-bold text-purple-900">Offline Sync</h3>
//                   <p className="text-sm text-purple-700">Updates sync automatically</p>
//                 </div>
//                 <span className="text-2xl">🔄</span>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Reminders;