#import "ReaderViewController.h"
#import <WebKit/WebKit.h>

@interface ReaderViewController () <WKNavigationDelegate>
@property (nonatomic, strong) WKWebView *webView;
@property (nonatomic, strong) UIButton *closeButton;
@end

@implementation ReaderViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = [UIColor blackColor];

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    config.websiteDataStore = [WKWebsiteDataStore defaultDataStore];
    config.allowsInlineMediaPlayback = YES;
    config.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;
    config.allowsPictureInPictureMediaPlayback = NO;
    
    self.webView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];
    self.webView.translatesAutoresizingMaskIntoConstraints = NO;
    self.webView.navigationDelegate = self;
    self.webView.backgroundColor = [UIColor blackColor];
    self.webView.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentAutomatic;
    
    [self.webView evaluateJavaScript:@"navigator.userAgent" completionHandler:^(id result, NSError *error) {
        NSString *userAgent = result;
        self.webView.customUserAgent = [userAgent stringByAppendingString:@" MangatanNative ManatanNative"];
    }];

    [self.view addSubview:self.webView];

    [NSLayoutConstraint activateConstraints:@[
        [self.webView.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor],
        [self.webView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [self.webView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [self.webView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor]
    ]];

    self.closeButton = [UIButton buttonWithType:UIButtonTypeSystem];
    [self.closeButton setTitle:@"CLOSE" forState:UIControlStateNormal];
    [self.closeButton setBackgroundColor:[UIColor colorWithRed:0.8 green:0.0 blue:0.0 alpha:0.8]];
    [self.closeButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    self.closeButton.layer.cornerRadius = 8;
    self.closeButton.clipsToBounds = YES;
    [self.closeButton addTarget:self action:@selector(closeTapped) forControlEvents:UIControlEventTouchUpInside];
    
    self.closeButton.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:self.closeButton];
    
    [NSLayoutConstraint activateConstraints:@[
        [self.closeButton.trailingAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.trailingAnchor constant:-20],
        [self.closeButton.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-20],
        [self.closeButton.widthAnchor constraintEqualToConstant:80],
        [self.closeButton.heightAnchor constraintEqualToConstant:40]
    ]];

    if (self.targetURL) {
        NSURL *url = [NSURL URLWithString:self.targetURL];
        [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
    }
}

- (void)closeTapped {
    [self dismissViewControllerAnimated:YES completion:nil];
}

#pragma mark - Toast Logic (Window Level)

- (void)showToastMessage:(NSString *)message {
    dispatch_async(dispatch_get_main_queue(), ^{
        // 1. Find the Key Window (so the toast survives the view dismissal)
        UIWindow *window = nil;
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
            if (scene.activationState == UISceneActivationStateForegroundActive && [scene isKindOfClass:[UIWindowScene class]]) {
                for (UIWindow *w in ((UIWindowScene *)scene).windows) {
                    if (w.isKeyWindow) {
                        window = w;
                        break;
                    }
                }
            }
            if (window) break;
        }
        
        // Fallback for older iOS versions or edge cases
        if (!window) window = [UIApplication sharedApplication].windows.firstObject;
        if (!window) return;

        UILabel *toastLabel = [[UILabel alloc] init];
        toastLabel.text = message;
        toastLabel.textColor = [UIColor whiteColor];
        toastLabel.backgroundColor = [[UIColor blackColor] colorWithAlphaComponent:0.9];
        toastLabel.textAlignment = NSTextAlignmentCenter;
        toastLabel.font = [UIFont boldSystemFontOfSize:14.0];
        toastLabel.layer.cornerRadius = 10;
        toastLabel.clipsToBounds = YES;
        toastLabel.alpha = 0.0;
        toastLabel.numberOfLines = 0;
        
        toastLabel.translatesAutoresizingMaskIntoConstraints = NO;
        [window addSubview:toastLabel]; // Add to WINDOW, not self.view
        
        [NSLayoutConstraint activateConstraints:@[
            [toastLabel.centerXAnchor constraintEqualToAnchor:window.centerXAnchor],
            [toastLabel.bottomAnchor constraintEqualToAnchor:window.safeAreaLayoutGuide.bottomAnchor constant:-80], // Higher up
            [toastLabel.leadingAnchor constraintGreaterThanOrEqualToAnchor:window.leadingAnchor constant:40],
            [toastLabel.trailingAnchor constraintLessThanOrEqualToAnchor:window.trailingAnchor constant:-40],
            [toastLabel.heightAnchor constraintGreaterThanOrEqualToConstant:40]
        ]];
        
        // Animation
        [UIView animateWithDuration:0.3 animations:^{
            toastLabel.alpha = 1.0;
        } completion:^(BOOL finished) {
            [UIView animateWithDuration:0.5 delay:2.0 options:UIViewAnimationOptionCurveEaseOut animations:^{
                toastLabel.alpha = 0.0;
            } completion:^(BOOL finished) {
                [toastLabel removeFromSuperview];
            }];
        }];
    });
}

#pragma mark - Cookie Sync

- (void)viewWillDisappear:(BOOL)animated {
    [super viewWillDisappear:animated];
    [self syncCookiesToSuwayomi];
}

- (void)syncCookiesToSuwayomi {
    if (!self.webView.URL) return;
    
    NSString *host = self.webView.URL.host;
    if (!host || [host containsString:@"127.0.0.1"] || [host containsString:@"localhost"]) return;

    WKHTTPCookieStore *cookieStore = self.webView.configuration.websiteDataStore.httpCookieStore;
    
    // Use Weak Self to avoid retain cycles during the async block
    __weak typeof(self) weakSelf = self;
    
    [cookieStore getAllCookies:^(NSArray<NSHTTPCookie *> * _Nonnull cookies) {
        if (cookies.count == 0) return;

        NSMutableArray *cookieArray = [NSMutableArray array];
        for (NSHTTPCookie *cookie in cookies) {
            if ([host containsString:cookie.domain] || [cookie.domain containsString:host]) {
                [cookieArray addObject:@{
                    @"name": cookie.name,
                    @"value": cookie.value,
                    @"domain": cookie.domain,
                    @"path": cookie.path ?: @"/",
                    @"secure": @(cookie.isSecure),
                    @"httpOnly": @(cookie.isHTTPOnly),
                    @"expiresAt": cookie.expiresDate ? @([cookie.expiresDate timeIntervalSince1970] * 1000) : @(NSDate.distantFuture.timeIntervalSince1970 * 1000)
                }];
            }
        }

        if (cookieArray.count == 0) return;

        NSDictionary *payload = @{
            @"userAgent": weakSelf.webView.customUserAgent ?: @"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
            @"cookies": cookieArray
        };

        NSError *error;
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:payload options:0 error:&error];
        if (!jsonData) return;

        NSURL *url = [NSURL URLWithString:@"http://127.0.0.1:4568/api/v1/cookie"];
        NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
        [request setHTTPMethod:@"POST"];
        [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
        [request setHTTPBody:jsonData];

        [[NSURLSession.sharedSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
            
            NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
            
            // Dispatch back to main thread for UI updates
            dispatch_async(dispatch_get_main_queue(), ^{
                if (error) {
                    NSLog(@"[Reader] Sync Failed: %@", error.localizedDescription);
                    [weakSelf showToastMessage:@"Cookie Sync Failed"];
                } else if (httpResponse.statusCode >= 200 && httpResponse.statusCode < 300) {
                    NSLog(@"[Reader] Cookies synced for %@", host);
                    [weakSelf showToastMessage:@"Cookies Synced"];
                } else {
                    NSLog(@"[Reader] Sync Error Code: %ld", (long)httpResponse.statusCode);
                    [weakSelf showToastMessage:[NSString stringWithFormat:@"Sync Failed: %ld", (long)httpResponse.statusCode]];
                }
            });
        }] resume];
    }];
}

@end
