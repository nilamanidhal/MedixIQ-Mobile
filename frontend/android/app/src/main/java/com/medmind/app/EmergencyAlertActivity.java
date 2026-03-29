package com.medmind.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.Handler;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.util.Log;

public class EmergencyAlertActivity extends Activity {

    private CountDownTimer countDownTimer;
    private String name, phone, blood, allergies, meds, mapLink, smsEnabled;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ✅ Show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Get intent data
        name = getIntent().getStringExtra("name");
        phone = getIntent().getStringExtra("phone");
        blood = getIntent().getStringExtra("blood");
        allergies = getIntent().getStringExtra("allergies");
        meds = getIntent().getStringExtra("meds");
        mapLink = getIntent().getStringExtra("mapLink");
        smsEnabled = getIntent().getStringExtra("smsEnabled");
        if (smsEnabled == null) smsEnabled = "true";

        buildUI();
    }

    private void buildUI() {
        // ── Root Layout (RED background) ──
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#B71C1C"));
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(48, 80, 48, 80);

        // ── Warning Icon + Title ──
        TextView icon = new TextView(this);
        icon.setText("🚨");
        icon.setTextSize(64);
        icon.setGravity(Gravity.CENTER);
        icon.setPadding(0, 0, 0, 8);

        TextView title = new TextView(this);
        title.setText("ACCIDENT DETECTED");
        title.setTextColor(Color.WHITE);
        title.setTextSize(30);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, 12);

        // ── Countdown number ──
        TextView countdown = new TextView(this);
        countdown.setTextColor(Color.WHITE);
        countdown.setTextSize(96);
        countdown.setTypeface(null, Typeface.BOLD);
        countdown.setGravity(Gravity.CENTER);
        countdown.setPadding(0, 0, 0, 8);

        // ── Subtitle ──
        TextView subtitle = new TextView(this);
        boolean willSendSms = "true".equals(smsEnabled);
        subtitle.setText(willSendSms
            ? "Emergency SMS will be sent automatically"
            : "Emergency details will be shown");
        subtitle.setTextColor(Color.parseColor("#FFCDD2"));
        subtitle.setTextSize(15);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 0, 0, 48);

        // ── I AM SAFE button ──
        Button safeBtn = new Button(this);
        safeBtn.setText("✅  I AM SAFE — CANCEL");
        safeBtn.setTextSize(18);
        safeBtn.setTypeface(null, Typeface.BOLD);
        safeBtn.setBackgroundColor(Color.WHITE);
        safeBtn.setTextColor(Color.parseColor("#B71C1C"));
        safeBtn.setPadding(60, 32, 60, 32);
safeBtn.setOnClickListener(v -> {
    if (countDownTimer != null) countDownTimer.cancel();
    
    // ✅ SMS cancel permanently for this trigger
    getSharedPreferences("CapacitorStorage", MODE_PRIVATE)
        .edit()
        .remove("pending_accident")
        .putString("accident_cancelled", "true")  // ✅ flag
        .apply();
    
    // Cancel the ongoing notification
    ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE))
        .cancel(912);
    
    finish();
});

        root.addView(icon);
        root.addView(title);
        root.addView(countdown);
        root.addView(subtitle);
        root.addView(safeBtn);
        setContentView(root);

        // ── Start 10 second countdown ──
        countDownTimer = new CountDownTimer(10000, 1000) {
            @Override
            public void onTick(long ms) {
                countdown.setText(String.valueOf(ms / 1000));
            }

            @Override
            public void onFinish() {
                countdown.setText("0");
                onCountdownFinished();
            }
        }.start();
    }

private void onCountdownFinished() {

    // ✅ Check if cancelled
    SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
    String cancelled = prefs.getString("accident_cancelled", "false");
    if ("true".equals(cancelled)) {
        prefs.edit().remove("accident_cancelled").apply();
        finish();
        return;
    }

    try {
        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);

        // Try last known first
        Location loc = null;
        try {
            loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (loc == null) loc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            if (loc == null) loc = lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
        } catch (SecurityException e) {
            Log.e("EmergencyAlert", "Location permission error", e);
        }

        String finalMapLink = loc != null
            ? "https://www.google.com/maps?q=" + loc.getLatitude() + "," + loc.getLongitude()
            : "Location unavailable";

        Log.d("EmergencyAlert", "Final location: " + finalMapLink);

        if ("true".equals(smsEnabled)) {
            sendEmergencySms(finalMapLink);
        }
        showEmergencyInfoScreen(finalMapLink);

        // ✅ Also request fresh GPS — send follow-up SMS when available
        if ("true".equals(smsEnabled)) {
            try {
                lm.requestSingleUpdate(LocationManager.GPS_PROVIDER,
                    freshLoc -> {
                        String freshLink = "https://www.google.com/maps?q="
                            + freshLoc.getLatitude() + "," + freshLoc.getLongitude();
                        SmsHelper.sendSms(phone,
                            "📍 Updated location for " + name + ": " + freshLink);
                        Log.d("EmergencyAlert", "✅ Fresh GPS SMS sent");
                    },
                    null
                );
            } catch (SecurityException e) {
                Log.e("EmergencyAlert", "Fresh GPS error", e);
            }
        }

    } catch (Exception e) {
        Log.e("EmergencyAlert", "Error in countdown finish", e);
        if ("true".equals(smsEnabled)) sendEmergencySms("Location unavailable");
        showEmergencyInfoScreen("Location unavailable");
    }
}

    private void sendEmergencySms(String locationLink) {
        if (phone == null || phone.trim().isEmpty()) {
            Log.e("EmergencyAlert", "No phone number");
            return;
        }
        String message = "🚨 EMERGENCY - MedixIQ Alert\n"
            + name + " may be in an accident.\n"
            + "Location: " + locationLink + "\n"
            + "Blood: " + blood + "\n"
            + "Allergies: " + allergies + "\n"
            + "Meds: " + meds;
        SmsHelper.sendSms(phone, message);
        Log.d("EmergencyAlert", "✅ SMS sent after countdown");
    }

   private void showEmergencyInfoScreen(String locationLink) {
    ScrollView scrollView = new ScrollView(this);
    scrollView.setBackgroundColor(Color.parseColor("#1A1A2E"));

    LinearLayout layout = new LinearLayout(this);
    layout.setOrientation(LinearLayout.VERTICAL);
    layout.setPadding(48, 80, 48, 80);
    layout.setGravity(Gravity.CENTER_HORIZONTAL);

    addInfoRow(layout, "🚨 EMERGENCY DETAILS", "", true, "#FF5252");
    addInfoRow(layout, "Name", name != null ? name : "Unknown", false, "#FFFFFF");
    addInfoRow(layout, "Blood Type", blood != null ? blood : "Unknown", false, "#FF5252");
    addInfoRow(layout, "Allergies", allergies != null ? allergies : "None", false, "#FF9800");
    addInfoRow(layout, "Medications", meds != null ? meds : "None", false, "#FFFFFF");
    addInfoRow(layout, "📍 Location", locationLink, false, "#64B5F6");

    // ✅ FIX 4 — Emergency contact number add karo
    if (phone != null && !phone.isEmpty()) {
        addInfoRow(layout, "🆘 Emergency Contact", phone, false, "#69F0AE");
        
        // ✅ Call button bhi add karo
        Button callBtn = new Button(this);
        callBtn.setText("📞  CALL EMERGENCY CONTACT");
        callBtn.setTextColor(Color.WHITE);
        callBtn.setBackgroundColor(Color.parseColor("#1B5E20"));
        callBtn.setTextSize(16);
        callBtn.setPadding(40, 24, 40, 24);
        callBtn.setOnClickListener(v -> {
            try {
                Intent callIntent = new Intent(Intent.ACTION_DIAL);
                callIntent.setData(android.net.Uri.parse("tel:" + phone));
                callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(callIntent);
            } catch (Exception e) {
                Log.e("EmergencyAlert", "Call failed", e);
            }
        });

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        btnParams.topMargin = 16;
        btnParams.bottomMargin = 16;
        layout.addView(callBtn, btnParams);
    }

    // Close button
    Button closeBtn = new Button(this);
    closeBtn.setText("CLOSE");
    closeBtn.setTextColor(Color.WHITE);
    closeBtn.setBackgroundColor(Color.parseColor("#333355"));
    closeBtn.setPadding(40, 24, 40, 24);
    closeBtn.setOnClickListener(v -> {
        ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE))
            .cancel(912); // Clear notification bhi
        finish();
    });

    LinearLayout.LayoutParams closeBtnParams = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
    );
    closeBtnParams.topMargin = 32;
    layout.addView(closeBtn, closeBtnParams);

    scrollView.addView(layout);
    setContentView(scrollView);
}

    private void addInfoRow(LinearLayout parent, String label, String value,
                             boolean isHeader, String valueColor) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        rowParams.bottomMargin = 24;
        row.setLayoutParams(rowParams);

        if (!label.isEmpty()) {
            TextView labelView = new TextView(this);
            labelView.setText(label);
            labelView.setTextColor(Color.parseColor("#AAAAAA"));
            labelView.setTextSize(isHeader ? 22 : 13);
            labelView.setTypeface(null, isHeader ? Typeface.BOLD : Typeface.NORMAL);
            row.addView(labelView);
        }

        if (!value.isEmpty()) {
            TextView valueView = new TextView(this);
            valueView.setText(value);
            valueView.setTextColor(Color.parseColor(valueColor));
            valueView.setTextSize(isHeader ? 18 : 18);
            valueView.setTypeface(null, Typeface.BOLD);
            row.addView(valueView);
        }

        parent.addView(row);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (countDownTimer != null) countDownTimer.cancel();
    }
}