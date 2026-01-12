package com.mangatan.app;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.text.TextUtils;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

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
        try {
            client.setSoTimeout(10000); // 10s timeout prevents hangs
            InputStream rawIn = client.getInputStream();
            OutputStream rawOut = client.getOutputStream();
            
            // 1. Read Headers (Raw Bytes to handle \r\n\r\n reliably)
            ByteArrayOutputStream headerBuffer = new ByteArrayOutputStream();
            int b;
            while ((b = rawIn.read()) != -1) {
                headerBuffer.write(b);
                // Simple check for \r\n\r\n (end of headers)
                if (b == '\n') {
                    String s = headerBuffer.toString("UTF-8");
                    if (s.endsWith("\r\n\r\n") || s.endsWith("\n\n")) break;
                }
            }
            
            if (headerBuffer.size() == 0) return;
            
            String headerStr = headerBuffer.toString("UTF-8");
            String[] lines = headerStr.split("\r?\n");
            
            // Parse Request Line
            if (lines.length == 0) return;
            String[] requestParts = lines[0].split(" ");
            String method = requestParts.length > 0 ? requestParts[0] : "GET";
            
            // Parse Headers
            int contentLength = 0;
            for (String line : lines) {
                if (line.toLowerCase().startsWith("content-length:")) {
                    try {
                        contentLength = Integer.parseInt(line.split(":", 2)[1].trim());
                    } catch (Exception ignored) {}
                }
            }
            
            // 2. Handle Preflight (OPTIONS)
            if ("OPTIONS".equals(method)) {
                writeResponse(rawOut, 200, "", true);
                return;
            }
            
            // 3. Read Body (Raw Bytes)
            // Use byte array to respect Content-Length correctly (UTF-8 safety)
            String jsonRequest = "{}";
            if (contentLength > 0) {
                byte[] bodyBytes = new byte[contentLength];
                int totalRead = 0;
                while (totalRead < contentLength) {
                    int count = rawIn.read(bodyBytes, totalRead, contentLength - totalRead);
                    if (count == -1) break; // EOF
                    totalRead += count;
                }
                jsonRequest = new String(bodyBytes, 0, totalRead, StandardCharsets.UTF_8);
            }
            
            // 4. Process Logic
            String jsonResponse = processRequest(appContext, jsonRequest);
            writeResponse(rawOut, 200, jsonResponse, true);
            
        } catch (java.net.SocketTimeoutException e) {
            // Expected for empty/dead connections, suppress log spam
        } catch (Exception e) {
            Log.e(TAG, "Request Error", e);
        } finally {
            try { client.close(); } catch (Exception ignored) {}
        }
    }
    
    private static void writeResponse(OutputStream out, int code, String body, boolean cors) throws Exception {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        String status = (code == 200) ? "OK" : "Error";
        
        StringBuilder h = new StringBuilder();
        h.append("HTTP/1.1 ").append(code).append(" ").append(status).append("\r\n");
        h.append("Content-Type: application/json; charset=utf-8\r\n");
        h.append("Connection: close\r\n");
        if (cors) {
            h.append("Access-Control-Allow-Origin: *\r\n"); // Allow Yomitan extension
            h.append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
            h.append("Access-Control-Allow-Headers: Content-Type, Authorization\r\n");
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
            JSONObject params = request.optJSONObject("params");
            
            Object result;
            switch (action) {
                case "version": result = 6; break;
                case "requestPermission": result = permission(); break;
                case "deckNames": result = deckNames(context); break;
                case "modelNames": result = modelNames(context); break;
                case "modelFieldNames": result = modelFieldNames(context, params); break;
                case "findNotes": result = findNotes(context, params); break;
                case "guiBrowse": result = guiBrowse(context, params); break;
                case "addNote": result = addNote(context, params); break;
                case "updateNoteFields": updateNote(context, params); result = JSONObject.NULL; break;
                case "canAddNotes": result = canAddNotes(context, params); break;
                case "storeMediaFile": result = storeMediaFile(context, params); break;
                case "multi": return handleMulti(context, request);
                default: return error("Unknown action: " + action);
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
        } catch (Exception e) { Log.e(TAG, "deckNames", e); }
        return decks;
    }
    
    private static JSONArray modelNames(Context ctx) {
        JSONArray models = new JSONArray();
        try (Cursor c = ctx.getContentResolver().query(MODELS_URI, new String[]{MODEL_NAME}, null, null, null)) {
            if (c != null) while (c.moveToNext()) models.put(c.getString(0));
        } catch (Exception e) { Log.e(TAG, "modelNames", e); }
        return models;
    }
    
    private static JSONArray modelFieldNames(Context ctx, JSONObject params) throws Exception {
        String name = params.getString("modelName");
        try (Cursor c = ctx.getContentResolver().query(MODELS_URI, new String[]{MODEL_FIELD_NAMES}, MODEL_NAME + " = ?", new String[]{name}, null)) {
            if (c != null && c.moveToFirst()) {
                String[] fields = splitFields(c.getString(0));
                JSONArray result = new JSONArray();
                for (String f : fields) result.put(f);
                return result;
            }
        }
        return new JSONArray();
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
        try { ctx.startActivity(intent); } catch (Exception e) { Log.w(TAG, "guiBrowse", e); }
        return new JSONArray();
    }
    
    private static long addNote(Context ctx, JSONObject params) throws Exception {
        JSONObject note = params.getJSONObject("note");
        String deckName = note.getString("deckName");
        String modelName = note.getString("modelName");
        JSONObject fields = note.getJSONObject("fields");
        
        if (note.has("picture")) processMedia(ctx, fields, note.get("picture"));
        if (note.has("audio")) processMedia(ctx, fields, note.get("audio"));
        
        long deckId = findDeckId(ctx, deckName);
        long modelId = findModelId(ctx, modelName);
        String[] fieldNames = getModelFields(ctx, modelId);
        
        String[] vals = new String[fieldNames.length];
        for (int i = 0; i < fieldNames.length; i++) vals[i] = fields.optString(fieldNames[i], "");
        
        Set<String> tags = new HashSet<>();
        tags.add("Mangatan");
        JSONArray tagArr = note.optJSONArray("tags");
        if (tagArr != null) for (int i = 0; i < tagArr.length(); i++) tags.add(tagArr.getString(i));
        
        ContentValues cv = new ContentValues();
        cv.put(NOTE_MID, modelId);
        cv.put(NOTE_FLDS, joinFields(vals));
        if (!tags.isEmpty()) cv.put(NOTE_TAGS, joinTags(tags));
        
        Uri.Builder b = NOTES_URI.buildUpon();
        b.appendQueryParameter("deckId", String.valueOf(deckId));
        
        Uri result = ctx.getContentResolver().insert(b.build(), cv);
        if (result != null) return Long.parseLong(result.getLastPathSegment());
        throw new Exception("Insert failed");
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
        for (int i=0; i<arr.length(); i++) {
            JSONObject m = arr.getJSONObject(i);
            if (!m.has("data") || !m.has("filename")) continue;
            String stored = saveMedia(ctx, m.getString("filename"), m.getString("data"));
            String tag = (stored.endsWith(".mp3") || stored.endsWith(".aac")) ? "[sound:"+stored+"]" : "<img src=\""+stored+"\">";
            
            JSONArray targets = m.getJSONArray("fields");
            for (int j=0; j<targets.length(); j++) {
                String f = targets.getString(j);
                fields.put(f, fields.optString(f, "") + tag);
            }
        }
    }
    
    private static String storeMediaFile(Context ctx, JSONObject params) throws Exception {
        return saveMedia(ctx, params.getString("filename"), params.getString("data"));
    }

    private static String saveMedia(Context ctx, String name, String b64) throws Exception {
        byte[] data = Base64.decode(b64, Base64.DEFAULT);
        File file = new File(ctx.getCacheDir(), name);
        try (FileOutputStream fos = new FileOutputStream(file)) { fos.write(data); }
        
        String authority = "com.mangatan.app.fileprovider";
        Uri uri = Uri.parse("content://" + authority + "/cache/" + name);
        
        ctx.grantUriPermission("com.ichi2.anki", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        
        ContentValues cv = new ContentValues();
        cv.put(MEDIA_FILE_URI, uri.toString());
        cv.put(MEDIA_PREFERRED_NAME, name.replaceAll("\\..*$", ""));
        
        Uri res = ctx.getContentResolver().insert(MEDIA_URI, cv);
        return res != null ? new File(res.getPath()).getName() : name;
    }

    private static String handleMulti(Context ctx, JSONObject req) throws Exception {
        JSONArray acts = req.getJSONObject("params").getJSONArray("actions");
        JSONArray res = new JSONArray();
        for(int i=0; i<acts.length(); i++) {
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
        } catch (Exception e) { return 0; }
    }
    
    private static long findDeckId(Context ctx, String name) throws Exception {
        try (Cursor c = ctx.getContentResolver().query(DECKS_URI, new String[]{DECK_ID}, DECK_NAME + " = ?", new String[]{name}, null)) {
            if (c != null && c.moveToFirst()) return c.getLong(0);
        }
        throw new Exception("Deck '" + name + "' not found. Create it in AnkiDroid first.");
    }
    
    private static long findModelId(Context ctx, String name) throws Exception {
        try (Cursor c = ctx.getContentResolver().query(MODELS_URI, new String[]{MODEL_ID}, MODEL_NAME + " = ?", new String[]{name}, null)) {
            if (c != null && c.moveToFirst()) return c.getLong(0);
        }
        throw new Exception("Model '" + name + "' not found.");
    }
    
    private static String[] getModelFields(Context ctx, long id) throws Exception {
        try (Cursor c = ctx.getContentResolver().query(MODELS_URI, new String[]{MODEL_FIELD_NAMES}, MODEL_ID + " = ?", new String[]{String.valueOf(id)}, null)) {
            if (c != null && c.moveToFirst()) return splitFields(c.getString(0));
        }
        throw new Exception("Model fields not found");
    }

    private static String joinFields(String[] arr) { return String.join(FIELD_SEPARATOR, arr); }
    private static String[] splitFields(String str) { return str.split(FIELD_SEPARATOR, -1); }
    private static String joinTags(Set<String> tags) { return String.join(" ", tags); }
    
    private static String success(Object result) {
        try { return new JSONObject().put("result", result == null ? JSONObject.NULL : result).put("error", JSONObject.NULL).toString(); } 
        catch (Exception e) { return "{}"; }
    }
    private static String error(String msg) {
        try { return new JSONObject().put("result", JSONObject.NULL).put("error", msg).toString(); } 
        catch (Exception e) { return "{}"; }
    }
    
    public static class MediaFileProvider extends android.content.ContentProvider {
        private static final android.content.UriMatcher MATCHER = new android.content.UriMatcher(android.content.UriMatcher.NO_MATCH);
        @Override public boolean onCreate() {
            MATCHER.addURI("com.mangatan.app.fileprovider", "cache/*", 1);
            return true;
        }
        @Override public android.os.ParcelFileDescriptor openFile(Uri uri, String mode) throws java.io.FileNotFoundException {
            if (MATCHER.match(uri) == 1) {
                File file = new File(getContext().getCacheDir(), uri.getLastPathSegment());
                if (file.exists()) return android.os.ParcelFileDescriptor.open(file, android.os.ParcelFileDescriptor.MODE_READ_ONLY);
            }
            throw new java.io.FileNotFoundException(uri.toString());
        }
        @Override public String getType(Uri uri) { return "application/octet-stream"; }
        @Override public Cursor query(Uri u, String[] p, String s, String[] a, String o) { return null; }
        @Override public Uri insert(Uri u, ContentValues v) { return null; }
        @Override public int delete(Uri u, String s, String[] a) { return 0; }
        @Override public int update(Uri u, ContentValues v, String s, String[] a) { return 0; }
    }
}