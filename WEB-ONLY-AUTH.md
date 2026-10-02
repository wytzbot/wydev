# WyteLab web authentication

## Google™ account sign-in

The web app uses Firebase Authentication's Google provider. The frontend starts `signInWithRedirect()` and receives the result through `getRedirectResult()`. It then sends the Firebase ID token to `/api/auth/firebase` for server-side verification with Firebase Admin.

Firebase, not the WyteLab API, owns the Google™ sign-in redirect handler. For the `wydev0` Firebase project the handler follows:

`https://wydev0.firebaseapp.com/__/auth/handler`

## Google Drive™

The optional Google Drive™ export is a separate direct OAuth flow. It uses `/api/auth/google` and `/api/auth/google/callback` with the production callback:

`https://wyte.name.ng/api/auth/google/callback`

The two flows intentionally use different callbacks and different credentials.
