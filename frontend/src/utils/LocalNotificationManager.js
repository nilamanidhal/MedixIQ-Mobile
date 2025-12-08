// src/utils/LocalNotificationManager.js
import { LocalNotifications } from '@capacitor/local-notifications';

export const scheduleMedicineReminder = async (medicine) => {
  try {
    console.log("⏰ Scheduling logic started for:", medicine.name);

    // 1. Expiration Check
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const endDate = new Date(medicine.duration.endDate);
    endDate.setHours(0, 0, 0, 0);

    if (today > endDate) {
        console.log(`Skipping alarm: Medicine expired.`);
        return; 
    }

    // 2. Permission Check
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
        await LocalNotifications.requestPermissions();
    }

    // 3. Channel Creation
    await LocalNotifications.createChannel({
        id: 'medmind_alarm_v2', 
        name: 'Medicine Alarms',
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: 'alarm_sound.wav', 
    });

    const notificationsToSchedule = [];

    // 4. Loop through times
    medicine.times.forEach((timeString, index) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        
        const triggerDate = new Date();
        triggerDate.setHours(hours, minutes, 0, 0);

        if (triggerDate < new Date()) {
            triggerDate.setDate(triggerDate.getDate() + 1);
        }

        const triggerDateCheck = new Date(triggerDate);
        triggerDateCheck.setHours(0,0,0,0);
        if (triggerDateCheck > endDate) return;

        // ============================================================
        // 🔥 CRITICAL FIX: Make the ID smaller for Android (Java Int)
        // We take the last 8 digits of the time and add a random number
        // ============================================================
        const uniqueId = (new Date().getTime() % 100000000) + Math.floor(Math.random() * 10000) + index;

        notificationsToSchedule.push({
            title: `Time to take ${medicine.name}`,
            body: `Dosage: ${medicine.dose} | Tap to confirm`,
            id: uniqueId, // <--- This is now a safe, small number
            schedule: { 
                at: triggerDate,
                every: 'day',
                allowWhileIdle: true 
            },
            channelId: 'medmind_alarm_v2',
            sound: 'alarm_sound.wav',
            actionTypeId: 'TAKE_MEDICINE',
            extra: { medicineId: medicine._id }
        });
    });

    if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
        console.log(`✅ SUCCESSFULLY Scheduled ${notificationsToSchedule.length} alarms!`);
    }

  } catch (error) {
    // This will now print the specific error if it fails again
    console.error("❌ FATAL ERROR in Notification Schedule:", error);
    throw error; // Throw it so addMedicine knows it failed
  }
};




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