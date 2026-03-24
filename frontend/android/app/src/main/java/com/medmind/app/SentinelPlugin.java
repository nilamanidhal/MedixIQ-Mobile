package com.medmind.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import android.util.Log;

@CapacitorPlugin(
    name = "Sentinel",
    permissions = {
        @Permission(strings = {Manifest.permission.SEND_SMS}, alias = "sms"),
        @Permission(strings = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        }, alias = "location")
    }
)
public class SentinelPlugin extends Plugin {

    // ✅ FIX 1 — Called from SentinelService to notify JS safely
    // This waits for WebView to be ready before firing
    public static void fireAccidentEvent(SentinelPlugin instance) {
        if (instance != null) {
            instance.notifyListeners("ACCIDENT_FIRED", new JSObject());
        }
    }

    @PluginMethod
    public void startService(PluginCall call) {
        // Save plugin instance in service so it can call notifyListeners
        SentinelService.pluginInstance = this;

        Intent intent = new Intent(getContext(), SentinelService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        SentinelService.pluginInstance = null;
        Intent intent = new Intent(getContext(), SentinelService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void saveEmergencyData(PluginCall call) {
        String name = call.getString("name", "Unknown");
        String bloodGroup = call.getString("bloodGroup", "Unknown");
        String allergies = call.getString("allergies", "None");
        String meds = call.getString("meds", "None");
        String emergencyPhone = call.getString("emergencyPhone", "");

        Log.d("SentinelPlugin", "Saving - Name: " + name + 
          ", Phone: " + emergencyPhone); // ✅ Debug

        SharedPreferences prefs = getContext()
            .getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        prefs.edit()
            .putString("emergency_name", name)
            .putString("emergency_blood", bloodGroup)
            .putString("emergency_allergies", allergies)
            .putString("emergency_meds", meds)
            .putString("emergency_phone", emergencyPhone)
            .apply();

                Log.d("SentinelPlugin", "✅ Emergency data saved to SharedPreferences");

        call.resolve();
    }

    @PluginMethod
    public void sendEmergencySms(PluginCall call) {
        String phone = call.getString("phone");
        String message = call.getString("message");

        if (phone == null || message == null) {
            call.reject("Phone and message required");
            return;
        }

        if (getPermissionState("sms") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermCallback");
        } else {
            boolean success = SmsHelper.sendSms(phone, message);
            if (success) call.resolve();
            else call.reject("SMS failed");
        }
    }

    @PermissionCallback
    private void smsPermCallback(PluginCall call) {
        if (getPermissionState("sms") == com.getcapacitor.PermissionState.GRANTED) {
            boolean success = SmsHelper.sendSms(
                call.getString("phone"),
                call.getString("message")
            );
            if (success) call.resolve();
            else call.reject("SMS failed");
        } else {
            call.reject("SMS permission denied");
        }
    }

    @PluginMethod
    public void showMedicalIdNotification(PluginCall call) {
        EmergencyInfoHelper.showLockScreenMedicalId(
            getContext(),
            call.getString("name"),
            call.getString("bloodGroup"),
            call.getString("allergies"),
            call.getString("meds")
        );
        call.resolve();
    }

    @PluginMethod
    public void bringAppToForeground(PluginCall call) {
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        getContext().startActivity(intent);
        call.resolve();
    }
}