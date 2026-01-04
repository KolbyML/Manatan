//
//  AppDelegate.m
//  Mangatan
//
//  Created by Kolby Moroz Liebl on 2025-12-20.
//

#import "AppDelegate.h"
#import "ViewController.h" // Import to access forceReload

@interface AppDelegate ()
@property (nonatomic, assign) UIBackgroundTaskIdentifier backgroundTask;
@property (nonatomic, strong) NSDate *backgroundEnterTime; // Stores when we minimized
@end

@implementation AppDelegate


- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    // Override point for customization after application launch.
    return YES;
}

// 1. SAFE SUSPEND: Prevent the "3-minute watchdog kill"
- (void)applicationDidEnterBackground:(UIApplication *)application {
    NSLog(@"[AppDelegate] App entering background.");
    
    // Record the exact time we went to sleep
    self.backgroundEnterTime = [NSDate date];

    // Request background execution time.
    // This tells iOS: "Don't kill me immediately, let me finish up."
    // iOS gives us ~30s to 3 minutes.
    self.backgroundTask = [application beginBackgroundTaskWithExpirationHandler:^{
        // This block runs if we run out of time.
        // We MUST call endBackgroundTask here, or iOS will crash us.
        NSLog(@"[AppDelegate] Background time expired. Suspending app now.");
        [application endBackgroundTask:self.backgroundTask];
        self.backgroundTask = UIBackgroundTaskInvalid;
    }];
}

// 2. SAFE RESUME: Prevent the "Stale Connection crash"
- (void)applicationWillEnterForeground:(UIApplication *)application {
    NSLog(@"[AppDelegate] App entering foreground.");
    
    // End the background task if it's still running
    if (self.backgroundTask != UIBackgroundTaskInvalid) {
        [application endBackgroundTask:self.backgroundTask];
        self.backgroundTask = UIBackgroundTaskInvalid;
    }
    
    // Check how long we were asleep
    if (self.backgroundEnterTime) {
        NSTimeInterval timeSpentInBackground = [[NSDate date] timeIntervalSinceDate:self.backgroundEnterTime];
        NSLog(@"[AppDelegate] Was suspended for: %.2f seconds", timeSpentInBackground);
        
        // CRITICAL CHECK:
        // If we were minimized for > 15 minutes (900 seconds), assume the connection is dead.
        // We force a "Soft Restart" of the UI to establish a fresh connection.
        if (timeSpentInBackground > 900) {
            NSLog(@"[AppDelegate] Session is stale (>15m). Triggering Soft Restart...");
            
            // Find the active ViewController and tell it to reload
            for (UIScene *scene in application.connectedScenes) {
                if ([scene.delegate conformsToProtocol:@protocol(UIWindowSceneDelegate)]) {
                    UIWindow *window = [(id<UIWindowSceneDelegate>)scene.delegate window];
                    if ([window.rootViewController isKindOfClass:[ViewController class]]) {
                        [(ViewController *)window.rootViewController forceReload];
                    }
                }
            }
        }
        
        // Reset the timer
        self.backgroundEnterTime = nil;
    }
}


#pragma mark - UISceneSession lifecycle


- (UISceneConfiguration *)application:(UIApplication *)application configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession options:(UISceneConnectionOptions *)options {
    // Called when a new scene session is being created.
    // Use this method to select a configuration to create the new scene with.
    return [[UISceneConfiguration alloc] initWithName:@"Default Configuration" sessionRole:connectingSceneSession.role];
}


- (void)application:(UIApplication *)application didDiscardSceneSessions:(NSSet<UISceneSession *> *)sceneSessions {
    // Called when the user discards a scene session.
    // If any sessions were discarded while the application was not running, this will be called shortly after application:didFinishLaunchingWithOptions.
    // Use this method to release any resources that were specific to the discarded scenes, as they will not return.
}


@end