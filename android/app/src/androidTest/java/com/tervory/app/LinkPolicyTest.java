package com.tervory.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class LinkPolicyTest {
    @Test
    public void rejectsUntrustedOrigins() {
        assertFalse(MobileShell.isWorkspace(Uri.parse("http://app.tervory.com")));
        assertFalse(MobileShell.isWorkspace(Uri.parse("https://app.tervory.com.evil.test")));
        assertFalse(MobileShell.isWorkspace(Uri.parse("https://user@app.tervory.com")));
        assertFalse(MobileShell.isWorkspace(Uri.parse("https://app.tervory.com:8443")));
        assertTrue(MobileShell.isWorkspace(Uri.parse(MobileShell.ORIGIN + "/chats")));
    }

    @Test
    public void signInStaysOutOfWebView() {
        assertTrue(MobileShell.isSignIn(Uri.parse(MobileShell.ORIGIN + "/sign-in")));
        assertTrue(MobileShell.isSignIn(Uri.parse(MobileShell.ORIGIN + "/sign-in/continue")));
        assertFalse(MobileShell.isSignIn(Uri.parse(MobileShell.ORIGIN + "/chats")));
    }
}
