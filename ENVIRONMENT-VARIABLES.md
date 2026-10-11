# WyteLab environment variables

Use `.env.example` as a template. On Vercel, add the server variables under **Project → Settings → Environment Variables**. Use Preview/Sandbox values for test deployments and Production/Live values only when ready to accept real payments. Never commit a populated `.env` file or expose server secrets through `VITE_*` variables.

## Required for the deployed app

| Variable | Required? | Purpose / value |
|---|---|---|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID. |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app secret; server-only. |
| `GITHUB_REDIRECT_URI` | Recommended | `https://wyte.name.ng/api/auth/github/callback`; must match the GitHub OAuth app callback. |
| `SESSION_SECRET` | Yes | Long, random secret used to encrypt/sign the server session cookie. Keep stable between deploys. |
| `VITE_API_BASE_URL` | No | Browser-visible API base path; leave blank to use `/api`. |

## AI diagnosis (Gemini)

| Variable | Required? | Purpose / default |
|---|---|---|
| `GEMINI_API_KEY` | For AI diagnosis | Gemini API key; server-only. |
| `GEMINI_MODEL` | No | Primary model; default `gemini-2.5-flash`. |
| `GEMINI_FALLBACK_MODELS` | No | Comma-separated fallback model IDs; default example uses `gemini-2.5-flash-lite`. |

## Firebase persistence, Google sign-in and notifications

Set **either** `FIREBASE_SERVICE_ACCOUNT_JSON` **or all three** of `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.

| Variable | Required? | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | One of the credential options | Full Firebase service-account JSON, stored as a server secret. |
| `FIREBASE_PROJECT_ID` | Alternative option | Firebase project ID. |
| `FIREBASE_CLIENT_EMAIL` | Alternative option | Service-account email. |
| `FIREBASE_PRIVATE_KEY` | Alternative option | Service-account private key; preserve line breaks or use escaped `\n` sequences. Server-only. |

The Firebase **Web SDK** configuration for FCM is currently in `src/firebase-config.js`, not environment variables. Those client config values are public identifiers; never put Admin credentials or service-account private keys in frontend files.

## Flutterwave v4 Pro billing

Configure these before enabling live checkout. The v4 API values below are distinct from the legacy v3 secret used only by the optional Kivora campaign webhook.

| Variable | Required? | Purpose / default |
|---|---|---|
| `FLW_ENV` | Recommended | `live` for production or `sandbox` for testing; current default is `live`. |
| `FLW_BASE_URL` | No | Optional API base override. Otherwise it follows `FLW_ENV`. |
| `FLW_CLIENT_ID` | Yes for billing | Flutterwave v4 OAuth client ID; server-only. |
| `FLW_CLIENT_SECRET` | Yes for billing | Flutterwave v4 OAuth client secret; server-only. |
| `FLW_WEBHOOK_SECRET_HASH` | Yes for webhook verification | Shared secret used to verify the `flutterwave-signature` header. |
| `FLW_ENCRYPTION_KEY` | Yes for the card/payment flow if required by the configured Flutterwave operation | Encryption key passed to the Flutterwave v4 integration; keep server-only. |
| `FLW_PRO_USD_MONTHLY` | No | USD monthly display/plan price; default `7.99`. |
| `FLW_PRO_USD_ANNUAL` | No | USD annual display/plan price; default `79.9`. |
| `FLW_PRO_NGN_MONTHLY` | No | NGN monthly charge amount; default `7500`. Set the commercial price you intend to charge. |
| `FLW_PRO_NGN_ANNUAL` | No | NGN annual charge amount; default `79900`. Set the commercial price you intend to charge. |
| `FLW_PRO_NGN` | No; legacy fallback | Old single NGN amount used only when a specific monthly/annual amount is missing. Prefer the two explicit NGN variables. |
| `FLW_SCENARIO_KEY` | Sandbox only | Optional Flutterwave v4 scenario-simulation header. Leave blank in production. |
| `CRON_SECRET` | Yes if running renewal cron | Long random token used as `Authorization: Bearer <CRON_SECRET>` for the protected billing renewal endpoint. |

Webhook URL: `https://wyte.name.ng/api/billing/webhook`. The protected renewal route is `/api/billing/renew`; schedule it with the `CRON_SECRET` bearer token.

## Optional Google Drive connection

| Variable | Required? | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Only if enabling Google Drive | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Only if enabling Google Drive | Google OAuth client secret; server-only. |
| `GOOGLE_REDIRECT_URI` | Recommended when enabled | `https://wyte.name.ng/api/auth/google/callback`; must match the Google OAuth client. |

## Optional Kivora campaign support on the shared webhook

Only set these if the same deployment is expected to process `KIVORA-*` campaign payment events.

| Variable | Required? | Purpose |
|---|---|---|
| `KIVORA_FIREBASE_SERVICE_ACCOUNT_JSON` | Yes for Kivora | Firebase service-account JSON for the Kivora campaigns database. |
| `FLW_SECRET_KEY` or `FLUTTERWAVE_SECRET_KEY` | One if Kivora is enabled | Legacy Flutterwave v3 secret used to verify Kivora transactions. Do not confuse it with `FLW_CLIENT_SECRET` for v4. |

## GitHub Actions secrets for signed Android releases

Add these under **GitHub repository → Settings → Secrets and variables → Actions → Repository secrets**. They are not Vercel environment variables and are only required for `release` APK/AAB builds (debug builds do not need signing secrets).

| Secret | Purpose |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded Android upload keystore. Keep the same keystore for future updates. |
| `ANDROID_KEY_ALIAS` | Alias of the signing key. |
| `ANDROID_KEY_PASSWORD` | Signing-key password. |
| `ANDROID_STORE_PASSWORD` | Keystore password. |

## Notes

- `FREE_REPO_LIMIT` is **not used** by the current source. The app enforces its five-repository free limit in the server code, so do not rely on that obsolete variable.
- `KIVORA_FIREBASE_SERVICE_ACCOUNT_JSON`, `FLW_SECRET_KEY`, and `FLUTTERWAVE_SECRET_KEY` are only for the optional Kivora payment path.
- Do not paste real secrets into chats, documentation committed to Git, frontend code, or build logs.
