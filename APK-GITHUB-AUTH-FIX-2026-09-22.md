# APK GitHub Authentication Fix — September 22, 2026

- The APK no longer starts with Firebase/Google authentication.
- The login screen immediately shows **Connect GitHub**.
- GitHub OAuth is handled by the existing server-side `/auth/github` flow.
- This removes the Firebase `sessionStorage` redirect dependency that can produce **"Unable to process request due to missing initial state"** inside an Android WebView.
- The Android WebView explicitly accepts cookies, including the GitHub OAuth round trip, so the server session can survive the redirect.
- `/auth/me` now has a short 7-second client timeout so a cold/offline API cannot leave the initial loading screen indefinitely; the app can reach the login screen instead.
- Google Drive remains available as an optional integration and is not used for account sign-in.
