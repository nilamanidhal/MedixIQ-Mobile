package com.medmind.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.app.PendingIntent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;
import android.app.AlarmManager;

public class SentinelService extends Service implements SensorEventListener {

    private static final String CHANNEL_ID = "SentinelChannel";
    private static final float ACCIDENT_THRESHOLD_G = 1.5f; // G-force threshold
    private static final long COOLDOWN_MS = 30000; // 30 sec cooldown after detection

// ✅ YE LINE ADD KARO — pluginInstance declare karo
    public static SentinelPlugin pluginInstance = null;


    private PowerManager.WakeLock wakeLock;
    private SensorManager sensorManager;
    private Sensor accelerometer;

    private long lastAccidentTime = 0;
    private float[] gravity = {0, 0, 0};

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquireWakeLock();
        startAccelerometer();
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "MedMind::SentinelWakeLock"
            );
            wakeLock.acquire();
        }
    }

    private void startAccelerometer() {
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            if (accelerometer != null) {
                // SENSOR_DELAY_NORMAL is enough — saves battery
                sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_NORMAL);
                Log.d("SentinelService", "✅ Accelerometer started natively");
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🧠 ACCIDENT DETECTION ALGORITHM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) return;

        // Low-pass filter to isolate gravity
        final float alpha = 0.8f;
        gravity[0] = alpha * gravity[0] + (1 - alpha) * event.values[0];
        gravity[1] = alpha * gravity[1] + (1 - alpha) * event.values[1];
        gravity[2] = alpha * gravity[2] + (1 - alpha) * event.values[2];

        // High-pass filter to isolate linear acceleration (remove gravity)
        float linearX = event.values[0] - gravity[0];
        float linearY = event.values[1] - gravity[1];
        float linearZ = event.values[2] - gravity[2];

        // Calculate G-force magnitude
        double gForce = Math.sqrt(linearX * linearX + linearY * linearY + linearZ * linearZ) / 9.81;

        // Cooldown check — don't spam
        long now = System.currentTimeMillis();
        if (now - lastAccidentTime < COOLDOWN_MS) return;

        // ✅ Accident detected!
        if (gForce > ACCIDENT_THRESHOLD_G) {
            lastAccidentTime = now;
            Log.d("SentinelService", "🚨 Accident detected! G-force: " + gForce);
            triggerEmergencyFromService();
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🚨 EMERGENCY TRIGGER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SentinelService.java mein triggerEmergencyFromService() update karo

private void triggerEmergencyFromService() {
    SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
    String name = prefs.getString("emergency_name", "Unknown");
    String blood = prefs.getString("emergency_blood", "Unknown");
    String allergies = prefs.getString("emergency_allergies", "None");
    String meds = prefs.getString("emergency_meds", "None");
    String phone = prefs.getString("emergency_phone", "");
    String smsEnabled = prefs.getString("sentinel_sms_enabled", "true");

    Log.d("SentinelService", "🚨 Triggering: " + name + " | Phone: " + phone + " | SMS: " + smsEnabled);

    // Save timestamp + pending flag
    prefs.edit()
        .putString("pending_accident", "true")
        .putString("accident_timestamp", String.valueOf(System.currentTimeMillis()))
        .apply();

    String mapLink = getLastKnownMapLink();

    // ✅ Broadcast → EmergencyReceiver → fullScreenIntent notification
    Intent broadcastIntent = new Intent(this, EmergencyReceiver.class);
    broadcastIntent.putExtra("name", name);
    broadcastIntent.putExtra("phone", phone);
    broadcastIntent.putExtra("blood", blood);
    broadcastIntent.putExtra("allergies", allergies);
    broadcastIntent.putExtra("meds", meds);
    broadcastIntent.putExtra("mapLink", mapLink);
    broadcastIntent.putExtra("smsEnabled", smsEnabled);
    sendBroadcast(broadcastIntent);

    // ✅ Medical ID lock screen — 11 sec baad (after countdown)
    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
        SharedPreferences p = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        if (!"true".equals(p.getString("accident_cancelled", "false"))) {
            EmergencyInfoHelper.showLockScreenMedicalId(this, name, blood, allergies, meds, phone);
        }
    }, 11000);

    // Notify React if app open
    SentinelPlugin.fireAccidentEvent(pluginInstance);
}

private String getLastKnownMapLink() {
    try {
        LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        Location loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        if (loc == null) loc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
        if (loc != null) {
            return "https://www.google.com/maps?q=" + loc.getLatitude() + "," + loc.getLongitude();
        }
    } catch (SecurityException e) {
        Log.e("SentinelService", "Location permission missing", e);
    }
    return "Location unavailable";
}

private void launchEmergencyAlertViaPendingIntent(
    String name, String phone, String blood,
    String allergies, String meds, String mapLink, String smsEnabled
) {
    try {
        Intent alertIntent = new Intent(this, EmergencyAlertActivity.class);
        alertIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        alertIntent.putExtra("name", name);
        alertIntent.putExtra("phone", phone);
        alertIntent.putExtra("blood", blood);
        alertIntent.putExtra("allergies", allergies);
        alertIntent.putExtra("meds", meds);
        alertIntent.putExtra("mapLink", mapLink);
        alertIntent.putExtra("smsEnabled", smsEnabled);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, alertIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // ✅ AlarmManager — guaranteed launch even from background
        AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    System.currentTimeMillis() + 100, // 100ms baad — almost instant
                    pendingIntent
                );
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    System.currentTimeMillis() + 100,
                    pendingIntent
                );
            }
            Log.d("SentinelService", "✅ Emergency alert scheduled via AlarmManager");
        }

        // ✅ Also show lock screen notification as backup
        EmergencyInfoHelper.showLockScreenMedicalId(this, name, blood, allergies, meds, phone);

    } catch (Exception e) {
        Log.e("SentinelService", "Alert launch failed: " + e.getMessage());
    }
}

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // FOREGROUND SERVICE SETUP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@Override
public int onStartCommand(Intent intent, int flags, int startId) {
    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("🛡️ MedixIQ Sentinel Active")
        .setContentText("Monitoring for accident detection...")
        .setSmallIcon(android.R.drawable.ic_dialog_alert)
        .setOngoing(true)
        .build();

    try {
        // ✅ Android 14+ — try location type pehle
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                startForeground(1, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                Log.d("SentinelService", "✅ FGS started with LOCATION type");
            } catch (Exception locationEx) {
                // ✅ Location permission nahi mili — bina location type ke start karo
                // Sensor still works, sirf GPS nahi milega
                Log.w("SentinelService", "⚠️ Location FGS failed, starting without location: " + locationEx.getMessage());
                startForeground(1, notification);
                Log.d("SentinelService", "✅ FGS started without location type");
            }
        } else {
            startForeground(1, notification);
        }
    } catch (Exception e) {
        Log.e("SentinelService", "FGS start completely failed: " + e.getMessage());
        stopSelf();
        return START_NOT_STICKY;
    }

    return START_STICKY;
}

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (sensorManager != null) sensorManager.unregisterListener(this);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        Log.d("SentinelService", "Sentinel stopped");
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Sentinel Monitoring", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }


    private void fetchLiveLocationAndSendSms(
    String name, String blood,
    String allergies, String meds, String phone
) {
    try {
        LocationManager locationManager =
            (LocationManager) getSystemService(Context.LOCATION_SERVICE);

        // ✅ Try last known location first (instant, no wait)
        Location lastKnown = null;

        try {
            lastKnown = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (lastKnown == null) {
                lastKnown = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
        } catch (SecurityException e) {
            android.util.Log.e("SentinelService", "Location permission missing", e);
        }

        if (lastKnown != null) {
            // Good enough — send SMS immediately with last known
            sendEmergencySmsFromJava(name, blood, allergies, meds, phone, lastKnown);
        } else {
            // No cached location — send SMS with unknown location
            sendEmergencySmsFromJava(name, blood, allergies, meds, phone, null);
        }

        // ✅ Also request a fresh location update (arrives in ~5 sec)
        // If it arrives, send a follow-up SMS with exact location
        try {
            locationManager.requestSingleUpdate(
                LocationManager.GPS_PROVIDER,
                new LocationListener() {
                    @Override
                    public void onLocationChanged(Location freshLoc) {
                        android.util.Log.d("SentinelService", "Fresh GPS: " + freshLoc.getLatitude());
                        // Send updated location SMS
                        String mapLink = "https://www.google.com/maps?q="
                            + freshLoc.getLatitude() + "," + freshLoc.getLongitude();
                        String updateMsg = "📍 UPDATED LOCATION for " + name + ": " + mapLink;
                        SmsHelper.sendSms(phone, updateMsg);
                    }
                    @Override public void onStatusChanged(String p, int s, Bundle b) {}
                    @Override public void onProviderEnabled(String p) {}
                    @Override public void onProviderDisabled(String p) {}
                },
                Looper.getMainLooper()
            );
        } catch (SecurityException e) {
            android.util.Log.e("SentinelService", "Fresh GPS request failed", e);
        }

    } catch (Exception e) {
        android.util.Log.e("SentinelService", "GPS fetch error", e);
        sendEmergencySmsFromJava(name, blood, allergies, meds, phone, null);
    }
}

private void sendEmergencySmsFromJava(
    String name, String blood,
    String allergies, String meds,
    String phone, Location loc
) {

     // ✅ Debug log
    Log.d("SentinelService", "Phone: " + phone);
    Log.d("SentinelService", "Name: " + name);
    Log.d("SentinelService", "Blood: " + blood);

    if (phone == null || phone.isEmpty()) {
        Log.e("SentinelService", "❌ No phone number — SMS not sent");
        return;
    }
     // Debug log end

    String mapLink = loc != null
        ? "https://www.google.com/maps?q=" + loc.getLatitude() + "," + loc.getLongitude()
        : "Location unavailable";

    String message = "🚨 EMERGENCY - MedixIQ Alert\n"
        + name + " may be in an accident.\n"
        + "Location: " + mapLink + "\n"
        + "Blood: " + blood + "\n"
        + "Allergies: " + allergies + "\n"
        + "Meds: " + meds;

    if (phone != null && !phone.isEmpty()) {
        SmsHelper.sendSms(phone, message);
        android.util.Log.d("SentinelService", "✅ Emergency SMS sent to " + phone);
    }

    // ✅ Notify JS layer via notifyListeners (race condition safe)
    SentinelPlugin.fireAccidentEvent(SentinelService.pluginInstance);
}
}


















// package com.medmind.app;

// import android.app.Notification;
// import android.app.NotificationChannel;
// import android.app.NotificationManager;
// import android.app.Service;
// import android.content.Intent;
// import android.os.Build;
// import android.os.IBinder;
// import android.util.Log;
// import androidx.core.app.NotificationCompat;

// public class SentinelService extends Service {
//     private static final String CHANNEL_ID = "SentinelChannel";

//     @Override
//     public void onCreate() {
//         super.onCreate();
//         createNotificationChannel();
//     }

//     @Override
//     public int onStartCommand(Intent intent, int flags, int startId) {
//         Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
//                 .setContentTitle("🛡️ MedixIQ Sentinel Active")
//                 .setContentText("Monitoring for accident detection...")
//                 .setSmallIcon(android.R.drawable.ic_dialog_alert) // Uses default icon
//                 .setOngoing(true)
//                 .build();

//         try {
//             // 👇 Android 14 strict check: This will gracefully fail instead of crashing 
//             // if the user hasn't granted "Allow all the time" location access yet.
//             startForeground(1, notification);
//         } catch (SecurityException e) {
//             Log.e("SentinelService", "Lacking permissions to start Sentinel FGS", e);
//             // Gracefully stop the service so the app survives
//             stopSelf();
//             return START_NOT_STICKY;
//         } catch (Exception e) {
//             Log.e("SentinelService", "Error starting Sentinel", e);
//             stopSelf();
//             return START_NOT_STICKY;
//         }
        
//         return START_STICKY; 
//     }

//     @Override
//     public IBinder onBind(Intent intent) {
//         return null; 
//     }

//     private void createNotificationChannel() {
//         if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
//             NotificationChannel channel = new NotificationChannel(
//                     CHANNEL_ID, "Sentinel Monitoring", NotificationManager.IMPORTANCE_LOW);
//             NotificationManager manager = getSystemService(NotificationManager.class);
//             if (manager != null) {
//                 manager.createNotificationChannel(channel);
//             }
//         }
//     }
// }