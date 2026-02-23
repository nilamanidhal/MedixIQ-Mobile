package com.medmind.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ✅ PEHLE registerPlugin — super se PEHLE
        registerPlugin(SentinelPlugin.class);
        
        // BAAD MEIN super
        super.onCreate(savedInstanceState);
    }
}