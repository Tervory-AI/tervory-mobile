package com.tervory.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import java.io.File;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class TriggerSignInTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();

    private String javascript(MainActivity activity, String script) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch completed = new CountDownLatch(1);
        instrumentation.runOnMainSync(() -> activity.getBridge().getWebView().evaluateJavascript(script, value -> {
            result.set(value);
            completed.countDown();
        }));
        assertTrue("WebView evaluation timed out", completed.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void awaitJavascript(MainActivity activity, String expression) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + 45000;
        while (SystemClock.elapsedRealtime() < deadline) {
            if ("true".equals(javascript(activity, expression))) return;
            SystemClock.sleep(300);
        }
        throw new AssertionError("Expected authenticated WebView state: " + expression);
    }

    @Test
    public void systemBrowserPkceReturnsToAuthenticatedChatsAndNotificationOpensLink() throws Exception {
        assertTrue("Only the isolated E2E variant may use a fake origin", BuildConfig.MOBILE_E2E);
        UiDevice device = UiDevice.getInstance(instrumentation);
        device.executeShellCommand("pm set-app-links --package com.tervory.app 2 app.tervory.com");
        device.executeShellCommand("pm revoke com.tervory.app android.permission.POST_NOTIFICATIONS");
        device.executeShellCommand("pm set-permission-flags com.tervory.app android.permission.POST_NOTIFICATIONS user-set user-fixed");
        Intent launch = new Intent(instrumentation.getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        MainActivity activity = (MainActivity) instrumentation.startActivitySync(launch);
        try {
            UiObject2 proceed = device.wait(Until.findObject(By.text(Pattern.compile("(?i)Continue|Continue in browser"))), 30000);
            assertNotNull("Native Trigger sign-in prompt", proceed);
            if ("Continue in browser".equals(proceed.getText())) {
                proceed.click();
                proceed = device.wait(Until.findObject(By.res("android", "button1")), 10000);
                assertNotNull("Native system-browser confirmation", proceed);
            }
            proceed.click();
            assertTrue("Sign-in must open the system browser", device.wait(Until.hasObject(By.pkg("com.android.chrome")), 30000));
            for (int attempt = 0; attempt < 20; attempt++) {
                UiObject2 approve = device.findObject(By.text("Trigger sign-in").clickable(true));
                if (approve != null) { approve.click(); break; }
                for (String label : new String[] {"Use without an account", "Accept & continue", "No thanks", "Got it"}) {
                    UiObject2 firstRun = device.findObject(By.text(label));
                    if (firstRun != null) firstRun.click();
                }
                SystemClock.sleep(1000);
            }
            assertTrue(device.wait(Until.hasObject(By.pkg("com.tervory.app")), 30000));
            awaitJavascript(activity, "location.pathname === '/chats' && document.body.innerText.includes('Your chats')");
            assertEquals("0", javascript(activity, "document.querySelectorAll('input[type=password]').length"));
            javascript(activity, "fetch('/api/mobile/bootstrap').then(response => { window.bootstrapStatus = response.status; }); true");
            awaitJavascript(activity, "window.bootstrapStatus === 200");
            instrumentation.runOnMainSync(() -> ((com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin)
                activity.getBridge().getPlugin("PushNotifications").getInstance()).sendToken("fake-emulator-phone"));
            awaitJavascript(activity, "(fetch('/proof').then(response=>response.json()).then(proof=>{window.registeredPhones=proof.registered;}), window.registeredPhones >= 1)");
            javascript(activity, "fetch('/notify', {method:'POST'}).then(response=>response.json()).then(notification=>{window.fakeNotify=notification;}); true");
            awaitJavascript(activity, "Boolean(window.fakeNotify)");
            String serialized = javascript(activity, "JSON.stringify(window.fakeNotify)");
            String data = new org.json.JSONArray("[" + serialized + "]").getString(0);
            JSONObject notification = new JSONObject(data);
            Intent tap = new Intent(instrumentation.getTargetContext(), MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("google.message_id", "fake-notify-proof")
                .putExtra("path", notification.getString("path"));
            instrumentation.getTargetContext().startActivity(tap);
            awaitJavascript(activity, "location.pathname === '/chats' && location.search === '?notification=proof'");
            javascript(activity, "fetch('/proof').then(response=>response.json()).then(proof=>{window.signInProof=proof;}); true");
            awaitJavascript(activity, "window.signInProof && window.signInProof.browserSignIn === 1 && window.signInProof.approved === 1 && window.signInProof.exchanged === 1 && window.signInProof.authenticatedChats >= 1 && window.signInProof.notified === 1");
        } finally {
            device.takeScreenshot(new File(activity.getExternalFilesDir(null), "trigger-sign-in.png"));
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
