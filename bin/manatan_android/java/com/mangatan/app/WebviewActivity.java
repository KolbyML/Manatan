package com.mangatan.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.PixelCopy;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.util.Base64;

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
        webSettings.setUserAgentString(userAgent + " MangatanNative ManatanNative");

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
                        if (deepLink != null
                                && ("mangatan".equals(deepLink.getScheme())
                                || "manatan".equals(deepLink.getScheme()))) {
                            String actualUrl = deepLink.getQueryParameter("url");
                            if (actualUrl != null) {
                                launchReader(actualUrl);
                                return true;
                            }
                        }
                    } catch (Exception e) {
                        Log.e("Manatan", "Intent parse failed", e);
                    }
                    return true;
                }
                
                // 2. BLOCK SHIM in Native App
                if (urlString.contains("/api/v1/webview")) {
                    String fragment = uri.getFragment(); 
                    if (fragment != null && !fragment.isEmpty()) {
                        Log.i("Manatan", "Native Intercept: Skipping Shim for " + fragment);
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

        myWebView.addJavascriptInterface(new NativeCaptureBridge(), "ManatanNative");

        myWebView.loadUrl(targetUrl);
    }

    private void sendCaptureCallback(String callbackId, String dataUrl) {
        if (myWebView == null) return;
        final String safeId = JSONObject.quote(callbackId);
        final String safeData = dataUrl == null ? "null" : JSONObject.quote(dataUrl);
        final String script =
            "window.__manatanNativeCaptureCallback && window.__manatanNativeCaptureCallback(" + safeId + "," + safeData + ");";
        runOnUiThread(() -> myWebView.evaluateJavascript(script, null));
    }

    private Bitmap cropBitmap(Bitmap source, float x, float y, float width, float height, float dpr) {
        if (source == null) return null;
        if (width <= 0 || height <= 0) return source;
        int left = Math.max(0, Math.round(x * dpr));
        int top = Math.max(0, Math.round(y * dpr));
        int cropWidth = Math.min(source.getWidth() - left, Math.round(width * dpr));
        int cropHeight = Math.min(source.getHeight() - top, Math.round(height * dpr));
        if (cropWidth <= 0 || cropHeight <= 0) return source;
        return Bitmap.createBitmap(source, left, top, cropWidth, cropHeight);
    }

    private String encodeBitmapToDataUrl(Bitmap bitmap, float quality) {
        if (bitmap == null) return null;
        try {
            int qualityInt = Math.max(1, Math.min(100, Math.round(quality * 100f)));
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, qualityInt, output);
            byte[] bytes = output.toByteArray();
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            return "data:image/jpeg;base64," + base64;
        } catch (Exception e) {
            Log.e("Manatan", "Failed to encode bitmap", e);
            return null;
        }
    }

    private class NativeCaptureBridge {
        @JavascriptInterface
        public void openExternalUrl(final String url) {
            if (url == null || url.isEmpty()) return;

            runOnUiThread(() -> {
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    browserIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                    startActivity(browserIntent);
                } catch (ActivityNotFoundException e) {
                    Log.e("Manatan", "No browser found for OAuth URL", e);
                    Toast.makeText(WebviewActivity.this, "No browser available for Google sign-in", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Log.e("Manatan", "Failed to open OAuth URL in external browser", e);
                }
            });
        }

        @JavascriptInterface
        public void captureFrame(final String callbackId, final String payloadJson) {
            if (myWebView == null) {
                sendCaptureCallback(callbackId, null);
                return;
            }

            float x = 0f;
            float y = 0f;
            float width = 0f;
            float height = 0f;
            float dpr = 1f;
            float quality = 0.92f;
            try {
                JSONObject payload = new JSONObject(payloadJson);
                x = (float) payload.optDouble("x", 0d);
                y = (float) payload.optDouble("y", 0d);
                width = (float) payload.optDouble("width", 0d);
                height = (float) payload.optDouble("height", 0d);
                dpr = (float) payload.optDouble("dpr", 1d);
                quality = (float) payload.optDouble("quality", 0.92d);
            } catch (Exception e) {
                Log.e("Manatan", "Failed to parse capture payload", e);
            }

            final float cropX = x;
            final float cropY = y;
            final float cropWidth = width;
            final float cropHeight = height;
            final float devicePixelRatio = dpr;
            final float qualityFinal = quality;

            runOnUiThread(() -> {
                try {
                    int widthPx = Math.max(1, myWebView.getWidth());
                    int heightPx = Math.max(1, myWebView.getHeight());
                    Bitmap bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888);
                    Handler handler = new Handler(Looper.getMainLooper());

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        PixelCopy.request(getWindow(), bitmap, result -> {
                            if (result != PixelCopy.SUCCESS) {
                                Log.e("Manatan", "PixelCopy failed: " + result);
                                bitmap.recycle();
                                sendCaptureCallback(callbackId, null);
                                return;
                            }

                            Bitmap cropped = cropBitmap(bitmap, cropX, cropY, cropWidth, cropHeight, devicePixelRatio);
                            String dataUrl = encodeBitmapToDataUrl(cropped, qualityFinal);
                            if (cropped != bitmap) {
                                cropped.recycle();
                            }
                            bitmap.recycle();
                            sendCaptureCallback(callbackId, dataUrl);
                        }, handler);
                    } else {
                        Canvas canvas = new Canvas(bitmap);
                        myWebView.draw(canvas);
                        Bitmap cropped = cropBitmap(bitmap, cropX, cropY, cropWidth, cropHeight, devicePixelRatio);
                        String dataUrl = encodeBitmapToDataUrl(cropped, qualityFinal);
                        if (cropped != bitmap) {
                            cropped.recycle();
                        }
                        bitmap.recycle();
                        sendCaptureCallback(callbackId, dataUrl);
                    }
                } catch (Exception e) {
                    Log.e("Manatan", "Native capture failed", e);
                    sendCaptureCallback(callbackId, null);
                }
            });
        }
    }

    private void launchReader(String url) {
        Intent webIntent = new Intent(WebviewActivity.this, WebviewActivity.class);
        webIntent.putExtra("TARGET_URL", url);
        webIntent.putExtra("FROM_SHIM", false); // Native launch
        startActivity(webIntent);
    }

    private void handleSmartClose() {
        if (isShimLaunch) {
            Log.i("Manatan", "Closing Shim View -> Minimizing App");
            moveTaskToBack(true);
            finish(); 
        } else {
            Log.i("Manatan", "Closing Native View -> Returning to Library");
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
                Log.e("ManatanCookie", "Sync Exception", e);
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
            Log.e("ManatanCookie", "Injection failed", e);
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
