package com.medmind.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class EmergencyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d("EmergencyReceiver", "✅ Received emergency broadcast");

        String name = intent.getStringExtra("name");
        String phone = intent.getStringExtra("phone");
        String blood = intent.getStringExtra("blood");
        String allergies = intent.getStringExtra("allergies");
        String meds = intent.getStringExtra("meds");
        String mapLink = intent.getStringExtra("mapLink");
        String smsEnabled = intent.getStringExtra("smsEnabled");

        // Show full screen notification — this WORKS from background
        EmergencyInfoHelper.showEmergencyFullScreen(
            context, name, phone, blood, allergies, meds, mapLink, smsEnabled
        );
    }
}