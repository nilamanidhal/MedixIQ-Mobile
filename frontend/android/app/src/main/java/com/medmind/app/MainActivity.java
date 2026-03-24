package com.medmind.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Build;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.plugin.WebView;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SentinelPlugin.class);
        super.onCreate(savedInstanceState);

        // Show over lock screen
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

        // ✅ Check if launched by Sentinel accident detection
        handleAccidentIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Handle case when app already open
        handleAccidentIntent(intent);
    }



   private void handleAccidentIntent(Intent intent) {
    if (intent != null && intent.getBooleanExtra("ACCIDENT_DETECTED", false)) {
        // ✅ Flag store karo — bridge ready hone pe React padh lega
        getSharedPreferences("CapacitorStorage", MODE_PRIVATE)
            .edit()
            .putString("pending_accident", "true")
            .apply();

        // Bridge already ready hai toh direct fire karo
        if (getBridge() != null) {
            getBridge().getWebView().post(() ->
                getBridge().eval(
                    "window.__SENTINEL_ACCIDENT__ = true; " +
                    "window.dispatchEvent(new CustomEvent('SENTINEL_ACCIDENT'));",
                    result -> {}
                )
            );
        }
    }
}
}









// package com.medmind.app;

// import android.os.Bundle;
// import com.getcapacitor.BridgeActivity;

// public class MainActivity extends BridgeActivity {
//     @Override
//     public void onCreate(Bundle savedInstanceState) {
//         // ✅ PEHLE registerPlugin — super se PEHLE
//         registerPlugin(SentinelPlugin.class);
        
//         // BAAD MEIN super
//         super.onCreate(savedInstanceState);
//     }
// }