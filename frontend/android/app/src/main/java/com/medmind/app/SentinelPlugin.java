package com.medmind.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "Sentinel",
    permissions = {
        @Permission(strings = {Manifest.permission.SEND_SMS}, alias = "sms")
    }
)
public class SentinelPlugin extends Plugin {

    @PluginMethod
    public void startService(PluginCall call) {
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
        Intent intent = new Intent(getContext(), SentinelService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void sendEmergencySms(PluginCall call) {
        String phone = call.getString("phone");
        String message = call.getString("message");

        if (phone == null || message == null) {
            call.reject("Phone number and message are required");
            return;
        }

        // Check if we have SMS permission, if not, request it
        if (getPermissionState("sms") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermCallback");
        } else {
            executeSms(call, phone, message);
        }
    }

    @PermissionCallback
    private void smsPermCallback(PluginCall call) {
        if (getPermissionState("sms") == com.getcapacitor.PermissionState.GRANTED) {
            String phone = call.getString("phone");
            String message = call.getString("message");
            executeSms(call, phone, message);
        } else {
            call.reject("SMS Permission denied");
        }
    }

    private void executeSms(PluginCall call, String phone, String message) {
        boolean success = SmsHelper.sendSms(phone, message);
        if (success) {
            call.resolve();
        } else {
            call.reject("Failed to send SMS through native API");
        }
    }

    @PluginMethod
    public void showMedicalIdNotification(PluginCall call) {
        String token = call.getString("token");
        String name = call.getString("name");
        String bloodGroup = call.getString("bloodGroup");

        if (token != null) {
            EmergencyInfoHelper.showLockScreenMedicalId(getContext(), token, name, bloodGroup);
            call.resolve();
        } else {
            call.reject("Token is required");
        }
    }
}