package com.mangatan.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class WebviewActivity extends Activity {
    private WebView myWebView;
    private String targetUrl = "http://127.0.0.1:4568";
    
    // Flags
    private boolean isShimLaunch = false; 
    private String lastSyncedCookie = ""; 
    private ValueCallback<Uri[]> uploadMessage;
    public final static int FILECHOOSER_RESULTCODE = 100;
    private static final int ANKI_PERMISSION_REQUEST = 999;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (checkSelfPermission("com.ichi2.anki.permission.READ_WRITE_DATABASE") 
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"com.ichi2.anki.permission.READ_WRITE_DATABASE"}, ANKI_PERMISSION_REQUEST);
        }

        Intent intent = getIntent();
        if (intent.hasExtra("TARGET_URL")) {
            targetUrl = intent.getStringExtra("TARGET_URL");
        }
        
        isShimLaunch = intent.getBooleanExtra("FROM_SHIM", false);
        String initialCookiesJson = intent.getStringExtra("INITIAL_COOKIES");

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        FrameLayout layout = new FrameLayout(this);
        layout.setLayoutParams(new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        myWebView = new WebView(this);
        layout.addView(myWebView, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // Close Button
        if (!targetUrl.contains(":4568")) {
            Button exitBtn = new Button(this);
            exitBtn.setText("CLOSE");
            exitBtn.setBackgroundColor(Color.RED);
            exitBtn.setTextColor(Color.WHITE);
            exitBtn.setAlpha(0.7f);
            FrameLayout.LayoutParams btnParams = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
            btnParams.gravity = Gravity.BOTTOM | Gravity.END;
            btnParams.setMargins(0, 0, 50, 50);
            exitBtn.setOnClickListener(v -> handleSmartClose());
            layout.addView(exitBtn, btnParams);
        }

        setContentView(layout);

        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(myWebView, true);

        if (initialCookiesJson != null && !initialCookiesJson.isEmpty()) {
            injectCookies(cookieManager, initialCookiesJson);
        }

        String userAgent = webSettings.getUserAgentString();
        webSettings.setUserAgentString(userAgent + " MangatanNative");

        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String urlString = uri.toString();

                // 1. Handle intent:// links (Shim -> App transition)
                if (urlString.startsWith("intent://")) {
                    try {
                        Intent intent = Intent.parseUri(urlString, Intent.URI_INTENT_SCHEME);
                        Uri deepLink = intent.getData();
                        if (deepLink != null && "mangatan".equals(deepLink.getScheme())) {
                            String actualUrl = deepLink.getQueryParameter("url");
                            if (actualUrl != null) {
                                launchReader(actualUrl);
                                return true;
                            }
                        }
                    } catch (Exception e) {
                        Log.e("Mangatan", "Intent parse failed", e);
                    }
                    return true;
                }
                
                // 2. BLOCK SHIM in Native App
                if (urlString.contains("/api/v1/webview")) {
                    String fragment = uri.getFragment(); 
                    if (fragment != null && !fragment.isEmpty()) {
                        Log.i("Mangatan", "Native Intercept: Skipping Shim for " + fragment);
                        launchReader(fragment);
                        return true; 
                    }
                }

                return false; 
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // MODIFIED: No sync here. 
                // This prevents the toast from appearing when the webview first opens.
            }
        });

        myWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (ActivityNotFoundException e) {
                    uploadMessage = null;
                    return false;
                }
                return true;
            }
        });

        myWebView.loadUrl(targetUrl);
    }

    private void launchReader(String url) {
        Intent webIntent = new Intent(WebviewActivity.this, WebviewActivity.class);
        webIntent.putExtra("TARGET_URL", url);
        webIntent.putExtra("FROM_SHIM", false); // Native launch
        startActivity(webIntent);
    }

    private void handleSmartClose() {
        if (isShimLaunch) {
            Log.i("Mangatan", "Closing Shim View -> Minimizing App");
            moveTaskToBack(true);
            finish(); 
        } else {
            Log.i("Mangatan", "Closing Native View -> Returning to Library");
            finish();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (myWebView.canGoBack()) {
                myWebView.goBack();
                return true;
            } else {
                handleSmartClose();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    // --- Cookie Logic ---
    private void syncCookiesToSuwayomi(boolean forceToast) {
        if (myWebView == null) return;
        String currentUrl = myWebView.getUrl();
        if (currentUrl == null || currentUrl.isEmpty()) return;
        if (currentUrl.contains("127.0.0.1") || currentUrl.contains("localhost")) return;

        String cookieStr = CookieManager.getInstance().getCookie(currentUrl);
        String userAgent = myWebView.getSettings().getUserAgentString();
        if (cookieStr == null || cookieStr.isEmpty()) return;
        if (!forceToast && cookieStr.equals(lastSyncedCookie)) return;
        lastSyncedCookie = cookieStr;

        new Thread(() -> {
            try {
                URL urlObj = new URL(currentUrl);
                String domain = urlObj.getHost();
                JSONObject payload = new JSONObject();
                payload.put("userAgent", userAgent);
                JSONArray cookies = new JSONArray();
                String[] pairs = cookieStr.split(";");
                for (String pair : pairs) {
                    String[] parts = pair.trim().split("=", 2);
                    if (parts.length == 2) {
                        JSONObject c = new JSONObject();
                        c.put("name", parts[0]);
                        c.put("value", parts[1]);
                        c.put("domain", domain);
                        c.put("path", "/");
                        c.put("secure", true);
                        c.put("httpOnly", false);
                        c.put("expiresAt", System.currentTimeMillis() + 31536000000L);
                        cookies.put(c);
                    }
                }
                payload.put("cookies", cookies);
                URL api = new URL("http://127.0.0.1:4568/api/v1/cookie");
                HttpURLConnection conn = (HttpURLConnection) api.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(5000);
                conn.setDoOutput(true);
                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = payload.toString().getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }
                int code = conn.getResponseCode();
                runOnUiThread(() -> {
                    if (code >= 200 && code < 300) {
                        Toast.makeText(WebviewActivity.this, "Cookies Synced", Toast.LENGTH_SHORT).show();
                    } else if (forceToast) {
                        Toast.makeText(WebviewActivity.this, "Cookie Sync Failed: " + code, Toast.LENGTH_SHORT).show();
                    }
                });
                conn.disconnect();
            } catch (Exception e) {
                Log.e("MangatanCookie", "Sync Exception", e);
            }
        }).start();
    }

    private void injectCookies(CookieManager cm, String json) {
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject c = arr.getJSONObject(i);
                String domain = c.optString("domain", "");
                String name = c.getString("name");
                String value = c.getString("value");
                String cookieStr = name + "=" + value + "; domain=" + domain + "; path=/";
                cm.setCookie(domain, cookieStr);
            }
            cm.flush();
        } catch (Exception e) {
            Log.e("MangatanCookie", "Injection failed", e);
        }
    }

    @Override
    protected void onPause() {
        syncCookiesToSuwayomi(false); // Silent sync on pause/minimize
        super.onPause();
    }
    
    @Override
    protected void onDestroy() {
        syncCookiesToSuwayomi(true); // Toast sync on close/destroy
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (uploadMessage == null) return;
            uploadMessage.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            uploadMessage = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == ANKI_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (!granted) {
                Toast.makeText(this, "Anki permission denied.", Toast.LENGTH_LONG).show();
            }
        }
    }
}