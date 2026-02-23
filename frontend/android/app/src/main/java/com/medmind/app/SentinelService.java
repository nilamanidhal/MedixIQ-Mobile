package com.medmind.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class SentinelService extends Service {
    private static final String CHANNEL_ID = "SentinelChannel";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("🛡️ MedixIQ Sentinel Active")
                .setContentText("Monitoring for accident detection...")
                .setSmallIcon(android.R.drawable.ic_dialog_alert) // Uses default icon
                .setOngoing(true)
                .build();

        try {
            // 👇 Android 14 strict check: This will gracefully fail instead of crashing 
            // if the user hasn't granted "Allow all the time" location access yet.
            startForeground(1, notification);
        } catch (SecurityException e) {
            Log.e("SentinelService", "Lacking permissions to start Sentinel FGS", e);
            // Gracefully stop the service so the app survives
            stopSelf();
            return START_NOT_STICKY;
        } catch (Exception e) {
            Log.e("SentinelService", "Error starting Sentinel", e);
            stopSelf();
            return START_NOT_STICKY;
        }
        
        return START_STICKY; 
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; 
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Sentinel Monitoring", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}