package com.mangatan.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.IBinder;
import android.os.Process;

public class MangatanService extends Service {
    private static final String CHANNEL_ID = "MangatanBackgroundService";
    private static final String ACTION_EXIT = "com.mangatan.app.ACTION_EXIT";
    
    private BroadcastReceiver exitReceiver;

    @Override
    public void onCreate() {
        super.onCreate();
        exitReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (ACTION_EXIT.equals(intent.getAction())) {
                    stopAppAndServer();
                }
            }
        };
        registerReceiver(exitReceiver, new IntentFilter(ACTION_EXIT));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();

        Intent notificationIntent = new Intent(this, MangatanActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentPendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, pendingFlags);

        Intent exitIntent = new Intent(ACTION_EXIT);
        exitIntent.setPackage(getPackageName()); 
        PendingIntent exitPendingIntent = PendingIntent.getBroadcast(this, 1, exitIntent, pendingFlags);

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        Notification notification = builder
                .setContentTitle("Mangatan Server")
                .setContentText("Server is running. Tap for options.")
                .setStyle(new Notification.BigTextStyle().bigText("Server is running. Tap 'Exit' to close everything."))
                .setSmallIcon(android.R.drawable.ic_menu_upload) 
                .setContentIntent(contentPendingIntent)
                .addAction(android.R.drawable.ic_delete, "Exit", exitPendingIntent)
                .build();

        startForeground(1, notification);

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (exitReceiver != null) {
            unregisterReceiver(exitReceiver);
            exitReceiver = null;
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        stopAppAndServer();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void stopAppAndServer() {
        stopForeground(true);
        stopSelf();
        Process.killProcess(Process.myPid());
        System.exit(0);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Mangatan Background Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }
}
