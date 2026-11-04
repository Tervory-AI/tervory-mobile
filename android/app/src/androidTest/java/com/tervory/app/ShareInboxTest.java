package com.tervory.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ShareInboxTest {
    @Test
    public void sharedLinkSurvivesUntilMatchingAcknowledgement() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Intent intent = new Intent(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, "https://example.org/report");
        ShareInbox.receive(context, intent);
        JSObject share = ShareInbox.pending(context);
        assertNotNull(share);
        assertEquals("https://example.org/report", share.getString("text"));
        ShareInbox.acknowledge(context, "wrong-id");
        assertNotNull(ShareInbox.pending(context));
        ShareInbox.acknowledge(context, share.getString("id"));
        assertNull(ShareInbox.pending(context));
    }

    @Test
    public void sharedFileIsCopiedBeforeTheTemporaryUriGrantExpires() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File directory = new File(context.getCacheDir(), "share");
        directory.mkdirs();
        File file = new File(directory, "report.txt");
        try (FileOutputStream output = new FileOutputStream(file)) { output.write(new byte[] { 65, 66, 67 }); }
        Uri uri = FileProvider.getUriForFile(context, "com.tervory.app.fileprovider", file);
        ShareInbox.receive(context, new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_STREAM, uri));
        file.delete();
        JSObject share = ShareInbox.pending(context);
        assertEquals("QUJD", share.getJSONArray("files").getJSONObject(0).getString("data"));
        ShareInbox.acknowledge(context, share.getString("id"));
    }
}
