package ng.name.wyte.app;

import android.net.Uri;
import android.os.Bundle;
import androidx.annotation.Nullable;

/**
 * Thin launcher for the hosted WyteLab PWA. All application logic remains on
 * https://wyte.name.ng; Chrome supplies the web runtime, storage, OAuth, file
 * picker, downloads, sharing and other browser capabilities.
 */
public class WyteLabLauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final Uri START_URL = Uri.parse("https://wyte.name.ng/");

    @Override
    protected Uri getLaunchingUrl() {
        // Preserve an explicit web URL passed to the launcher when it belongs
        // to the WyteLab origin; otherwise always start at the app root.
        Uri supplied = super.getLaunchingUrl();
        if (supplied != null && "https".equalsIgnoreCase(supplied.getScheme())
                && "wyte.name.ng".equalsIgnoreCase(supplied.getHost())) {
            return supplied;
        }
        if (supplied != null && "wytelab".equalsIgnoreCase(supplied.getScheme())) {
            return START_URL.buildUpon()
                    .appendQueryParameter("wytelab_deep_link", supplied.toString())
                    .build();
        }
        return START_URL;
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        return true;
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
