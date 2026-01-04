#import "ViewController.h"
#import "Mangatan-Bridging-Header.h"
#import <WebKit/WebKit.h>

@interface ViewController ()
@property (nonatomic, strong) WKWebView *webView;
@property (nonatomic, strong) UIView *loadingView;
@property (nonatomic, strong) NSTimer *statusTimer;
@property (nonatomic, assign) BOOL wasReady;
@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    self.wasReady = NO;

    // --- CHECK FOR APP UPDATE & CLEAR CACHE ---
    [self clearCacheOnAppUpdate];
    // ------------------------------------------

    // 1. Setup WebView (Hidden initially)
    self.webView = [[WKWebView alloc] initWithFrame:self.view.bounds];
    self.webView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.webView.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    self.webView.alpha = 0.0;
    [self.view addSubview:self.webView];

    // 2. Setup Loading View
    self.loadingView = [[UIView alloc] initWithFrame:self.view.bounds];
    self.loadingView.backgroundColor = [UIColor systemBackgroundColor];
    self.loadingView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    
    UIActivityIndicatorView *spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleLarge];
    spinner.center = self.loadingView.center;
    [spinner startAnimating];
    
    UILabel *label = [[UILabel alloc] initWithFrame:CGRectMake(0, spinner.frame.origin.y + 50, self.view.bounds.size.width, 30)];
    label.text = @"Mangatan is starting...";
    label.textAlignment = NSTextAlignmentCenter;
    
    [self.loadingView addSubview:spinner];
    [self.loadingView addSubview:label];
    [self.view addSubview:self.loadingView];

    // 3. Start Polling Timer (Checks Rust every 1 second)
    self.statusTimer = [NSTimer scheduledTimerWithTimeInterval:1.0
                                                        target:self
                                                      selector:@selector(checkServerStatus)
                                                      userInfo:nil
                                                       repeats:YES];
}

- (void)clearCacheOnAppUpdate {
    NSString *currentVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    NSString *storedVersion = [[NSUserDefaults standardUserDefaults] stringForKey:@"last_run_version"];

    if (![currentVersion isEqualToString:storedVersion]) {
        NSLog(@"[System] App updated from %@ to %@. Clearing WebView Cache...", storedVersion, currentVersion);
        
        // Clear WKWebView Cache
        NSSet *websiteDataTypes = [WKWebsiteDataStore allWebsiteDataTypes];
        NSDate *dateFrom = [NSDate dateWithTimeIntervalSince1970:0];
        [[WKWebsiteDataStore defaultDataStore] removeDataOfTypes:websiteDataTypes
                                                   modifiedSince:dateFrom
                                               completionHandler:^{
            NSLog(@"[System] Cache cleared successfully.");
        }];

        // Update the stored version so this doesn't run next time
        [[NSUserDefaults standardUserDefaults] setObject:currentVersion forKey:@"last_run_version"];
        [[NSUserDefaults standardUserDefaults] synchronize];
    } else {
        NSLog(@"[System] Normal launch (Version %@). Keeping cache.", currentVersion);
    }
}

- (void)checkServerStatus {
    BOOL isReady = is_server_ready();
    
    if (isReady && !self.wasReady) {
        NSLog(@"[UI] Server Ready! Loading interface...");
        [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"http://127.0.0.1:4568"]]];
        
        [UIView animateWithDuration:0.5 animations:^{
            self.webView.alpha = 1.0;
            self.loadingView.alpha = 0.0;
        }];
        self.wasReady = YES;
        
    } else if (!isReady && self.wasReady) {
        NSLog(@"[UI] Server lost! Showing loading screen...");
        [UIView animateWithDuration:0.5 animations:^{
            self.webView.alpha = 0.0;
            self.loadingView.alpha = 1.0;
        }];
        self.wasReady = NO;
    }
}

// --- NEW: Force the UI to reset from scratch ---
- (void)forceReload {
    NSLog(@"[UI] Force reload triggered. Resetting webview state.");
    
    // 1. Immediately hide the broken/stale webview
    [UIView animateWithDuration:0.2 animations:^{
        self.loadingView.alpha = 1.0;
        self.webView.alpha = 0.0;
    }];
    
    // 2. Mark app as "Not Ready" so the timer knows to re-check and re-load
    self.wasReady = NO;
    
    // 3. Navigate to blank to kill any stale sockets or JS loops
    [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"about:blank"]]];
    
    // On the next timer tick (1s later), checkServerStatus will run:
    // - If server is alive: It loads http://127.0.0.1:4568 immediately.
    // - If server is dead: It keeps the loading screen up while the server restarts.
}

@end