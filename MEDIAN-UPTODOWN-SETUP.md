# WyteLab — Median / Uptodown build setup

This release keeps the existing Vite/React web app. Account sign-in uses the **Firebase Web SDK Google redirect flow**, then the user connects GitHub separately for repository access. The web app remains compatible with Google Workspace Marketplace. No Google email is treated as a GitHub credential.

## Sign-in flow

Google is the WyteLab account sign-in:

`Sign in with Google → Firebase Google OAuth redirect → wyte.name.ng/__/auth/handler → Firebase redirect result → /api/auth/firebase → encrypted WyteLab session`

GitHub is a separate repository connection:

`Google account → Connect GitHub → GitHub OAuth → /api/auth/github/callback → repository access`

The Google email address is never treated as a GitHub credential. The GitHub connect button uses `/api/auth/github/connect`, so it links GitHub to the already authenticated Google account instead of replacing that account session.

## Required Firebase configuration

In Firebase Console for project `wydev0`:

1. Open **Authentication → Sign-in method**.
2. Enable **Google**.
3. Under **Authentication → Settings → Authorized domains**, add the production WyteLab domain (`wyte.name.ng`) and any real preview/staging domain used for testing.
4. In Google Cloud Console, ensure `https://wyte.name.ng/__/auth/handler` is an authorized redirect URI for the Firebase/Google OAuth client used by this Firebase project.
5. Confirm the Google provider is using the intended Google Cloud project.

The public Firebase Web SDK configuration is in `src/firebase-config.js`. Those values are safe for client-side Firebase use. Firebase Admin credentials, when used by the server, remain server-side.

## Median / APK

The APK loads the same web application. Google sign-in must complete in a browser context supported by Google; do not force `accounts.google.com` or Firebase OAuth helper pages into Median's internal WebView if Median's link handling opens them in an embedded view.

For the Median APK, enable **Full Screen** in App Studio → Interface. Median documents `median.android.screen.fullScreen()` as the runtime Android command. Also make the initial WyteLab URL **Internal**, not App Browser. The App Browser has its own native URL toolbar, which web CSS/JavaScript cannot hide.

The existing Median integrations for Firebase Cloud Messaging, sharing and other app features are independent of Google authentication.

## Google Drive

Google Drive is a separate optional integration and still uses the server-side Google OAuth client configured with:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN/api/auth/google/callback`

Do not use Google Drive OAuth credentials as a substitute for GitHub account sign-in.


## Important: remove the Chrome/App Browser toolbar

If the APK opens with an `X`, domain/address text, share icon and three-dot menu at the top, that is Median's **App Browser/Custom Tab**, not Android fullscreen. Web code cannot hide that native toolbar. Median documents App Browser as a separate native browser window.

In Median App Studio:

1. Set the **Initial URL** / website launch behavior to load `https://wyte.name.ng/` **Internal** in the main WebView.
2. Do not configure the WyteLab domain as **App Browser**.
3. Under **Interface**, enable **Full Screen**.
4. If a native Top Navigation Bar is enabled and you want absolutely no native header, disable that bar as well.
5. For Google OAuth, follow Median's link-handling rules so the Google/Firebase authentication journey is not forced into the wrong embedded view.

The app source now calls Median's documented `median.android.screen.fullScreen()` bridge when it is available, but that bridge controls Android system bars; it cannot remove a Median App Browser toolbar. Median's own documentation distinguishes the WebView from its native UI and says native UI is controlled in App Studio.
