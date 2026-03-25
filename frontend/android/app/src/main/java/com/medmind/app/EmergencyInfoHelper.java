package com.medmind.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class EmergencyInfoHelper {

    // ── Called from SentinelService (lock screen medical ID only) ──
    public static void showLockScreenMedicalId(
        Context context, String name, String blood,
        String allergies, String meds
    ) {
        NotificationManager manager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "EmergencyMedicalId";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId, "Emergency Medical ID",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(channel);
        }

        // Wake screen
        wakeScreen(context);

        String text = "Blood: " + blood + "\nAllergies: " + allergies + "\nMeds: " + meds;

        Notification notification = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("🚨 MEDICAL ID: " + name)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .build();

        manager.notify(911, notification);
    }

    // ── Called from EmergencyReceiver — shows countdown activity via fullScreenIntent ──
    public static void showEmergencyFullScreen(
        Context context, String name, String phone,
        String blood, String allergies, String meds,
        String mapLink, String smsEnabled
    ) {
        NotificationManager manager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "EmergencyAlert";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId, "Emergency Alert",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            // ✅ Allow full screen on lock screen
            channel.setBypassDnd(true);
            manager.createNotificationChannel(channel);
        }

        // Wake screen
        wakeScreen(context);

        // Intent for EmergencyAlertActivity
        Intent activityIntent = new Intent(context, EmergencyAlertActivity.class);
        activityIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        activityIntent.putExtra("name", name);
        activityIntent.putExtra("phone", phone);
        activityIntent.putExtra("blood", blood);
        activityIntent.putExtra("allergies", allergies);
        activityIntent.putExtra("meds", meds);
        activityIntent.putExtra("mapLink", mapLink);
        activityIntent.putExtra("smsEnabled", smsEnabled);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            context, 1, activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // ✅ fullScreenIntent notification — this bypasses BAL restriction!
        Notification notification = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("🚨 ACCIDENT DETECTED!")
            .setContentText("Emergency SMS in 10 seconds — Tap to cancel")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL) // CALL category bypasses BAL!
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true) // ✅ KEY: auto-launches activity
            .setContentIntent(fullScreenPendingIntent)
            .build();

        manager.notify(912, notification);
        Log.d("EmergencyInfoHelper", "✅ Full screen emergency notification shown");
    }

    private static void wakeScreen(Context context) {
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "MedMind::EmergencyWakeLock"
                );
                wl.acquire(5000);
            }
        } catch (Exception e) {
            Log.e("EmergencyInfoHelper", "WakeLock error", e);
        }
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