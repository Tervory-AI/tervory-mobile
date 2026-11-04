package com.tervory.app;

import android.content.Intent;
import android.net.Uri;
import android.app.AlertDialog;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

@CapacitorPlugin(name = "MobileShell")
public class MobileShell extends Plugin {
    private String state;
    private String verifier;
    private long started;
    private JSObject auth;
    static final String ORIGIN = "https://app.tervory.com";

    static boolean isWorkspace(Uri url) {
        return url != null && "https".equals(url.getScheme())
            && "app.tervory.com".equals(url.getHost()) && url.getUserInfo() == null
            && (url.getPort() == -1 || url.getPort() == 443);
    }

    static boolean isSignIn(Uri url) {
        return isWorkspace(url) && ("/sign-in".equals(url.getPath())
            || url.getPath().startsWith("/sign-in/") || "/mobile/sign-in".equals(url.getPath()));
    }

    private static String randomValue() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    void signIn() {
        getActivity().runOnUiThread(() -> new AlertDialog.Builder(getContext())
            .setTitle("Trigger sign-in")
            .setMessage("Continue in your browser to sign in to Tervory.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Continue", (dialog, which) -> openSignIn()).show());
    }

    private void openSignIn() {
        try {
            state = randomValue();
            verifier = randomValue();
            started = android.os.SystemClock.elapsedRealtime();
            String challenge = Base64.encodeToString(
                MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)),
                Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            Uri url = Uri.parse(ORIGIN + "/mobile/sign-in").buildUpon()
                .appendQueryParameter("redirect_uri", ORIGIN + "/mobile/callback")
                .appendQueryParameter("state", state)
                .appendQueryParameter("code_challenge", challenge)
                .appendQueryParameter("code_challenge_method", "S256").build();
            Intent browser = new Intent(Intent.ACTION_VIEW, url);
            browser.addCategory(Intent.CATEGORY_BROWSABLE);
            getActivity().startActivity(browser);
        } catch (Exception error) {
            state = null;
            verifier = null;
            new AlertDialog.Builder(getContext()).setMessage("Trigger sign-in could not open. Please try again.")
                .setPositiveButton("OK", null).show();
        }
    }

    void receiveLink(Uri url) {
        if (!isWorkspace(url) || !"/mobile/callback".equals(url.getPath()) || url.getFragment() != null) return;
        String code = url.getQueryParameter("code");
        String returnedState = url.getQueryParameter("state");
        if (state == null || verifier == null || returnedState == null
            || !MessageDigest.isEqual(state.getBytes(StandardCharsets.US_ASCII), returnedState.getBytes(StandardCharsets.US_ASCII))
            || android.os.SystemClock.elapsedRealtime() - started > 300000
            || code == null || !code.matches("[A-Za-z0-9_-]{16,512}")
            || url.getQueryParameters("code").size() != 1 || url.getQueryParameters("state").size() != 1) return;
        auth = new JSObject().put("code", code).put("verifier", verifier);
        state = null;
        verifier = null;
        getActivity().runOnUiThread(() -> getBridge().getWebView().loadUrl(ORIGIN + "/mobile/bridge"));
    }

    @PluginMethod
    public void pending(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String current = getBridge().getWebView().getUrl();
            if (current == null || !isWorkspace(Uri.parse(current))) {
                call.reject("Untrusted page");
                return;
            }
            JSObject result = new JSObject();
            if (auth != null) result.put("auth", auth);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void acknowledge(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String current = getBridge().getWebView().getUrl();
            if (current == null || !isWorkspace(Uri.parse(current))) {
                call.reject("Untrusted page");
                return;
            }
            if ("auth".equals(call.getString("kind"))) auth = null;
            call.resolve();
        });
    }
}
