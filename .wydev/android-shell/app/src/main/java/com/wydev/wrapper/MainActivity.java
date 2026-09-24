package com.wydev.wrapper;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import android.util.Base64;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends AppCompatActivity {
    private static final int FILE_PICKER = 4101;
    private static final int NOTIFICATION_PERMISSION = 4102;
    private static final int STORAGE_PERMISSION = 4103;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private boolean fullscreen = true;

    private static final boolean F_CAMERA_MIC = __FEATURE_CAMERA_MIC__;
    private static final boolean F_LOCATION = __FEATURE_LOCATION__;
    private static final boolean F_DOWNLOADS = __FEATURE_DOWNLOADS__;
    private static final boolean F_EXTERNAL_LINKS = __FEATURE_EXTERNAL_LINKS__;
    private static final boolean F_FULLSCREEN = __FEATURE_FULLSCREEN__;
    private static final boolean F_SHARE = __FEATURE_SHARE__;
    private static final boolean F_VIBRATION = __FEATURE_VIBRATION__;
    private static final boolean F_ORIENTATION = __FEATURE_ORIENTATION__;
    private static final boolean F_BATTERY = __FEATURE_BATTERY__;
    private static final boolean F_NETWORK_STATUS = __FEATURE_NETWORK_STATUS__;
    private static final boolean F_DEVICE_INFO = __FEATURE_DEVICE_INFO__;
    private static final boolean F_LOCAL_NOTIFICATIONS = __FEATURE_LOCAL_NOTIFICATIONS__;
    private static final boolean F_BIOMETRIC = __FEATURE_BIOMETRIC__;
    private static final boolean F_SECURE_STORAGE = __FEATURE_SECURE_STORAGE__;
    private static final boolean F_SCREEN_CAPTURE = __FEATURE_SCREEN_CAPTURE__;
    private static final boolean F_PICTURE_IN_PICTURE = __FEATURE_PICTURE_IN_PICTURE__;
    private static final boolean F_DEEP_LINKS = __FEATURE_DEEP_LINKS__;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        webView = new WebView(this);
        setContentView(webView);
        configureWebView();
        applyFullscreen();
        webView.loadUrl("https://wyte.name.ng/");
        handleIntent(getIntent());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack(); else finish();
            }
        });
    }

    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " WyteLabAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.addJavascriptInterface(new NativeBridge(this), "WyBuild");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent i = params.createIntent();
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(i, FILE_PICKER);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (!F_DOWNLOADS) return;
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                req.setMimeType(mimeType);
                req.addRequestHeader("User-Agent", userAgent);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, guessFilename(contentDisposition, url));
                ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
                Toast.makeText(this, "Download started", Toast.LENGTH_SHORT).show();
            } catch (Exception e) { Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show(); }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return routeUrl(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return routeUrl(url); }
            @Override public void onPageFinished(WebView view, String url) { super.onPageFinished(view, url); applyFullscreen(); injectInsets(); }
        });
        webView.setOnApplyWindowInsetsListener((v, insets) -> { injectInsets(); return insets; });
    }

    private boolean routeUrl(String url) {
        if (url == null) return false;
        if (url.startsWith("file:///android_asset/") || url.startsWith("https://wyte.name.ng") || url.startsWith("http://localhost")) return false;
        if (!F_EXTERNAL_LINKS) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); return true; } catch (Exception e) { return false; }
    }

    private void applyFullscreen() {
        if (!F_FULLSCREEN) return;
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    private void injectInsets() {
        if (webView == null) return;
        webView.postDelayed(() -> webView.evaluateJavascript("(function(){document.documentElement.style.setProperty('--native-safe-top','0px');document.documentElement.style.setProperty('--native-safe-bottom','0px');})();", null), 30);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data != null) webView.postDelayed(() -> webView.evaluateJavascript("window.__WyteLabDeepLink=" + quoteJs(data.toString()) + ";window.dispatchEvent(new CustomEvent('wytelab:deep-link',{detail:" + quoteJs(data.toString()) + "}));", null), 500);
        if (Intent.ACTION_SEND.equals(intent.getAction()) && intent.getStringExtra(Intent.EXTRA_TEXT) != null) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            webView.postDelayed(() -> webView.evaluateJavascript("window.__WyteLabShared=" + quoteJs(text) + ";window.dispatchEvent(new CustomEvent('wytelab:shared',{detail:" + quoteJs(text) + "}));", null), 500);
        }
    }

    private static String quoteJs(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }

    private String guessFilename(String cd, String url) {
        if (cd != null && cd.contains("filename=")) {
            String x = cd.substring(cd.indexOf("filename=") + 9).replace("\"", "").trim();
            if (!x.isEmpty()) return x;
        }
        try { String p = Uri.parse(url).getLastPathSegment(); if (p != null && !p.isEmpty()) return p; } catch (Exception ignored) {}
        return "wytelab-download";
    }

    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleIntent(intent); }

    @Override protected void onResume() { super.onResume(); if (webView != null) { webView.onResume(); webView.resumeTimers(); } applyFullscreen(); }
    @Override protected void onPause() { if (webView != null) webView.onPause(); super.onPause(); }
    @Override protected void onDestroy() { if (webView != null) { webView.stopLoading(); webView.destroy(); } super.onDestroy(); }

    public class NativeBridge {
        private final Context ctx;
        NativeBridge(Context c) { ctx = c; }
        @JavascriptInterface public boolean hasFeature(String name) {
            String n = String.valueOf(name).toUpperCase();
            switch (n) {
                case "CAMERA_MIC": return F_CAMERA_MIC; case "LOCATION": return F_LOCATION; case "DOWNLOADS": return F_DOWNLOADS;
                case "EXTERNAL_LINKS": return F_EXTERNAL_LINKS; case "FULLSCREEN": return F_FULLSCREEN; case "SHARE": return F_SHARE;
                case "VIBRATION": return F_VIBRATION; case "ORIENTATION": return F_ORIENTATION; case "BATTERY": return F_BATTERY;
                case "NETWORK_STATUS": return F_NETWORK_STATUS; case "DEVICE_INFO": return F_DEVICE_INFO; case "LOCAL_NOTIFICATIONS": return F_LOCAL_NOTIFICATIONS;
                case "BIOMETRIC": return F_BIOMETRIC; case "SECURE_STORAGE": return F_SECURE_STORAGE; case "SCREEN_CAPTURE": return F_SCREEN_CAPTURE;
                case "PICTURE_IN_PICTURE": return F_PICTURE_IN_PICTURE; case "DEEP_LINKS": return F_DEEP_LINKS; default: return false;
            }
        }
        @JavascriptInterface public String getFeatures() {
            String[] names={"DOWNLOADS","SHARE","VIBRATION","NETWORK_STATUS","DEVICE_INFO","LOCAL_NOTIFICATIONS","SECURE_STORAGE","DEEP_LINKS"};
            StringBuilder b=new StringBuilder("["); boolean first=true;
            for(String n:names) if(hasFeature(n)){if(!first)b.append(',');b.append('"').append(n).append('"');first=false;} return b.append(']').toString();
        }
        @JavascriptInterface public void vibrate(int ms) {
            if (!F_VIBRATION) return;
            try { Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE); if(Build.VERSION.SDK_INT>=26)v.vibrate(VibrationEffect.createOneShot(Math.max(1,Math.min(ms,500)),VibrationEffect.DEFAULT_AMPLITUDE)); else v.vibrate(ms); } catch(Exception ignored){}
        }
        @JavascriptInterface public boolean share(String text) {
            if (!F_SHARE) return false;
            try { Intent i=new Intent(Intent.ACTION_SEND);i.setType("text/plain");i.putExtra(Intent.EXTRA_TEXT,text);startActivity(Intent.createChooser(i,"Share with"));return true;}catch(Exception e){return false;}
        }
        @JavascriptInterface public boolean openExternal(String url) { try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url))); return true; } catch(Exception e){return false;} }
        @JavascriptInterface public boolean copy(String text) { try { ClipboardManager c=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);c.setPrimaryClip(ClipData.newPlainText("WyteLab",text));Toast.makeText(ctx,"Copied",Toast.LENGTH_SHORT).show();return true;}catch(Exception e){return false;} }
        @JavascriptInterface public boolean downloadBase64(String filename,String mime,String base64) {
            if(!F_DOWNLOADS)return false;
            try {
                byte[] data=Base64.decode(base64, Base64.DEFAULT);
                String safe=filename==null?"download":filename.replaceAll("[^A-Za-z0-9._ -]","_");
                String type=(mime==null||mime.isEmpty())?"application/octet-stream":mime;
                if(Build.VERSION.SDK_INT>=29){
                    android.content.ContentValues v=new android.content.ContentValues();
                    v.put(android.provider.MediaStore.Downloads.DISPLAY_NAME,safe); v.put(android.provider.MediaStore.Downloads.MIME_TYPE,type); v.put(android.provider.MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS); v.put(android.provider.MediaStore.Downloads.IS_PENDING,1);
                    Uri u=getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,v); if(u==null)return false;
                    try(OutputStream out=getContentResolver().openOutputStream(u)){ if(out==null)throw new java.io.IOException("Unable to open Downloads"); out.write(data); }
                    v.clear();v.put(android.provider.MediaStore.Downloads.IS_PENDING,0);getContentResolver().update(u,v,null,null);
                } else {
                    if(ContextCompat.checkSelfPermission(ctx,Manifest.permission.WRITE_EXTERNAL_STORAGE)!=PackageManager.PERMISSION_GRANTED){ActivityCompat.requestPermissions(MainActivity.this,new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},STORAGE_PERMISSION);return false;}
                    java.io.File dir=Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);if(!dir.exists())dir.mkdirs();java.io.File f=new java.io.File(dir,safe);try(OutputStream out=new java.io.FileOutputStream(f)){out.write(data);}Intent scan=new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);scan.setData(Uri.fromFile(f));sendBroadcast(scan);
                }
                Toast.makeText(ctx,"Saved to Downloads",Toast.LENGTH_SHORT).show();return true;
            }catch(Exception e){return false;}
        }
        @JavascriptInterface public String getDeviceInfo() { return "{\"model\":"+quoteJs(Build.MODEL)+",\"manufacturer\":"+quoteJs(Build.MANUFACTURER)+",\"sdk\":"+Build.VERSION.SDK_INT+",\"version\":"+quoteJs(Build.VERSION.RELEASE)+"}"; }
        @JavascriptInterface public boolean isOnline() { try {ConnectivityManager c=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);NetworkCapabilities n=c.getNetworkCapabilities(c.getActiveNetwork());return n!=null&&(n.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)||n.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)||n.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));}catch(Exception e){return false;} }
        @JavascriptInterface public int batteryPercent() { try {android.os.BatteryManager b=(android.os.BatteryManager)getSystemService(BATTERY_SERVICE);return b.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY);}catch(Exception e){return -1;} }
        @JavascriptInterface public void showLocalNotification(String title,String body) {
            if(!F_LOCAL_NOTIFICATIONS)return;
            if(Build.VERSION.SDK_INT>=33 && ContextCompat.checkSelfPermission(ctx,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){ActivityCompat.requestPermissions(MainActivity.this,new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION);return;}
            String channel="wytelab_general";NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(Build.VERSION.SDK_INT>=26)nm.createNotificationChannel(new NotificationChannel(channel,"WyteLab",NotificationManager.IMPORTANCE_DEFAULT));
            NotificationCompat.Builder b=new NotificationCompat.Builder(ctx,channel).setSmallIcon(android.R.drawable.stat_sys_download_done).setContentTitle(title==null?"WyteLab":title).setContentText(body==null?"":body).setAutoCancel(true);nm.notify((int)(System.currentTimeMillis()%100000),b.build());
        }
        @JavascriptInterface public boolean setSecure(String key,String value){
            if(!F_SECURE_STORAGE)return false;
            try{
                KeyStore ks=KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
                SecretKey k;
                if(ks.containsAlias("wytelab_key")) k=((KeyStore.SecretKeyEntry)ks.getEntry("wytelab_key",null)).getSecretKey();
                else { KeyGenerator kg=KeyGenerator.getInstance("AES","AndroidKeyStore"); kg.init(new android.security.keystore.KeyGenParameterSpec.Builder("wytelab_key",android.security.keystore.KeyProperties.PURPOSE_ENCRYPT|android.security.keystore.KeyProperties.PURPOSE_DECRYPT).setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE).build()); k=kg.generateKey(); }
                Cipher c=Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE,k); byte[] enc=c.doFinal(String.valueOf(value).getBytes(StandardCharsets.UTF_8)); byte[] all=new byte[c.getIV().length+enc.length]; System.arraycopy(c.getIV(),0,all,0,c.getIV().length); System.arraycopy(enc,0,all,c.getIV().length,enc.length);
                getSharedPreferences("wytelab_secure",MODE_PRIVATE).edit().putString(key,Base64.encodeToString(all, Base64.NO_WRAP)).apply(); return true;
            }catch(Exception e){return false;}
        }
        @JavascriptInterface public String getSecure(String key){
            if(!F_SECURE_STORAGE)return null;
            try{ String raw=getSharedPreferences("wytelab_secure",MODE_PRIVATE).getString(key,null); if(raw==null)return null; byte[] all=Base64.decode(raw, Base64.DEFAULT); byte[] iv=new byte[12]; byte[] enc=new byte[all.length-12]; System.arraycopy(all,0,iv,0,12); System.arraycopy(all,12,enc,0,enc.length); KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);SecretKey k=((KeyStore.SecretKeyEntry)ks.getEntry("wytelab_key",null)).getSecretKey();Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,k,new GCMParameterSpec(128,iv));return new String(c.doFinal(enc),StandardCharsets.UTF_8);}catch(Exception e){return null;}
        }
        @JavascriptInterface public void pickFiles(boolean multiple) {
            try { Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,multiple);startActivityForResult(i,FILE_PICKER);}catch(Exception e){ }
        }
        @JavascriptInterface public void setFullscreen(boolean enabled){fullscreen=enabled;if(enabled)applyFullscreen();else{WindowInsetsControllerCompat c=WindowCompat.getInsetsController(getWindow(),getWindow().getDecorView());c.show(WindowInsetsCompat.Type.statusBars()|WindowInsetsCompat.Type.navigationBars());}}
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=FILE_PICKER)return;
        if(filePathCallback!=null){Uri[] results=null;if(resultCode==Activity.RESULT_OK&&data!=null){if(data.getClipData()!=null){int n=data.getClipData().getItemCount();results=new Uri[n];for(int i=0;i<n;i++)results[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)results=new Uri[]{data.getData()};}filePathCallback.onReceiveValue(results);filePathCallback=null;}
        if(webView!=null && resultCode==Activity.RESULT_OK && data!=null){
            ArrayList<String> items=new ArrayList<>();
            if(data.getClipData()!=null){for(int i=0;i<data.getClipData().getItemCount();i++)items.add(readUri(data.getClipData().getItemAt(i).getUri()));}
            else if(data.getData()!=null)items.add(readUri(data.getData()));
            StringBuilder js=new StringBuilder("window.__WyteLabFilePickerResult && window.__WyteLabFilePickerResult([");for(int i=0;i<items.size();i++){if(i>0)js.append(',');js.append(items.get(i));}js.append("]); ");webView.evaluateJavascript(js.toString(),null);
        }
    }
    private String readUri(Uri uri){
        try(InputStream in=getContentResolver().openInputStream(uri);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){out.write(buf,0,n);if(out.size()>15*1024*1024)break;}String name=uri.getLastPathSegment();String mime=getContentResolver().getType(uri);return "{\"name\":"+quoteJs(name==null?"file":name)+",\"mime\":"+quoteJs(mime==null?"application/octet-stream":mime)+",\"data\":"+quoteJs(Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))+"}";}catch(Exception e){return "{\"error\":\"Unable to read file\"}";}
    }
}
