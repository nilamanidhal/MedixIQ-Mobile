package com.medmind.app;

import android.telephony.SmsManager;
import android.util.Log;

public class SmsHelper {
    public static boolean sendSms(String phoneNumber, String message) {
        try {
            SmsManager smsManager = SmsManager.getDefault();
            // Using multipart handles long messages automatically
            java.util.ArrayList<String> parts = smsManager.divideMessage(message);
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
            return true;
        } catch (Exception e) {
            Log.e("SmsHelper", "Failed to send SMS", e);
            return false;
        }
    }
}