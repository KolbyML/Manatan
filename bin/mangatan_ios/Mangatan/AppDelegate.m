//
//  AppDelegate.m
//  Mangatan
//
//  Created by Kolby Moroz Liebl on 2025-12-20.
//

#import "AppDelegate.h"

@interface AppDelegate ()
@property (nonatomic, assign) UIBackgroundTaskIdentifier backgroundTask;
@end

@implementation AppDelegate


- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    // Override point for customization after application launch.
    return YES;
}

// 1. When the app is minimized (Background), tell iOS we need more time
- (void)applicationDidEnterBackground:(UIApplication *)application {
    NSLog(@"[AppDelegate] App entering background. Requesting background time...");

    self.backgroundTask = [application beginBackgroundTaskWithExpirationHandler:^{
        // This block runs if we run out of time (usually ~3 minutes)
        NSLog(@"[AppDelegate] Background time expired. Ending task.");
        [application endBackgroundTask:self.backgroundTask];
        self.backgroundTask = UIBackgroundTaskInvalid;
    }];
}

// 2. When the app is opened again (Foreground), stop the background timer
- (void)applicationWillEnterForeground:(UIApplication *)application {
    NSLog(@"[AppDelegate] App entering foreground.");
    
    if (self.backgroundTask != UIBackgroundTaskInvalid) {
        [application endBackgroundTask:self.backgroundTask];
        self.backgroundTask = UIBackgroundTaskInvalid;
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
