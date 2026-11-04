package com.tervory.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.os.Bundle;
import android.content.Intent;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MobileShell.class);
        super.onCreate(savedInstanceState);
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && MobileShell.isSignIn(request.getUrl())) {
                    ((MobileShell) bridge.getPlugin("MobileShell").getInstance()).signIn();
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (!MobileShell.isWorkspace(android.net.Uri.parse(url))) return;
                try (java.io.InputStream input = getAssets().open("public/native.js")) {
                    java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    view.evaluateJavascript(output.toString(StandardCharsets.UTF_8.name()), null);
                } catch (java.io.IOException error) {
                    android.widget.Toast.makeText(MainActivity.this, "Tervory could not start. Please reopen the app.", android.widget.Toast.LENGTH_LONG).show();
                }
            }
        });
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction())) {
            ((MobileShell) bridge.getPlugin("MobileShell").getInstance()).receiveLink(intent.getData());
        }
        if (intent != null && (Intent.ACTION_SEND.equals(intent.getAction()) || Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction()))) {
            new Thread(() -> {
                try {
                    ShareInbox.receive(this, intent);
                    runOnUiThread(() -> bridge.getWebView().loadUrl(MobileShell.ORIGIN + "/chats"));
                } catch (Exception error) {
                    runOnUiThread(() -> new android.app.AlertDialog.Builder(this)
                        .setMessage("Share up to five files totaling 10 MB. Please try sharing again.")
                        .setPositiveButton("OK", null).show());
                }
            }, "tervory-share").start();
        }
    }
}
