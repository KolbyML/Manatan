package com.mangatan.app;


import android.app.Activity;
import android.os.Bundle;
import android.view.View;          
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.KeyEvent;

public class WebviewActivity extends Activity {
    private WebView myWebView;
    private static final String TARGET_URL = "http://127.0.0.1:4568";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // --- NEW: Remove Title Bar ---
        // Must be called before setContentView
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        // -----------------------------

        // Fullscreen immersive mode 
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
        myWebView = new WebView(this);
        setContentView(myWebView);

        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Inject Native Identifier for frontend detection
        String userAgent = webSettings.getUserAgentString();
        webSettings.setUserAgentString(userAgent + " MangatanNative");

        myWebView.setWebViewClient(new WebViewClient());
        myWebView.loadUrl(TARGET_URL);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if ((keyCode == KeyEvent.KEYCODE_BACK) && myWebView.canGoBack()) {
            myWebView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
