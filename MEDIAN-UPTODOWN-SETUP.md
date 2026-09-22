# WyteLab — Median / Uptodown build setup

This release keeps the existing Vite/React web app. Account sign-in uses **GitHub OAuth** exactly like the normal web app; no Median Social Login or native Google authentication is required.

## GitHub Sign-In

WyteLab uses its server-side GitHub OAuth flow:

`Connect GitHub → GitHub OAuth → WyteLab callback → encrypted WyteLab session`

GitHub remains a separate authorization step:

`Google account → Connect GitHub → GitHub OAuth → repository access`

The Google email address is never treated as a GitHub credential.

## Required Firebase configuration

In Firebase Console for project `wydev0`:

1. Open **Authentication → Sign-in method**.
2. Enable **Google**.
3. Under **Authentication → Settings → Authorized domains**, add the production WyteLab domain (`wyte.name.ng`) and any real preview/staging domain used for testing.
4. Confirm the Google provider is using the intended Google Cloud project.

The public Firebase Web SDK configuration is in `src/firebase-config.js`. Those values are safe for client-side Firebase use. Firebase Admin credentials, when used by the server, remain server-side.

## Median / APK

No Median Google Social Login plugin is required. The APK loads the same web application and GitHub OAuth flow. Keep the production WyteLab domain and GitHub OAuth callback available to the WebView.

The existing Median integrations for Firebase Cloud Messaging, sharing and other app features are independent of Google authentication.

## Google Drive

Google Drive is a separate optional integration and still uses the server-side Google OAuth client configured with:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN/api/auth/google/callback`

Do not use Google Drive OAuth credentials as a substitute for GitHub account sign-in.
