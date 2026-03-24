package com.medmind.app;

import android.telephony.SmsManager;
import android.util.Log;
import java.util.ArrayList;

public class SmsHelper {
    public static boolean sendSms(String phone, String message) {
        try {
            // ✅ Auto-add +91 for Indian numbers
            String formattedPhone = formatIndianNumber(phone);
            Log.d("SmsHelper", "Sending SMS to: " + formattedPhone);

            SmsManager smsManager = SmsManager.getDefault();
            ArrayList<String> parts = smsManager.divideMessage(message);
            smsManager.sendMultipartTextMessage(
                formattedPhone, null, parts, null, null
            );
            Log.d("SmsHelper", "✅ SMS sent to " + formattedPhone);
            return true;
        } catch (Exception e) {
            Log.e("SmsHelper", "Failed to send SMS", e);
            return false;
        }
    }

    // ✅ Format number — handles 10 digit, +91, 91 formats
    private static String formatIndianNumber(String phone) {
        if (phone == null || phone.trim().isEmpty()) return phone;
        
        String cleaned = phone.trim().replaceAll("[\\s\\-()]", "");
        
        if (cleaned.startsWith("+")) {
            return cleaned; // Already has country code
        } else if (cleaned.startsWith("91") && cleaned.length() == 12) {
            return "+" + cleaned; // Add +
        } else if (cleaned.length() == 10) {
            return "+91" + cleaned; // Add +91
        }
        return cleaned;
    }
}