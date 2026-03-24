package com.medmind.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.Build;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import android.widget.LinearLayout;
import android.view.Gravity;

public class EmergencyAlertActivity extends Activity {

    private CountDownTimer countDownTimer;

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
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // ✅ Build red alert UI programmatically (no XML needed)
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#CC0000"));
        root.setGravity(Gravity.CENTER);
        root.setPadding(60, 100, 60, 100);

        // Title
        TextView title = new TextView(this);
        title.setText("🚨 ACCIDENT DETECTED");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, 20);

        // Subtitle
        TextView subtitle = new TextView(this);
        subtitle.setText("Emergency SMS will be sent in...");
        subtitle.setTextColor(Color.WHITE);
        subtitle.setTextSize(16);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 0, 0, 40);

        // Countdown
        TextView countdown = new TextView(this);
        countdown.setText("10");
        countdown.setTextColor(Color.WHITE);
        countdown.setTextSize(72);
        countdown.setGravity(Gravity.CENTER);
        countdown.setPadding(0, 0, 0, 60);

        // Cancel button
        Button cancelBtn = new Button(this);
        cancelBtn.setText("I AM SAFE — CANCEL");
        cancelBtn.setTextSize(18);
        cancelBtn.setBackgroundColor(Color.WHITE);
        cancelBtn.setTextColor(Color.parseColor("#CC0000"));
        cancelBtn.setPadding(40, 20, 40, 20);
        cancelBtn.setOnClickListener(v -> {
            if (countDownTimer != null) countDownTimer.cancel();
            finish();
        });

        root.addView(title);
        root.addView(subtitle);
        root.addView(countdown);
        root.addView(cancelBtn);
        setContentView(root);

        // ✅ Get data from intent
        String name = getIntent().getStringExtra("name");
        String phone = getIntent().getStringExtra("phone");
        String blood = getIntent().getStringExtra("blood");
        String allergies = getIntent().getStringExtra("allergies");
        String meds = getIntent().getStringExtra("meds");
        String mapLink = getIntent().getStringExtra("mapLink");

        // ✅ 10 second countdown
        countDownTimer = new CountDownTimer(10000, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                countdown.setText(String.valueOf(millisUntilFinished / 1000));
            }

            @Override
            public void onFinish() {
                countdown.setText("0");
                // Send SMS
                if (phone != null && !phone.isEmpty()) {
                    String message = "🚨 EMERGENCY - MedixIQ Alert\n"
                        + name + " may be in an accident.\n"
                        + "Location: " + mapLink + "\n"
                        + "Blood: " + blood + "\n"
                        + "Allergies: " + allergies + "\n"
                        + "Meds: " + meds;
                    SmsHelper.sendSms(phone, message);
                }
                finish();
            }
        }.start();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (countDownTimer != null) countDownTimer.cancel();
    }
}