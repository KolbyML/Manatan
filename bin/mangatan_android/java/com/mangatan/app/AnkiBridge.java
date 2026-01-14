package com.mangatan.app;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.text.TextUtils;
import android.util.Base64;
import android.util.Log;
import android.content.ContentValues;
import android.provider.MediaStore;
import android.os.Environment;
import java.io.OutputStream;
import org.json.JSONArray;
import org.json.JSONObject;
import android.os.ParcelFileDescriptor;  
import java.io.FileNotFoundException;   
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import android.content.Intent;

public class AnkiBridge {
    private static final String TAG = "AnkiBridge";

    // Server State
    private static Context appContext;
    private static volatile boolean serverRunning = false;
    private static ServerSocket serverSocket;
    private static final ExecutorService EXEC = Executors.newFixedThreadPool(4);

    // API Constants
    private static final String AUTHORITY = "com.ichi2.anki.flashcards";
    private static final Uri BASE_URI = Uri.parse("content://" + AUTHORITY);
    private static final Uri NOTES_URI = Uri.withAppendedPath(BASE_URI, "notes");
    private static final Uri NOTES_V2_URI = Uri.withAppendedPath(BASE_URI, "notes_v2");
    private static final Uri MODELS_URI = Uri.withAppendedPath(BASE_URI, "models");
    private static final Uri DECKS_URI = Uri.withAppendedPath(BASE_URI, "decks");
    private static final Uri MEDIA_URI = Uri.withAppendedPath(BASE_URI, "media");

    // Columns
    private static final String NOTE_ID = "_id";
    private static final String NOTE_MID = "mid";
    private static final String NOTE_FLDS = "flds";
    private static final String NOTE_TAGS = "tags";
    private static final String NOTE_CSUM = "csum";

    private static final String MODEL_ID = "_id";
    private static final String MODEL_NAME = "name";
    private static final String MODEL_FIELD_NAMES = "field_names";

    private static final String DECK_ID = "deck_id";
    private static final String DECK_NAME = "deck_name";

    private static final String MEDIA_FILE_URI = "file_uri";
    private static final String MEDIA_PREFERRED_NAME = "preferred_name";

    private static final String FIELD_SEPARATOR = "\u001f";

    // HTML Utils
    private static final Pattern STYLE_TAG = Pattern.compile("(?s)<style.*?>.*?</style>");
    private static final Pattern SCRIPT_TAG = Pattern.compile("(?s)<script.*?>.*?</script>");
    private static final Pattern HTML_TAG = Pattern.compile("<.*?>");
    private static final Pattern IMG_TAG = Pattern.compile("<img src=[\"']?([^\"'>]+)[\"']? ?/?>");

    // ========================================================================
    // SERVER MANAGEMENT
    // ========================================================================

    public static void startAnkiConnectServer(Context context) {
        appContext = context.getApplicationContext();
        if (serverRunning) return;
        serverRunning = true;

        new Thread(() -> {
            try {
                // Bind to 0.0.0.0 to allow connections from any IP
                serverSocket = new ServerSocket();
                serverSocket.bind(new InetSocketAddress("0.0.0.0", 8765));
                Log.i(TAG, "✅ AnkiConnect listening on 0.0.0.0:8765");

                while (serverRunning) {
                    try {
                        Socket client = serverSocket.accept();
                        EXEC.execute(() -> handleAnkiRequest(client));
                    } catch (java.net.SocketException e) {
                        if (!serverRunning) break;
                        Log.e(TAG, "Socket closed", e);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "AnkiConnect server start error", e);
            }
        }, "AnkiConnect-Server").start();
    }

    public static void stopAnkiConnectServer() {
        serverRunning = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (Exception e) {
            Log.e(TAG, "Error stopping server", e);
        }
    }

    private static void handleAnkiRequest(Socket client) {
        final int HEADER_LIMIT = 32 * 1024;     // 32 KB
        final int BODY_LIMIT = 5_000_000;       // 5 MB (safe upper bound for our use)
        try {
            client.setSoTimeout(10_000); // 10s socket read timeout
            InputStream rawIn = client.getInputStream();
            OutputStream rawOut = client.getOutputStream();

            // --- Read headers  ---
            ByteArrayOutputStream headerBuffer = new ByteArrayOutputStream();
            byte[] last4 = new byte[4];
            int idx = 0;
            int b;
            while (true) {
                b = rawIn.read();
                if (b == -1) {
                    Log.w(TAG, "EOF while reading headers");
                    return;
                }
                headerBuffer.write(b);
                last4[idx++ % 4] = (byte) b;

                if (idx >= 4) {
                    if (last4[(idx - 4) & 3] == '\r' &&
                            last4[(idx - 3) & 3] == '\n' &&
                            last4[(idx - 2) & 3] == '\r' &&
                            last4[(idx - 1) & 3] == '\n') {
                        break;
                    }
                }
                if (idx >= 2) {
                    if (last4[(idx - 2) & 3] == '\n' &&
                            last4[(idx - 1) & 3] == '\n') {
                        break;
                    }
                }

                if (headerBuffer.size() > HEADER_LIMIT) {
                    writeResponse(rawOut, 413, error("Headers too large"), true);
                    return;
                }
            }

            // decode headers using ISO-8859-1 per HTTP spec
            String headerStr = new String(headerBuffer.toByteArray(), StandardCharsets.ISO_8859_1);
            String[] lines = headerStr.split("\r?\n");

            if (lines.length == 0) {
                writeResponse(rawOut, 400, error("Invalid request"), true);
                return;
            }

            // Parse request line: METHOD PATH VERSION
            String[] requestParts = lines[0].split(" ");
            String method = requestParts.length > 0 ? requestParts[0].trim() : "GET";

            // Build header map
            java.util.Map<String, String> hdrs = new java.util.HashMap<>();
            for (int i = 1; i < lines.length; i++) {
                String line = lines[i];
                if (line == null || line.length() == 0) break;
                int colon = line.indexOf(':');
                if (colon <= 0) continue;
                String name = line.substring(0, colon).trim().toLowerCase();
                String value = line.substring(colon + 1).trim();
                hdrs.put(name, value);
            }

            // Handle Transfer-Encoding
            String transferEnc = hdrs.get("transfer-encoding");
            if (transferEnc != null && transferEnc.toLowerCase().contains("chunk")) {
                writeResponse(rawOut, 501, error("Chunked transfer-encoding not supported"), true);
                return;
            }

            // Handle Expect: 100-continue
            String expect = hdrs.get("expect");
            if (expect != null && expect.equalsIgnoreCase("100-continue")) {
                try {
                    rawOut.write("HTTP/1.1 100 Continue\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
                    rawOut.flush();
                } catch (Exception e) {
                    Log.w(TAG, "Failed to send 100-continue", e);
                }
            }

            // Parse Content-Length
            int contentLength = 0;
            String cl = hdrs.get("content-length");
            if (cl != null) {
                try {
                    contentLength = Integer.parseInt(cl.trim());
                } catch (NumberFormatException ignored) {
                    writeResponse(rawOut, 400, error("Invalid Content-Length"), true);
                    return;
                }
            }

            // OPTIONS preflight (CORS)
            if ("OPTIONS".equalsIgnoreCase(method)) {
                writeResponse(rawOut, 200, "", true);
                return;
            }

            // Only POST is allowed for API calls
            if (!"POST".equalsIgnoreCase(method)) {
                writeResponse(rawOut, 405, error("Method not allowed"), true);
                return;
            }

            // Sanity checks on Content-Length
            if (contentLength < 0) {
                writeResponse(rawOut, 400, error("Invalid Content-Length"), true);
                return;
            }
            if (contentLength > BODY_LIMIT) {
                writeResponse(rawOut, 413, error("Body too large"), true);
                return;
            }

            // Read body (exactly contentLength bytes)
            String jsonRequest = "{}";
            if (contentLength > 0) {
                byte[] body = new byte[contentLength];
                int totalRead = 0;
                while (totalRead < contentLength) {
                    int r = rawIn.read(body, totalRead, contentLength - totalRead);
                    if (r == -1) {
                        writeResponse(rawOut, 400, error("Unexpected EOF while reading body"), true);
                        return;
                    }
                    totalRead += r;
                }
                // decode body as UTF-8 (handles Japanese and other Unicode)
                jsonRequest = new String(body, 0, totalRead, StandardCharsets.UTF_8);
            }

            // Process and respond
            String jsonResponse = processRequest(appContext, jsonRequest);
            writeResponse(rawOut, 200, jsonResponse, true);

        } catch (java.net.SocketTimeoutException ste) {
            // read timed out — log and drop the connection
            Log.w(TAG, "Request timed out");
        } catch (Exception e) {
            Log.e(TAG, "Request Error", e);
            try {
                // Try to return 500 error to client
                OutputStream out = client.getOutputStream();
                writeResponse(out, 500, error(e.getMessage()), true);
            } catch (Exception ignored) {
            }
        } finally {
            try {
                client.close();
            } catch (Exception ignored) {
            }
        }
    }

    private static void writeResponse(OutputStream out, int code, String body, boolean cors) throws Exception {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        String status = (code == 200) ? "OK" : "Error";

        StringBuilder h = new StringBuilder();
        h.append("HTTP/1.1 ").append(code).append(" ").append(status).append("\r\n");
        h.append("Content-Type: application/json; charset=utf-8\r\n");

        if (cors) {
            h.append("Access-Control-Allow-Origin: *\r\n");
            h.append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
            h.append("Access-Control-Allow-Headers: *\r\n"); // Allow all headers
            h.append("Access-Control-Allow-Private-Network: true\r\n");
        }

        h.append("Content-Length: ").append(bytes.length).append("\r\n");
        h.append("\r\n");

        out.write(h.toString().getBytes(StandardCharsets.UTF_8));
        out.write(bytes);
        out.flush();
    }

    // ========================================================================
    // LOGIC
    // ========================================================================

    public static String processRequest(Context context, String jsonRequest) {
        try {
            JSONObject request = new JSONObject(jsonRequest);
            if (!request.has("action")) return error("Missing action");

            String action = request.getString("action");
            if ("version".equals(action)) {
                return "{\"result\":6,\"error\":null}";
            }
            if ("requestPermission".equals(action)) {
                return "{\"result\":{\"permission\":\"granted\",\"version\":6},\"error\":null}";
            }
            JSONObject params = request.optJSONObject("params");

            Object result;
            switch (action) {
                case "version":
                    result = 7;
                    break;
                case "requestPermission":
                    result = permission();
                    break;
                case "deckNames":
                    result = deckNames(context);
                    break;
                case "modelNames":
                    result = modelNames(context);
                    break;
                case "modelFieldNames":
                    result = modelFieldNames(context, params);
                    break;
                case "findNotes":
                    result = findNotes(context, params);
                    break;
                case "guiBrowse":
                    result = guiBrowse(context, params);
                    break;
                case "addNote":
                    result = addNote(context, params);
                    break;
                case "updateNoteFields":
                    updateNote(context, params);
                    result = JSONObject.NULL;
                    break;
                case "canAddNotes":
                    result = canAddNotes(context, params);
                    break;
                case "storeMediaFile":
                    result = storeMediaFile(context, params);
                    break;
                case "multi":
                    return handleMulti(context, request);
                default:
                    return error("Unknown action: " + action);
            }
            return success(result);
        } catch (Exception e) {
            return error(e.getMessage());
        }
    }

    private static JSONObject permission() throws Exception {
        JSONObject r = new JSONObject();
        r.put("permission", "granted");
        r.put("version", 6);
        return r;
    }

    private static JSONArray deckNames(Context ctx) {
        JSONArray decks = new JSONArray();
        try (Cursor c = ctx.getContentResolver().query(DECKS_URI, new String[]{DECK_NAME}, null, null, null)) {
            if (c != null) while (c.moveToNext()) decks.put(c.getString(0));
        } catch (Exception e) {
            Log.e(TAG, "deckNames", e);
        }
        return decks;
    }

    private static JSONArray modelNames(Context ctx) {
        JSONArray models = new JSONArray();
        try (Cursor c = ctx.getContentResolver().query(MODELS_URI, new String[]{MODEL_NAME}, null, null, null)) {
            if (c != null) while (c.moveToNext()) models.put(c.getString(0));
        } catch (Exception e) {
            Log.e(TAG, "modelNames", e);
        }
        return models;
    }

    private static JSONArray modelFieldNames(Context ctx, JSONObject params) throws Exception {
        String targetName = params.getString("modelName");
        JSONArray result = new JSONArray();

        // 1. We query for the Name AND the Fields
        try (Cursor c = ctx.getContentResolver().query(
                MODELS_URI,
                new String[]{MODEL_NAME, MODEL_FIELD_NAMES},
                null, null, null)) { // We query all because AnkiDroid is ignoring filters

            if (c != null) {
                while (c.moveToNext()) {
                    String dbModelName = c.getString(0);

                    // 2. Manually verify the name matches exactly
                    if (dbModelName == null || !dbModelName.equals(targetName)) {
                        continue;
                    }

                    // 3. If we are here, we found the right model. Now parse it.
                    String rawData = c.getString(1);
                    if (rawData == null) continue;

                    JSONArray candidate = new JSONArray();
                    String trimmed = rawData.trim();

                    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                        try {
                            JSONArray jsonArray = new JSONArray(trimmed);
                            for (int i = 0; i < jsonArray.length(); i++) {
                                Object item = jsonArray.get(i);
                                if (item instanceof JSONObject) {
                                    candidate.put(((JSONObject) item).optString("name"));
                                } else {
                                    candidate.put(item.toString());
                                }
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "JSON error", e);
                        }
                    } else {
                        String[] fields = splitFields(rawData);
                        for (String f : fields) candidate.put(f);
                    }


                    if (candidate.length() > result.length()) {
                        result = candidate;
                    }
                }
            }
        }
        return result;
    }

    private static JSONArray findNotes(Context ctx, JSONObject params) throws Exception {
        String query = params.getString("query");
        JSONArray ids = new JSONArray();
        try (Cursor c = ctx.getContentResolver().query(NOTES_URI, new String[]{NOTE_ID}, query, null, null)) {
            if (c != null) while (c.moveToNext()) ids.put(c.getLong(0));
        }
        return ids;
    }

    private static JSONArray guiBrowse(Context ctx, JSONObject params) throws Exception {
        String query = params.getString("query");
        Uri uri = Uri.parse("anki://x-callback-url/browser?search=" + Uri.encode(query));
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.setPackage("com.ichi2.anki");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            ctx.startActivity(intent);
        } catch (Exception e) {
            Log.w(TAG, "guiBrowse", e);
        }
        return new JSONArray();
    }

    private static long addNote(Context ctx, JSONObject params) throws Exception {
        JSONObject note = params.getJSONObject("note");
        String deckName = note.getString("deckName");
        String modelName = note.getString("modelName");
        JSONObject fields = note.getJSONObject("fields");

        if (note.has("picture")) processMedia(ctx, fields, note.get("picture"));
        if (note.has("audio")) processMedia(ctx, fields, note.get("audio"));

        long targetDeckId = findDeckId(ctx, deckName);
        long modelId = findModelId(ctx, modelName);

        String[] fieldNames = getModelFields(ctx, modelId);
        String[] vals = new String[fieldNames.length];
        for (int i = 0; i < fieldNames.length; i++) {
            vals[i] = fields.optString(fieldNames[i], "");
        }

        Set<String> tags = new HashSet<>();
        tags.add("Mangatan");
        JSONArray tagArr = note.optJSONArray("tags");
        if (tagArr != null) for (int i = 0; i < tagArr.length(); i++) tags.add(tagArr.getString(i));

        ContentValues cv = new ContentValues();
        cv.put(NOTE_MID, modelId);
        cv.put(NOTE_FLDS, joinFields(vals));
        if (!tags.isEmpty()) cv.put(NOTE_TAGS, joinTags(tags));

        Uri result = ctx.getContentResolver().insert(NOTES_URI, cv);
        if (result == null) throw new Exception("Insert failed");

        long newNoteId = Long.parseLong(result.getLastPathSegment());

        moveCardsToDeck(ctx, newNoteId, targetDeckId);

        return newNoteId;
    }

    private static void moveCardsToDeck(Context ctx, long noteId, long targetDeckId) {
        Uri cardsUri = Uri.withAppendedPath(NOTES_URI, noteId + "/cards");
        try (Cursor c = ctx.getContentResolver().query(cardsUri, new String[]{"ord", "deck_id"}, null, null, null)) {
            if (c != null) {
                while (c.moveToNext()) {
                    int ord = c.getInt(0);
                    long currentDeckId = c.getLong(1);

                    if (currentDeckId != targetDeckId) {
                        Uri specificCardUri = Uri.withAppendedPath(cardsUri, String.valueOf(ord));
                        ContentValues values = new ContentValues();
                        values.put("deck_id", targetDeckId);
                        ctx.getContentResolver().update(specificCardUri, values, null, null);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to move cards to deck", e);
        }
    }

    private static void updateNote(Context ctx, JSONObject params) throws Exception {
        JSONObject note = params.getJSONObject("note");
        long noteId = note.getLong("id");
        JSONObject fields = note.getJSONObject("fields");

        if (note.has("picture")) processMedia(ctx, fields, note.get("picture"));

        Uri uri = Uri.withAppendedPath(NOTES_URI, String.valueOf(noteId));
        try (Cursor c = ctx.getContentResolver().query(uri, new String[]{NOTE_MID, NOTE_FLDS}, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                long modelId = c.getLong(0);
                String[] oldFields = splitFields(c.getString(1));
                String[] fieldNames = getModelFields(ctx, modelId);
                String[] newFields = new String[fieldNames.length];

                for (int i = 0; i < fieldNames.length; i++) {
                    if (fields.has(fieldNames[i])) newFields[i] = fields.getString(fieldNames[i]);
                    else if (i < oldFields.length) newFields[i] = oldFields[i];
                    else newFields[i] = "";
                }

                ContentValues cv = new ContentValues();
                cv.put(NOTE_FLDS, joinFields(newFields));
                ctx.getContentResolver().update(uri, cv, null, null);
            }
        }
    }

    private static JSONArray canAddNotes(Context ctx, JSONObject params) throws Exception {
        JSONArray notes = params.getJSONArray("notes");
        JSONArray results = new JSONArray();
        if (notes.length() == 0) return results;

        List<Long> checksums = new ArrayList<>();
        for (int i = 0; i < notes.length(); i++) {
            JSONObject note = notes.getJSONObject(i);
            JSONObject fields = note.getJSONObject("fields");
            String firstKey = fields.keys().next();
            checksums.add(fieldChecksum(fields.getString(firstKey)));
        }

        String in = TextUtils.join(",", checksums);
        try (Cursor c = ctx.getContentResolver().query(NOTES_V2_URI, new String[]{NOTE_CSUM}, NOTE_CSUM + " IN (" + in + ")", null, null)) {
            HashSet<Long> existing = new HashSet<>();
            if (c != null) while (c.moveToNext()) existing.add(c.getLong(0));
            for (Long csum : checksums) results.put(!existing.contains(csum));
        }
        return results;
    }

    private static void processMedia(Context ctx, JSONObject fields, Object mediaObj) throws Exception {
        JSONArray arr = (mediaObj instanceof JSONArray) ? (JSONArray) mediaObj : new JSONArray().put(mediaObj);

        for (int i = 0; i < arr.length(); i++) {
            JSONObject m = arr.getJSONObject(i);
            if (!m.has("data") || !m.has("filename")) continue;

            String storedFilename = saveMedia(ctx, m.getString("filename"), m.getString("data"));
            if (storedFilename == null) continue;

            String val;
            if (storedFilename.toLowerCase().endsWith(".mp3") ||
                    storedFilename.toLowerCase().endsWith(".aac") ||
                    storedFilename.toLowerCase().endsWith(".m4a") ||
                    storedFilename.toLowerCase().endsWith(".wav")) {
                val = "[sound:" + storedFilename + "]";
            } else {
                val = "<img src=\"" + storedFilename + "\">";
            }

            JSONArray targets = m.optJSONArray("fields");
            if (targets != null) {
                for (int j = 0; j < targets.length(); j++) {
                    String fName = targets.getString(j);
                    String current = fields.optString(fName, "");
                    fields.put(fName, current + val);
                }
            }
        }
    }

    private static String storeMediaFile(Context ctx, JSONObject params) throws Exception {
        return saveMedia(ctx, params.getString("filename"), params.getString("data"));
    }

    private static String saveMedia(Context ctx, String name, String b64) throws Exception {
    byte[] data = Base64.decode(b64, Base64.NO_WRAP);
    
    ContentValues values = new ContentValues();
    values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
    values.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Mangatan");

    Uri externalUri = ctx.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
    if (externalUri == null) throw new Exception("Failed to create MediaStore entry");

    try (OutputStream out = ctx.getContentResolver().openOutputStream(externalUri)) {
        out.write(data);
    }

   
    ctx.grantUriPermission(
        "com.ichi2.anki", 
        externalUri, 
        Intent.FLAG_GRANT_READ_URI_PERMISSION
    );
  
    ContentValues cv = new ContentValues();
    cv.put("file_uri", externalUri.toString()); 
    cv.put("preferred_name", name.replaceAll("\\..*$", ""));

    Log.i("AnkiBridge", "Asking AnkiDroid to copy: " + externalUri.toString());
    Uri res = ctx.getContentResolver().insert(MEDIA_URI, cv);
    
    
    ctx.getContentResolver().delete(externalUri, null, null);

    if (res != null) {
        return new File(res.getPath()).getName();
    }
    
    throw new Exception("AnkiDroid failed to copy the media");
}

    private static String handleMulti(Context ctx, JSONObject req) throws Exception {
        JSONArray acts = req.getJSONObject("params").getJSONArray("actions");
        JSONArray res = new JSONArray();
        for (int i = 0; i < acts.length(); i++) {
            String subJson = acts.getJSONObject(i).toString();
            String subRes = processRequest(ctx, subJson);
            res.put(new JSONObject(subRes));
        }
        return res.toString();
    }

    private static long fieldChecksum(String data) {
        try {
            String cleaned = IMG_TAG.matcher(data).replaceAll(" $1 ");
            cleaned = STYLE_TAG.matcher(cleaned).replaceAll("");
            cleaned = SCRIPT_TAG.matcher(cleaned).replaceAll("");
            cleaned = HTML_TAG.matcher(cleaned).replaceAll("");
            cleaned = cleaned.replace("&nbsp;", " ").trim();

            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] hash = md.digest(cleaned.getBytes(StandardCharsets.UTF_8));
            BigInteger big = new BigInteger(1, hash);
            String hex = big.toString(16);
            while (hex.length() < 40) hex = "0" + hex;
            return Long.parseLong(hex.substring(0, 8), 16);
        } catch (Exception e) {
            return 0;
        }
    }

    private static long findDeckId(Context ctx, String targetDeckName) throws Exception {


        try (Cursor c = ctx.getContentResolver().query(
                DECKS_URI,
                new String[]{DECK_ID, DECK_NAME},
                null,
                null,
                null)) {

            if (c != null) {
                while (c.moveToNext()) {
                    long deckId = c.getLong(c.getColumnIndex(DECK_ID));
                    String deckName = c.getString(c.getColumnIndex(DECK_NAME));

                    // Manual string comparison
                    if (deckName != null && deckName.equals(targetDeckName)) {
                        Log.d(TAG, "✅ Found deck: '" + deckName + "' with ID: " + deckId);
                        return deckId;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying decks", e);
            throw e;
        }

        throw new Exception("Deck '" + targetDeckName + "' not found. Available decks can be queried with deckNames action.");
    }

    private static long findModelId(Context ctx, String targetModelName) throws Exception {
        try (Cursor c = ctx.getContentResolver().query(
                MODELS_URI,
                new String[]{MODEL_ID, MODEL_NAME},
                null, null, null)) {

            if (c != null) {
                while (c.moveToNext()) {
                    String modelName = c.getString(1);
                    if (modelName != null && modelName.equals(targetModelName)) {
                        return c.getLong(0);
                    }
                }
            }
        }
        throw new Exception("Model '" + targetModelName + "' not found.");
    }

    private static String[] getModelFields(Context ctx, long targetId) throws Exception {
        try (Cursor c = ctx.getContentResolver().query(
                MODELS_URI,
                new String[]{MODEL_ID, MODEL_FIELD_NAMES},
                null, null, null)) {

            if (c != null) {
                while (c.moveToNext()) {
                    if (c.getLong(0) == targetId) {
                        String rawData = c.getString(1);
                        return parseFieldsInternal(rawData);
                    }
                }
            }
        }
        throw new Exception("Model fields not found for ID: " + targetId);
    }

    private static String[] parseFieldsInternal(String rawData) {
        if (rawData == null) return new String[0];
        String trimmed = rawData.trim();
        List<String> result = new ArrayList<>();

        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                JSONArray jsonArray = new JSONArray(trimmed);
                for (int i = 0; i < jsonArray.length(); i++) {
                    Object item = jsonArray.get(i);
                    if (item instanceof JSONObject) {
                        result.add(((JSONObject) item).optString("name"));
                    } else {
                        result.add(item.toString());
                    }
                }
                return result.toArray(new String[0]);
            } catch (Exception e) {
                Log.e(TAG, "Field parse error", e);
            }
        }
        return splitFields(rawData);
    }

    private static String joinFields(String[] arr) {
        return String.join(FIELD_SEPARATOR, arr);
    }

    private static String[] splitFields(String str) {
        return str.split(FIELD_SEPARATOR, -1);
    }

    private static String joinTags(Set<String> tags) {
        return String.join(" ", tags);
    }

    private static String success(Object result) {
        String resStr = (result == null) ? "null" : result.toString();
        if (result != null && !(result instanceof JSONObject) && !(result instanceof JSONArray) && !(result instanceof Number) && !(result instanceof Boolean)) {
            resStr = JSONObject.quote(result.toString());
        }
        return "{\"result\":" + resStr + ",\"error\":null}";
    }

    private static String error(String msg) {
        String safeMsg = (msg == null) ? "Unknown error" : msg.replace("\"", "\\\"");
        return "{\"result\":null,\"error\":\"" + safeMsg + "\"}";
    }
} 