import React, { useState, useEffect } from 'react';
import { useMedicines } from '../../hooks/useMedicines';
import LoadingSpinner from '../LoadingSpinner';

const Reminders = () => {
  const { medicines, loading, fetchMedicines } = useMedicines();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [upcomingReminders, setUpcomingReminders] = useState([]);

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
    if (!medicine.duration?.endDate) return;

    const endDate = new Date(medicine.duration.endDate);
    endDate.setHours(0, 0, 0, 0);

    // Only include medicines that are still active
    if (endDate >= today && medicine.times) {
      medicine.times.forEach(time => {
        const [hours, minutes] = time.split(':').map(Number);
        const reminderTime = new Date();
        reminderTime.setHours(hours, minutes, 0, 0);

        // Only include reminders still in the future today
        if (reminderTime >= currentTime && reminderTime.toDateString() === today.toDateString()) {
          const timeDiff = reminderTime - currentTime;
          const hoursUntil = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutesUntil = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

          console.log("✅ Added:", medicine.name, time, "->", reminderTime.toLocaleTimeString());

          reminders.push({
            id: `${medicine._id}-${time}`,
            medicine: medicine.name,
            dose: medicine.dose,
            time,
            reminderTime,
            hoursUntil,
            minutesUntil,
            isToday: true,
          });
        } else {
          console.log("❌ Skipped:", medicine.name, time, "->", reminderTime.toLocaleTimeString());
        }
      });
    }
  });

  // Sort & keep only the next 8
  reminders.sort((a, b) => a.reminderTime - b.reminderTime);
  setUpcomingReminders(reminders.slice(0, 8));
};



  const formatTimeUntil = (hours, minutes) => {
    if (hours === 0 && minutes <= 0) return 'Now!';
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const getPriorityColor = (hours, minutes) => {
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 0) return 'bg-red-500 text-white';
    if (totalMinutes <= 60) return 'bg-orange-500 text-white';
    if (totalMinutes <= 180) return 'bg-yellow-500 text-white';
    return 'bg-green-500 text-white';
  };

  const getPriorityText = (hours, minutes) => {
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 0) return 'Take Now!';
    if (totalMinutes <= 60) return 'Very Soon';
    if (totalMinutes <= 180) return 'Soon';
    return 'Later';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Medicine Reminders ⏰</h1>
        <p className="text-xl text-gray-600">Never miss a dose - stay on track with your medication schedule</p>
        <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-blue-800 font-bold text-lg">
            📅 Current Time: {currentTime.toLocaleTimeString()} - {currentTime.toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Reminders */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <span className="text-3xl mr-3">⏰</span>
              Upcoming Reminders
            </h2>
            <p className="text-sm text-gray-600 mt-1">Your next medication schedule</p>
          </div>
          <div className="p-6">
            {upcomingReminders.length > 0 ? (
              <div className="space-y-4">
                {upcomingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border-l-4 border-blue-500 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-lg">💊</span>
                      </div>
                      <div className="ml-4">
                        <h3 className="font-bold text-gray-900 text-lg">{reminder.medicine}</h3>
                        <p className="text-sm text-gray-600 font-medium">{reminder.dose}</p>
                        <p className="text-sm text-blue-600 font-bold">📅 at {reminder.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold shadow-md ${getPriorityColor(reminder.hoursUntil, reminder.minutesUntil)}`}>
                        {formatTimeUntil(reminder.hoursUntil, reminder.minutesUntil)}
                      </span>
                      <p className="text-xs text-gray-500 mt-2 font-medium">
                        {getPriorityText(reminder.hoursUntil, reminder.minutesUntil)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {reminder.isToday ? 'Today' : 'Tomorrow'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">⏰</span>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Upcoming Reminders</h3>
                <p className="text-gray-600">Add medicines to see reminders here</p>
              </div>
            )}
          </div>
        </div>

        {/* Reminder Settings & Info */}
        <div className="space-y-6">
          {/* Settings Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <span className="text-2xl mr-2">⚙️</span>
                Settings
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <h3 className="font-bold text-green-900">Browser Notifications</h3>
                  <p className="text-sm text-green-700">Get notified even when app is closed</p>
                </div>
                <div className="text-green-600">
                  <span className="text-2xl">✅</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <h3 className="font-bold text-blue-900">Sound Alerts</h3>
                  <p className="text-sm text-blue-700">Audio notification for reminders</p>
                </div>
                <div className="text-blue-600">
                  <span className="text-2xl">🔊</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div>
                  <h3 className="font-bold text-purple-900">Smart Reminders</h3>
                  <p className="text-sm text-purple-700">AI-powered reminder optimization</p>
                </div>
                <div className="text-purple-600">
                  <span className="text-2xl">🧠</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tips Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <span className="text-2xl mr-2">💡</span>
                Tips
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center">
                  <span className="text-yellow-600 text-xl mr-3">⭐</span>
                  <div>
                    <h4 className="font-bold text-yellow-800">Best Practice</h4>
                    <p className="text-sm text-yellow-700">
                      Set consistent reminder times to build better medication habits
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center">
                  <span className="text-indigo-600 text-xl mr-3">📱</span>
                  <div>
                    <h4 className="font-bold text-indigo-800">Phone Tip</h4>
                    <p className="text-sm text-indigo-700">
                      Keep your phone volume up to hear notification alerts
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reminders;