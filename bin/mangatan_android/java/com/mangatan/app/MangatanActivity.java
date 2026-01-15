package com.mangatan.app;

import android.app.NativeActivity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

public class MangatanActivity extends NativeActivity {

    static {
        System.loadLibrary("mangatan_android");
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleLaunchIntent(getIntent());
        AnkiBridge.startAnkiConnectServer(getApplicationContext());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleLaunchIntent(intent);
    }

    private void handleLaunchIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        
        Uri data = intent.getData();
        if ("mangatan".equals(data.getScheme()) && "launch".equals(data.getHost())) {
            String targetUrl = data.getQueryParameter("url");
            
            if (targetUrl != null && !targetUrl.isEmpty()) {
                Log.i("Mangatan", "🚀 Shim Launch: " + targetUrl);
                Toast.makeText(this, "Opening Reader...", Toast.LENGTH_SHORT).show();
                
                Intent webIntent = new Intent(this, WebviewActivity.class);
                webIntent.putExtra("TARGET_URL", targetUrl);
                
                // --- CRITICAL FLAG ---
                // Tells WebviewActivity this came from the Shim, so it should minimize on close
                webIntent.putExtra("FROM_SHIM", true); 
                
                webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(webIntent);
            }
        }
    }

    @Override
    public void onDestroy() {
        AnkiBridge.stopAnkiConnectServer();
        Intent serviceIntent = new Intent(this, MangatanService.class);
        stopService(serviceIntent);
        android.os.Process.killProcess(android.os.Process.myPid());
        System.exit(0);
    }
}
