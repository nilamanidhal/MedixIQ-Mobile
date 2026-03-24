package com.medmind.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class EmergencyInfoHelper {

    public static void showLockScreenMedicalId(Context context, String name, String bloodGroup, String allergies, String meds) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "EmergencyMedicalId";

        // 1. Create a High-Priority Channel
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    channelId, "Emergency Medical ID", NotificationManager.IMPORTANCE_HIGH);
            // 🔥 CRITICAL: Force it to show on the lock screen bypassing privacy hiding
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC); 
            manager.createNotificationChannel(channel);
        }

        // 2. Wake up the phone screen!
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "MedMind::EmergencyWakeLock");
            wakeLock.acquire(3000); // Turn screen on for 3 seconds
        }

        // 3. Create the massive text block
        String text = "Blood Type: " + bloodGroup + "\nAllergies: " + allergies + "\nActive Meds: " + meds;
        
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);

        // 4. Build the Lock Screen Notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("🚨 MEDICAL ID: " + name)
                .setContentText("Expand for critical details")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text)) // Allows multi-line text
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // 🔥 SHOW ON LOCK SCREEN
                .setOngoing(true) // Cannot be swiped away easily
                .setFullScreenIntent(pendingIntent, true); // Acts like an incoming call

        manager.notify(911, builder.build());
    }
}










// package com.medmind.app;

// import android.app.NotificationChannel;
// import android.app.NotificationManager;
// import android.app.PendingIntent;
// import android.content.Context;
// import android.content.Intent;
// import android.os.Build;
// import androidx.core.app.NotificationCompat;

// public class EmergencyInfoHelper {
//     private static final String CHANNEL_ID = "MedicalIDChannel";

//     public static void showLockScreenMedicalId(Context context, String token, String name, String bloodGroup) {
//         NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

//         // 1. Create a high-priority channel
//         if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
//             NotificationChannel channel = new NotificationChannel(
//                     CHANNEL_ID, "Medical ID (Emergency)", NotificationManager.IMPORTANCE_HIGH);
//             channel.setDescription("Shows Medical ID on lock screen");
//             // Ensure it shows on the lock screen
//             channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC); 
//             manager.createNotificationChannel(channel);
//         }

//         // 2. Intent to open the app (You will need to handle deep linking in Capacitor, 
//         // or just launch the MainActivity which routes to the emergency page)
//         Intent intent = new Intent(context, MainActivity.class);
//         intent.putExtra("emergency_token", token);
//         intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
//         PendingIntent pendingIntent = PendingIntent.getActivity(
//                 context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

//         // 3. Build the Public Notification
//         NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
//                 .setSmallIcon(android.R.drawable.ic_menu_info_details) // Change to your app icon
//                 .setContentTitle("🆘 MEDICAL ID: " + (name != null ? name : "Patient"))
//                 .setContentText("Blood: " + (bloodGroup != null ? bloodGroup : "Unknown") + " — Tap for full info")
//                 .setPriority(NotificationCompat.PRIORITY_MAX)
//                 .setCategory(NotificationCompat.CATEGORY_ALARM)
//                 .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // 🔥 CRITICAL FOR LOCK SCREEN
//                 .setOngoing(true) // Cannot be swiped away easily
//                 .setContentIntent(pendingIntent);

//         manager.notify(911, builder.build());
//     }
// }