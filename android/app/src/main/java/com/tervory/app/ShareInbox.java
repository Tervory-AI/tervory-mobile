package com.tervory.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.database.Cursor;
import android.util.AtomicFile;
import android.util.Base64;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.UUID;

final class ShareInbox {
    private static final int LIMIT = 10 * 1024 * 1024;

    private static AtomicFile store(Context context) {
        return new AtomicFile(new File(context.getNoBackupFilesDir(), "share-inbox.json"));
    }

    static synchronized void receive(Context context, Intent intent) throws Exception {
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;
        CharSequence suppliedText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        String text = suppliedText == null ? "" : suppliedText.toString();
        int used = text.getBytes(StandardCharsets.UTF_8).length;
        if (used > LIMIT) throw new IllegalArgumentException();
        ArrayList<Uri> streams = new ArrayList<>();
        if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> supplied = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (supplied != null) streams.addAll(supplied);
        } else {
            Uri supplied = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (supplied != null) streams.add(supplied);
        }
        if (streams.size() > 5) throw new IllegalArgumentException();
        JSONArray files = new JSONArray();
        for (Uri uri : streams) {
            if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException();
            String name = "shared-file";
            try (Cursor cursor = context.getContentResolver().query(uri,
                    new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) name = cursor.getString(0);
            }
            name = name.replaceAll("[/\\\\\\x00-\\x1f]", "_");
            if (name.length() > 180) name = name.substring(0, 180);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (InputStream input = context.getContentResolver().openInputStream(uri)) {
                if (input == null) throw new IllegalArgumentException();
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    used += count;
                    if (used > LIMIT) throw new IllegalArgumentException();
                    output.write(buffer, 0, count);
                }
            }
            files.put(new JSONObject().put("name", name)
                .put("data", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)));
        }
        if (text.isEmpty() && files.length() == 0) throw new IllegalArgumentException();
        JSObject share = new JSObject().put("id", UUID.randomUUID().toString())
            .put("text", text).put("files", files).put("created", System.currentTimeMillis());
        AtomicFile target = store(context);
        FileOutputStream output = null;
        try {
            output = target.startWrite();
            output.write(share.toString().getBytes(StandardCharsets.UTF_8));
            target.finishWrite(output);
        } catch (Exception error) {
            if (output != null) target.failWrite(output);
            throw error;
        }
    }

    static synchronized JSObject pending(Context context) {
        AtomicFile target = store(context);
        try {
            JSObject share = new JSObject(new String(target.readFully(), StandardCharsets.UTF_8));
            if (System.currentTimeMillis() - share.getLong("created") > 86400000) {
                target.delete();
                return null;
            }
            return share;
        } catch (Exception error) {
            target.delete();
            return null;
        }
    }

    static synchronized void acknowledge(Context context, String id) {
        JSObject current = pending(context);
        if (current != null && id != null && id.equals(current.getString("id"))) store(context).delete();
    }
}
