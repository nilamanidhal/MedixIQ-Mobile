import { LocalNotifications } from '@capacitor/local-notifications';

export const cancelMedicineReminders = async (medicineId) => {
  try {
    const pending = await LocalNotifications.getPending();
    const matching = pending.notifications.filter(n => n.extra && n.extra.medicineId === medicineId);
    if (matching.length > 0) {
        await LocalNotifications.cancel({ notifications: matching });
    }
  } catch (err) { console.error("Error cancelling:", err); }
};

export const cancelAllAlarms = async () => {
    try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel(pending);
            alert("All alarms cleared.");
        }
    } catch (err) { console.error(err); }
};

export const rescheduleSnooze = async (originalNotification) => {
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const snoozeTime = new Date(Date.now() + TEN_MINUTES_MS);
    const { id, title, body, extra, channelId, sound, actionTypeId } = originalNotification;
    const snoozeId = parseInt(id) + 500000; 

    try {
        await LocalNotifications.schedule({
            notifications: [{
                title: `${title} (Snoozed)`,
                body: body,
                id: snoozeId, 
                schedule: { at: snoozeTime, allowWhileIdle: true }, 
                channelId, sound, actionTypeId, extra
            }]
        });
        console.log(`✅ Snoozed until ${snoozeTime.toLocaleTimeString()}`);
    } catch (error) { console.error("Snooze Error:", error); }
};

export const scheduleMedicineReminder = async (medicine) => {
  try {
    if (!medicine || !medicine.duration || !medicine.duration.endDate) return;

    // 1. Register Actions (Ensure they exist)
    await LocalNotifications.registerActionTypes({
      types: [{
          id: 'MEDICINE_ACTIONS', 
          actions: [
            { id: 'taken', title: '✅ Taken', foreground: true },
            { id: 'missed', title: '❌ Missed', foreground: true, destructive: true },
            { id: 'snooze', title: '💤 Snooze 10m', foreground: false }
          ]
      }]
    });

    // 2. Cancel old alarms
    if (medicine._id) await cancelMedicineReminders(medicine._id);

    // 3. Permission & Channel
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') await LocalNotifications.requestPermissions();

    await LocalNotifications.createChannel({
        id: 'medmind_alarm_v3', 
        name: 'Medicine Alarms High Priority',
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: 'alarm_sound.wav', 
    });

    const notificationsToSchedule = [];
    
    // 4. Date Logic
    const today = new Date();
    today.setHours(0,0,0,0);

    const startDate = new Date(medicine.duration.startDate);
    startDate.setHours(0,0,0,0);

    const endDate = new Date(medicine.duration.endDate);
    endDate.setHours(0,0,0,0); // IMPORTANT: Ensure time is 00:00:00

    if (today > endDate) {
        console.log(`Skipping expired medicine: ${medicine.name}`);
        return;
    }

    let currentDate = startDate > today ? startDate : today;
    const MAX_DAYS_AHEAD = 45; 
    let daysScheduled = 0;

    while (currentDate <= endDate && daysScheduled < MAX_DAYS_AHEAD) {
        medicine.times.forEach((timeString, index) => {
            const [hours, minutes] = timeString.split(':').map(Number);
            const triggerTime = new Date(currentDate);
            triggerTime.setHours(hours, minutes, 0, 0);

            // Only schedule if time is in future
            if (triggerTime > new Date()) {
                const uniqueId = (new Date().getTime() % 10000000) + (daysScheduled * 100) + index;
                
                notificationsToSchedule.push({
                    title: `Time to take ${medicine.name}`,
                    body: `Dosage: ${medicine.dose}`,
                    id: uniqueId,
                    schedule: { at: triggerTime,
                                allowWhileIdle: true },
                    channelId: 'medmind_alarm_v3',
                    sound: 'alarm_sound.wav',
                    actionTypeId: 'MEDICINE_ACTIONS',
                    extra: { 
                        medicineId: medicine._id,
                        medicineName: medicine.name,
                        scheduledTime: triggerTime.toISOString()
                    }
                });
            }
        });
        currentDate.setDate(currentDate.getDate() + 1);
        daysScheduled++;
    }

    if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
        console.log(`✅ Scheduled ${notificationsToSchedule.length} alarms for ${medicine.name}`);
    }

  } catch (error) { console.error("Schedule Error:", error); }
};







// import { LocalNotifications } from '@capacitor/local-notifications';

// // --- 1. Cancel Function ---
// export const cancelMedicineReminders = async (medicineId) => {
//   try {
//     const pending = await LocalNotifications.getPending();
//     const matching = pending.notifications.filter(n => n.extra && n.extra.medicineId === medicineId);
    
//     if (matching.length > 0) {
//         await LocalNotifications.cancel({ notifications: matching });
//         console.log(`🗑️ Cleaned up ${matching.length} old alarms for ID: ${medicineId}`);
//     }
//   } catch (err) {
//     console.error("❌ Error cancelling alarms:", err);
//   }
// };

// // --- 2. Clear All Function ---
// export const cancelAllAlarms = async () => {
//     try {
//         const pending = await LocalNotifications.getPending();
//         if (pending.notifications.length > 0) {
//             await LocalNotifications.cancel(pending);
//             alert("All alarms cleared.");
//         }
//     } catch (err) {
//         console.error(err);
//     }
// };

// // --- 3. Optimized Schedule Function ---
// export const scheduleMedicineReminder = async (medicine) => {
//   try {
//     if (!medicine || !medicine.duration || !medicine.duration.endDate) {
//         console.error("⚠️ Cannot schedule: Missing data", medicine);
//         return;
//     }

//     // 1. Cancel OLD/EXISTING alarms first (This keeps the list clean!)
//     if (medicine._id) {
//         await cancelMedicineReminders(medicine._id);
//     }

//     // 2. Permission Check
//     const permission = await LocalNotifications.checkPermissions();
//     if (permission.display !== 'granted') {
//         const request = await LocalNotifications.requestPermissions();
//         if (request.display !== 'granted') return;
//     }

//     // 3. Create Channel
//     await LocalNotifications.createChannel({
//         id: 'medmind_alarm_v2', 
//         name: 'Medicine Alarms',
//         importance: 5,
//         visibility: 1,
//         vibration: true,
//         sound: 'alarm_sound.wav', 
//     });

//     const notificationsToSchedule = [];
    
//     // --- OPTIMIZED DATE LOGIC ---
//     const today = new Date();
//     today.setHours(0,0,0,0);

//     const startDate = new Date(medicine.duration.startDate);
//     startDate.setHours(0,0,0,0);

//     const endDate = new Date(medicine.duration.endDate);
//     endDate.setHours(0,0,0,0);

//     if (today > endDate) {
//         console.log("Skipping: Course ended.");
//         return;
//     }

//     // Start from Today or StartDate (whichever is later)
//     let currentDate = startDate > today ? startDate : today;

//     // 🔥 MEMORY PROTECTION: Only schedule the next 45 days
//     // Even if the course is 1 year long, we only put 45 days into the phone.
//     // The user will likely open the app within 45 days, which triggers a refill.
//     const MAX_DAYS_AHEAD = 45; 
//     let daysScheduled = 0;

//     while (currentDate <= endDate && daysScheduled < MAX_DAYS_AHEAD) {
        
//         medicine.times.forEach((timeString, index) => {
//             const [hours, minutes] = timeString.split(':').map(Number);
            
//             const triggerTime = new Date(currentDate);
//             triggerTime.setHours(hours, minutes, 0, 0);

//             // Skip times that have already passed TODAY
//             if (triggerTime < new Date()) return;

//             // Generate Unique ID
//             const uniqueId = (new Date().getTime() % 10000000) + (daysScheduled * 100) + index;

//             notificationsToSchedule.push({
//                 title: `Time to take ${medicine.name}`,
//                 body: `Dosage: ${medicine.dose}`,
//                 id: uniqueId,
//                 schedule: { 
//                     at: triggerTime,
//                     allowWhileIdle: true 
//                 },
//                 channelId: 'medmind_alarm_v2',
//                 sound: 'alarm_sound.wav',
//                 actionTypeId: 'TAKE_MEDICINE',
//                 extra: { medicineId: medicine._id }
//             });
//         });

//         // Next Day
//         currentDate.setDate(currentDate.getDate() + 1);
//         daysScheduled++;
//     }

//     if (notificationsToSchedule.length > 0) {
//         await LocalNotifications.schedule({ notifications: notificationsToSchedule });
//         console.log(`✅ Refilled schedule: ${notificationsToSchedule.length} alarms set for next ${daysScheduled} days.`);
//     }

//   } catch (error) {
//     console.error("❌ Schedule Error:", error);
//   }
// };






// import { LocalNotifications } from '@capacitor/local-notifications';

// // --- 1. Cancel Function (Stops specific medicine alarms) ---
// export const cancelMedicineReminders = async (medicineId) => {
//   try {
//     const pending = await LocalNotifications.getPending();
    
//     // Find all alarms that match this Medicine ID
//     const matching = pending.notifications.filter(n => n.extra && n.extra.medicineId === medicineId);
    
//     if (matching.length > 0) {
//         await LocalNotifications.cancel({ notifications: matching });
//         console.log(`🗑️ Deleted ${matching.length} alarms for medicine: ${medicineId}`);
//     } else {
//         console.log(`ℹ️ No active alarms found for medicine: ${medicineId}`);
//     }
//   } catch (err) {
//     console.error("❌ Error cancelling alarms:", err);
//   }
// };

// // --- 2. Nuke Function (Clears EVERYTHING - for fixing bugs) ---
// export const cancelAllAlarms = async () => {
//     try {
//         const pending = await LocalNotifications.getPending();
//         if (pending.notifications.length > 0) {
//             await LocalNotifications.cancel(pending);
//             console.log("☢️ CLEARED ALL ALARMS");
//             alert("All alarms cleared. Please click 'Resync' to set them again.");
//         } else {
//             alert("No alarms to clear.");
//         }
//     } catch (err) {
//         console.error(err);
//     }
// };

// // --- 3. The Main Schedule Function ---
// export const scheduleMedicineReminder = async (medicine) => {
//   try {
//     // --- 🛡️ SAFETY CHECK ---
//     if (!medicine || !medicine.duration || !medicine.duration.endDate) {
//         console.error("⚠️ Cannot schedule alarm: Missing duration data", medicine);
//         return;
//     }
//     // -----------------------

//     console.log("⏰ Scheduling logic started for:", medicine.name);

//     // 1. Cancel old alarms first to prevent duplicates
//     if (medicine._id) {
//         await cancelMedicineReminders(medicine._id);
//     }

//     // 2. Expiration Check
//     const today = new Date();
//     today.setHours(0, 0, 0, 0); 
//     const endDate = new Date(medicine.duration.endDate);
//     endDate.setHours(0, 0, 0, 0);

//     if (today > endDate) {
//         console.log(`Skipping alarm: Medicine expired.`);
//         return; 
//     }

//     // 3. Permission Check
//     const permission = await LocalNotifications.checkPermissions();
//     if (permission.display !== 'granted') {
//         const request = await LocalNotifications.requestPermissions();
//         if (request.display !== 'granted') return;
//     }

//     // 4. Create Channel
//     await LocalNotifications.createChannel({
//         id: 'medmind_alarm_v2', 
//         name: 'Medicine Alarms',
//         importance: 5,
//         visibility: 1,
//         vibration: true,
//         sound: 'alarm_sound.wav', 
//     });

//     const notificationsToSchedule = [];

//     // 5. Schedule Loop
//     medicine.times.forEach((timeString, index) => {
//         const [hours, minutes] = timeString.split(':').map(Number);
        
//         const triggerDate = new Date();
//         triggerDate.setHours(hours, minutes, 0, 0);

//         // If time has passed today, move to tomorrow
//         if (triggerDate < new Date()) {
//             triggerDate.setDate(triggerDate.getDate() + 1);
//         }

//         // Double check if tomorrow is past the end date
//         const triggerDateCheck = new Date(triggerDate);
//         triggerDateCheck.setHours(0,0,0,0);
//         if (triggerDateCheck > endDate) return;

//         // Small ID Logic (Fixes the "Java Int" crash)
//         const uniqueId = (new Date().getTime() % 100000000) + Math.floor(Math.random() * 10000) + index;

//         notificationsToSchedule.push({
//             title: `Time to take ${medicine.name}`,
//             body: `Dosage: ${medicine.dose} | Tap to confirm`,
//             id: uniqueId,
//             schedule: { 
//                 at: triggerDate,
//                 every: 'day',
//                 allowWhileIdle: true 
//             },
//             channelId: 'medmind_alarm_v2',
//             sound: 'alarm_sound.wav',
//             actionTypeId: 'TAKE_MEDICINE',
//             extra: { 
//                 medicineId: medicine._id 
//             }
//         });
//     });

//     if (notificationsToSchedule.length > 0) {
//         await LocalNotifications.schedule({ notifications: notificationsToSchedule });
//         console.log(`✅ Scheduled ${notificationsToSchedule.length} alarms for ${medicine.name}`);
//     }

//   } catch (error) {
//     console.error("❌ Schedule Error:", error);
//   }
// };








// // src/utils/LocalNotificationManager.js
// import { LocalNotifications } from '@capacitor/local-notifications';

// export const scheduleMedicineReminder = async (medicine) => {
//   try {
//     console.log("⏰ Scheduling logic started for:", medicine.name);

//     // 1. Expiration Check
//     const today = new Date();
//     today.setHours(0, 0, 0, 0); 
//     const endDate = new Date(medicine.duration.endDate);
//     endDate.setHours(0, 0, 0, 0);

//     if (today > endDate) {
//         console.log(`Skipping alarm: Medicine expired.`);
//         return; 
//     }

//     // 2. Permission Check
//     const permission = await LocalNotifications.checkPermissions();
//     if (permission.display !== 'granted') {
//         await LocalNotifications.requestPermissions();
//     }

//     // 3. Channel Creation
//     await LocalNotifications.createChannel({
//         id: 'medmind_alarm_v2', 
//         name: 'Medicine Alarms',
//         importance: 5,
//         visibility: 1,
//         vibration: true,
//         sound: 'alarm_sound.wav', 
//     });

//     const notificationsToSchedule = [];

//     // 4. Loop through times
//     medicine.times.forEach((timeString, index) => {
//         const [hours, minutes] = timeString.split(':').map(Number);
        
//         const triggerDate = new Date();
//         triggerDate.setHours(hours, minutes, 0, 0);

//         if (triggerDate < new Date()) {
//             triggerDate.setDate(triggerDate.getDate() + 1);
//         }

//         const triggerDateCheck = new Date(triggerDate);
//         triggerDateCheck.setHours(0,0,0,0);
//         if (triggerDateCheck > endDate) return;

//         // ============================================================
//         // 🔥 CRITICAL FIX: Make the ID smaller for Android (Java Int)
//         // We take the last 8 digits of the time and add a random number
//         // ============================================================
//         const uniqueId = (new Date().getTime() % 100000000) + Math.floor(Math.random() * 10000) + index;

//         notificationsToSchedule.push({
//             title: `Time to take ${medicine.name}`,
//             body: `Dosage: ${medicine.dose} | Tap to confirm`,
//             id: uniqueId, // <--- This is now a safe, small number
//             schedule: { 
//                 at: triggerDate,
//                 every: 'day',
//                 allowWhileIdle: true 
//             },
//             channelId: 'medmind_alarm_v2',
//             sound: 'alarm_sound.wav',
//             actionTypeId: 'TAKE_MEDICINE',
//             extra: { medicineId: medicine._id }
//         });
//     });

//     if (notificationsToSchedule.length > 0) {
//         await LocalNotifications.schedule({ notifications: notificationsToSchedule });
//         console.log(`✅ SUCCESSFULLY Scheduled ${notificationsToSchedule.length} alarms!`);
//     }

//   } catch (error) {
//     // This will now print the specific error if it fails again
//     console.error("❌ FATAL ERROR in Notification Schedule:", error);
//     throw error; // Throw it so addMedicine knows it failed
//   }
// };




// // frontend/src/utils/LocalNotificationManager.js
// import { LocalNotifications } from '@capacitor/local-notifications';

// export const scheduleMedicineReminder = async (medicine) => {
//   try {
//     // 1. Check/Request Permissions
//     const permission = await LocalNotifications.checkPermissions();
//     if (permission.display !== 'granted') {
//         const request = await LocalNotifications.requestPermissions();
//         if (request.display !== 'granted') return;
//     }

//     // 2. Create Android Channel (Essential for sound/priority)
//     // Note: 'alarm_sound.wav' must exist in android/app/src/main/res/raw/
//     // If you haven't added the sound file yet, remove the 'sound' line below for now.
//     await LocalNotifications.createChannel({
//         id: 'medmind_alarm_v2',
//         name: 'Medicine Alarms',
//         importance: 5,
//         visibility: 1,
//         vibration: true,
//         sound: 'alarm_sound.wav', 
//     });

//     // 3. Schedule the notification
//     const triggerTime = new Date(medicine.time); // Ensure this is a valid Date object

//     await LocalNotifications.schedule({
//       notifications: [
//         {
//           title: `Time to take ${medicine.name}`,
//           body: `Dosage: ${medicine.dosage}`,
//           id: new Date().getTime(), // Unique ID
//           schedule: { 
//               at: triggerTime,
//               allowWhileIdle: true 
//           },
//           channelId: 'medmind_alarm_v2',
//           sound: 'alarm_sound.wav',
//           actionTypeId: 'TAKE_MEDICINE',
//         }
//       ]
//     });
//     console.log("Notification Scheduled for:", triggerTime);

//   } catch (error) {
//     console.error("Failed to schedule notification:", error);
//   }
// };