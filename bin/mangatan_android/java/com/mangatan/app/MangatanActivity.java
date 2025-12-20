package com.mangatan.app;

import android.app.NativeActivity;
import android.content.Intent;
import android.util.Log;

public class MangatanActivity extends NativeActivity {
    @Override
    public void onDestroy() {
        Log.d("Mangatan", "MangatanActivity onDestroy - Force killing process to prevent ANR");
        
        // 1. Stop the service explicitly
        Intent serviceIntent = new Intent(this, MangatanService.class);
        stopService(serviceIntent);
        
        // 2. Kill the process immediately. 
        // We do not call super.onDestroy() because it waits for the native thread, which causes the hang.
        android.os.Process.killProcess(android.os.Process.myPid());
        System.exit(0);
    }
}