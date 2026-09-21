# WyteLab Web Google Sign-In — Popup + Redirect Fallback

Google authentication is web-only.

### Normal path
1. User clicks **Continue with Google**.
2. Firebase Web SDK opens the Google popup.
3. Google authenticates the user.
4. Firebase establishes the browser session.
5. WyteLab exchanges the Firebase ID token for its server session.

### Automatic fallback
If the popup cannot complete because the browser blocks it, does not support the popup environment, cannot use the required web storage, or reports a popup/internal browser failure, WyteLab automatically switches to:

`Firebase signInWithRedirect → Google → return to WyteLab → getRedirectResult → server session`

This prevents users from being trapped on the login screen just because popup authentication is unavailable.

The redirect result is consumed when the Login page loads. The returned Firebase user is then exchanged with the WyteLab server before the app redirects to the dashboard.

No Median/native authentication bridge or native Google SDK is required.
