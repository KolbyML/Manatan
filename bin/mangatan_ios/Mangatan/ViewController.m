#import "ViewController.h"
#import "ReaderViewController.h"
#import "Mangatan-Bridging-Header.h"
#import <WebKit/WebKit.h>

@interface ViewController () <WKNavigationDelegate>
@property (nonatomic, strong) WKWebView *webView;
@property (nonatomic, strong) UIView *loadingView;
@property (nonatomic, strong) NSTimer *statusTimer;
@property (nonatomic, assign) BOOL wasReady;
@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    self.wasReady = NO;

    // 1. Setup Loading View (Do this immediately so the screen isn't black)
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

    // 2. Defer Heavy Initialization to the next runloop cycle (Fixes Crash)
    dispatch_async(dispatch_get_main_queue(), ^{
        [self setupWebViewAndLogic];
    });
}

- (void)setupWebViewAndLogic {
    // --- CHECK FOR APP UPDATE & CLEAR CACHE ---
    [self clearCacheOnAppUpdate];
    // ------------------------------------------

    // Setup WebView
    self.webView = [[WKWebView alloc] initWithFrame:self.view.bounds];
    self.webView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.webView.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    self.webView.navigationDelegate = self;
    self.webView.alpha = 0.0;
    [self.view insertSubview:self.webView belowSubview:self.loadingView];

    // Seed Cookies
    [self seedCookiesFromDisk];

    // Start Timer
    self.statusTimer = [NSTimer scheduledTimerWithTimeInterval:1.0
                                                        target:self
                                                      selector:@selector(checkServerStatus)
                                                      userInfo:nil
                                                       repeats:YES];
}

#pragma mark - Navigation Interception

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    
    NSURL *url = navigationAction.request.URL;
    
    // Intercept /api/v1/webview#TARGET_URL
    if ([url.path isEqualToString:@"/api/v1/webview"]) {
        decisionHandler(WKNavigationActionPolicyCancel);
        
        NSString *targetUrlString = url.fragment;
        if (targetUrlString.length > 0) {
            NSLog(@"[UI] Opening Reader for: %@", targetUrlString);
            ReaderViewController *readerVC = [[ReaderViewController alloc] init];
            readerVC.targetURL = targetUrlString;
            readerVC.modalPresentationStyle = UIModalPresentationOverFullScreen;
            [self presentViewController:readerVC animated:YES completion:nil];
        }
        return;
    }
    
    decisionHandler(WKNavigationActionPolicyAllow);
}

#pragma mark - System Logic

- (void)clearCacheOnAppUpdate {
    NSString *currentVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    NSString *storedVersion = [[NSUserDefaults standardUserDefaults] stringForKey:@"last_run_version"];

    // CASE 1: Fresh Install (storedVersion is nil)
    if (storedVersion == nil) {
        NSLog(@"[System] Fresh install detected (v%@). Skipping cache clear.", currentVersion);
        [[NSUserDefaults standardUserDefaults] setObject:currentVersion forKey:@"last_run_version"];
        [[NSUserDefaults standardUserDefaults] synchronize];
        return;
    }

    // CASE 2: Update Detected (storedVersion != currentVersion)
    if (![currentVersion isEqualToString:storedVersion]) {
        NSLog(@"[System] App updated from %@ to %@. Clearing WebView Cache...", storedVersion, currentVersion);
        
        NSSet *websiteDataTypes = [WKWebsiteDataStore allWebsiteDataTypes];
        NSDate *dateFrom = [NSDate dateWithTimeIntervalSince1970:0];
        [[WKWebsiteDataStore defaultDataStore] removeDataOfTypes:websiteDataTypes
                                                   modifiedSince:dateFrom
                                               completionHandler:^{
            NSLog(@"[System] Cache cleared.");
        }];

        [[NSUserDefaults standardUserDefaults] setObject:currentVersion forKey:@"last_run_version"];
        [[NSUserDefaults standardUserDefaults] synchronize];
    }
}

- (void)seedCookiesFromDisk {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    if (paths.count == 0) return;
    
    NSString *docDir = [paths firstObject];
    NSString *cookiePath = [docDir stringByAppendingPathComponent:@"suwayomi/settings/cookie_store.xml"];

    if (![[NSFileManager defaultManager] fileExistsAtPath:cookiePath]) return;

    NSError *error = nil;
    NSString *content = [NSString stringWithContentsOfFile:cookiePath encoding:NSUTF8StringEncoding error:&error];
    if (error || !content) return;

    WKHTTPCookieStore *cookieStore = self.webView.configuration.websiteDataStore.httpCookieStore;
    NSArray *lines = [content componentsSeparatedByString:@"\n"];
    
    for (NSString *rawLine in lines) {
        NSString *line = [rawLine stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
        if (![line hasPrefix:@"<entry key=\""]) continue;
        
        NSRange q1 = [line rangeOfString:@"\""];
        if (q1.location == NSNotFound) continue;
        NSUInteger keyStart = q1.location + 1;
        NSRange q2 = [line rangeOfString:@"\"" options:0 range:NSMakeRange(keyStart, line.length - keyStart)];
        if (q2.location == NSNotFound) continue;
        NSString *key = [line substringWithRange:NSMakeRange(keyStart, q2.location - keyStart)];
        if ([key hasSuffix:@".size"]) continue;
        
        NSRange vStart = [line rangeOfString:@"\">"];
        NSRange vEnd = [line rangeOfString:@"</entry>"];
        if (vStart.location == NSNotFound || vEnd.location == NSNotFound) continue;
        
        NSString *fullValue = [line substringWithRange:NSMakeRange(vStart.location + 2, vEnd.location - (vStart.location + 2))];
        NSArray *parts = [fullValue componentsSeparatedByString:@";"];
        if (parts.count == 0) continue;
        
        NSString *mainPair = parts[0];
        NSRange eq = [mainPair rangeOfString:@"="];
        if (eq.location == NSNotFound) continue;
        
        NSString *name = [mainPair substringToIndex:eq.location];
        NSString *value = [mainPair substringFromIndex:eq.location + 1];
        
        NSString *domain = key;
        NSRange lastDot = [key rangeOfString:@"." options:NSBackwardsSearch];
        if (lastDot.location != NSNotFound) domain = [key substringToIndex:lastDot.location];
        
        NSMutableDictionary *props = [NSMutableDictionary dictionary];
        props[NSHTTPCookieName] = name;
        props[NSHTTPCookieValue] = value;
        props[NSHTTPCookieDomain] = domain;
        props[NSHTTPCookiePath] = @"/";
        if ([fullValue containsString:@"secure"]) props[NSHTTPCookieSecure] = @"TRUE";
        
        NSHTTPCookie *cookie = [NSHTTPCookie cookieWithProperties:props];
        if (cookie) [cookieStore setCookie:cookie completionHandler:nil];
    }
}

- (void)checkServerStatus {
    BOOL isReady = is_server_ready();
    
    if (isReady && !self.wasReady) {
        [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"http://127.0.0.1:4568"]]];
        [UIView animateWithDuration:0.5 animations:^{
            self.webView.alpha = 1.0;
            self.loadingView.alpha = 0.0;
        }];
        self.wasReady = YES;
    } else if (!isReady && self.wasReady) {
        [UIView animateWithDuration:0.5 animations:^{
            self.webView.alpha = 0.0;
            self.loadingView.alpha = 1.0;
        }];
        self.wasReady = NO;
    }
}

- (void)forceReload {
    [UIView animateWithDuration:0.2 animations:^{
        self.loadingView.alpha = 1.0;
        self.webView.alpha = 0.0;
    }];
    self.wasReady = NO;
    [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"about:blank"]]];
}

@end
