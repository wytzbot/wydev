# WyteLab GitHub Sign-In — Web + APK

GitHub is the account and repository connection for WyteLab.

### Sign-in path
1. User opens WyteLab.
2. WyteLab checks the existing server session with `/api/auth/me`.
3. If no session exists, the login screen immediately offers **Connect GitHub**.
4. GitHub OAuth opens through `/api/auth/github`.
5. GitHub returns to `/api/auth/github/callback`.
6. The server creates the encrypted WyteLab session cookie and redirects to `/`.
7. WyteLab loads the user's repositories through the GitHub API.

### Android APK behavior
The APK uses the same server-side GitHub OAuth flow. It does not depend on Firebase Google redirect state, `sessionStorage`, or a native Google login plugin. WebView cookies are enabled so the OAuth round trip can establish the server session.

The client also has a short `/auth/me` timeout and a 5-second login fallback, preventing a slow or suspended mobile network request from keeping the app on an indefinite **Loading WyteLab…** screen.

Google Drive remains an optional integration and is unrelated to account sign-in.
