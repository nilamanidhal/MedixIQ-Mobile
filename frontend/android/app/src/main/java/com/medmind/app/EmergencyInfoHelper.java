package com.medmind.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public class EmergencyInfoHelper {
    private static final String CHANNEL_ID = "MedicalIDChannel";

    public static void showLockScreenMedicalId(Context context, String token, String name, String bloodGroup) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // 1. Create a high-priority channel
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Medical ID (Emergency)", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Shows Medical ID on lock screen");
            // Ensure it shows on the lock screen
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC); 
            manager.createNotificationChannel(channel);
        }

        // 2. Intent to open the app (You will need to handle deep linking in Capacitor, 
        // or just launch the MainActivity which routes to the emergency page)
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("emergency_token", token);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // 3. Build the Public Notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_info_details) // Change to your app icon
                .setContentTitle("🆘 MEDICAL ID: " + (name != null ? name : "Patient"))
                .setContentText("Blood: " + (bloodGroup != null ? bloodGroup : "Unknown") + " — Tap for full info")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // 🔥 CRITICAL FOR LOCK SCREEN
                .setOngoing(true) // Cannot be swiped away easily
                .setContentIntent(pendingIntent);

        manager.notify(911, builder.build());
    }
}