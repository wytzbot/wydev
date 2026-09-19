# WyteLab

> **A mobile-first GitHub workspace for developers who build from their phone.**

WyteLab brings GitHub repository management, code editing, project changes, AI-powered diagnosis, and GitHub Actions into a phone-friendly workspace.

🌐 **Website:** https://wyte.name.ng

---

## Why WyteLab?

GitHub is powerful, but working with repositories from a phone can be awkward.

WyteLab is designed around that problem: a developer should be able to inspect a repository, edit code, upload project folders, commit changes, investigate build failures, and manage GitHub Actions without needing a desktop browser.

**GitHub remains the source of truth.** WyteLab works through GitHub's APIs rather than turning the app into a separate Git hosting service.

---

## What you can do

### 🗂️ Manage GitHub repositories
- View your repositories and branches
- Browse repository trees and files
- Open and edit supported source files
- Search through your workspace
- Create and manage project changes
- Upload folders as a consolidated operation
- Rename folders with local preview/reference scanning
- Push changes as an atomic Git commit
- Check the remote branch SHA before pushing to reduce accidental overwrites

### ✍️ Mobile code workspace
WyteLab uses CodeMirror-based editing for a focused mobile coding experience.

Supported editor languages in this build include:
- JavaScript
- JSON
- Markdown
- Python

Local working state can be retained on the device so developers can continue working without treating Firestore as a Git repository.

### 🤖 AI diagnostics
WyteLab can send build/error context to its server-side AI diagnosis endpoint and return structured troubleshooting information.

The diagnosis system includes:
- Structured JSON validation
- Cheap-model-first fallback
- Daily usage limits
- Server-side API-key handling
- A development fallback when persistent usage storage is not configured

> **Important:** AI output is assistance, not a guarantee that a proposed fix is correct. Review changes before pushing them.

### ⚙️ GitHub Actions
The mobile Actions workspace provides:
- Recent workflow runs
- Workflow/job inspection
- Manual workflow dispatch
- Workflow cancellation
- Failed-job reruns for Pro
- Debug-enabled failed-job reruns for Pro

Operations are performed using the signed-in developer's GitHub permissions through the WyteLab server.

### 💳 Pro billing
WyteLab includes a Flutterwave v4 billing flow.

Current product configuration:
- **Free:** up to 10 repositories
- **Free:** 3 AI diagnoses per UTC day
- **Pro:** $7 USD / ₦7,500 NGN per month
- **Pro:** 5 AI diagnoses per day
- Pro workspace features include pull requests, commit revert, extended local undo history, and failed-job reruns

Payment verification is performed server-side before Pro access is granted.

### 🔔 Notifications
Optional Firebase Cloud Messaging support can provide:
- Failed-build alerts
- Good Morning notifications
- Free-limit reminders
- Pro renewal reminders at 10 and 5 days before renewal

Push notifications are optional and require the relevant Firebase configuration.

---

## Architecture

```text
┌───────────────────────────────┐
│        WyteLab Web/PWA        │
│      React + Vite + CSS       │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│      Vercel Server Gateway    │
│          /api/index.js        │
├───────────────────────────────┤
│ GitHub OAuth / GitHub API     │
│ AI diagnosis                  │
│ Flutterwave v4 billing        │
│ Firebase Admin                │
│ Notification delivery         │
└───────┬─────────┬─────────────┘
        │         │
        ▼         ▼
     GitHub    Firebase
        │
        ▼
  Repositories,
  files, commits,
  Actions/workflows
```

### Important data boundary

WyteLab does **not** use Firestore as Git hosting.

The current build uses Firebase/Firestore for durable application metadata such as:
- Pro entitlements
- Payment transaction metadata
- Daily AI usage

Repository source remains on GitHub, while local project state can remain on the user's device.

---

# Run locally

## Requirements

- Node.js
- npm
- A GitHub OAuth application
- A Gemini API key for AI diagnostics
- Firebase Admin credentials for durable production state
- Flutterwave v4 credentials if billing is enabled

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production build

```bash
npm run build
```

## Build check

```bash
npm run check
```

---

# Environment variables

Copy `.env.example` into your deployment configuration and provide the required server values.

### GitHub

```text
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=
SESSION_SECRET=
```

The GitHub OAuth callback should point to:

```text
https://YOUR-DOMAIN/api/auth/github/callback
```

The application requests `read:user repo` because repository editing requires the appropriate GitHub repository permissions.

### AI

```text
GEMINI_API_KEY=
GEMINI_MODEL=
AI_FREE_DAILY_LIMIT=
AI_PRO_DAILY_LIMIT=
```

Never expose the Gemini API key in a `VITE_*` client variable.

### Flutterwave v4

```text
FLW_CLIENT_ID=
FLW_CLIENT_SECRET=
FLW_WEBHOOK_SECRET_HASH=
FLW_ENV=
FLW_PRO_USD=
FLW_PRO_NGN=
FLW_ENCRYPTION_KEY=
```

Webhook endpoint:

```text
https://wyte.name.ng/api/billing/webhook
```

Use the Flutterwave sandbox while integrating and testing.

### Firebase Admin

```text
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Firebase Admin credentials are server-only.

**Never put these values in `VITE_*` variables or commit them to Git.**

---

# Security model

WyteLab is designed so sensitive server credentials stay behind the server gateway.

The production architecture includes:

- HttpOnly encrypted session cookies for the web session
- GitHub OAuth instead of storing a user's GitHub password
- Server-side GitHub API operations
- Server-side AI API-key handling
- Server-side Flutterwave transaction verification
- Signed Flutterwave webhook verification
- Firebase Admin access restricted to the server
- No raw card storage by WyteLab

### Card payments

The browser encrypts card information using the configured Flutterwave encryption flow before the data reaches the WyteLab backend.

WyteLab should **never** collect card details using browser `prompt()`, local storage, or another improvised card form.

For 3DS/VBV flows, the frontend can handle the returned authorization redirect. A redirect by itself does not activate Pro: the backend verifies the successful transaction first.

---

# Persistent production state

For development, the application contains an in-memory fallback.

For production, use Firestore so state survives Vercel instance changes.

The current application uses records such as:

```text
wydev_entitlements/{githubUserId}
wydev_transactions/{reference}
wydev_ai_usage/{githubUserId_YYYY-MM-DD}
```

Recommended Firestore access pattern:

```text
Browser
   │
   ▼
WyteLab API
   │
   ▼
Firebase Admin SDK
   │
   ▼
Firestore
```

Do not expose Admin SDK credentials to the browser.

---

# GitHub Actions permissions

The Actions area operates through the authenticated developer's GitHub permissions.

Depending on the operation and repository configuration, GitHub may require the account to have appropriate workflow/repository permissions.

If an operation fails, inspect the returned status/message rather than assuming the workflow itself is broken.

---

# Flutterwave v4 notes

The billing integration is built around Flutterwave's v4 authentication/API model rather than the older v3 secret-key checkout pattern.

The backend uses:

- OAuth 2.0 bearer access
- Trace IDs
- Idempotency keys
- Webhook verification
- Server-side transaction re-checking
- Amount/currency/status verification

A Flutterwave `403`/`10403 FORBIDDEN` response is surfaced with useful diagnostic information such as the environment, endpoint context, and trace ID without exposing credentials.

---

# Notifications

Firebase Web/FCM public configuration may be included in the frontend because Firebase client configuration is not a server secret.

The following must remain server-side:

```text
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
FIREBASE_PROJECT_ID
```

Notification delivery depends on correct Firebase/FCM configuration and browser/device permission.

---

# Mobile / PWA

WyteLab is built as a mobile-first web application and includes:

- Responsive mobile UI
- PWA manifest
- Mobile viewport configuration
- App icons
- Dark mobile-oriented interface
- Offline awareness
- Local state persistence
- Foreground refresh/repaint handling for mobile/PWA usage

The repository also contains an Android WebView shell under:

```text
.wydev/android-shell/
```

If distributing an Android build, test the generated APK on physical devices before release. WebView, Android lifecycle, notification permissions, OAuth redirects, file selection, and payment redirects should all be tested independently from desktop-browser testing.

---

# Project structure

```text
.
├── api/
│   └── index.js              # Vercel server gateway
├── public/
│   ├── legal/                # Legal pages
│   ├── robots.txt
│   ├── sitemap.xml
│   └── manifest.webmanifest
├── src/
│   ├── components/           # Reusable UI components
│   ├── pages/                # Application screens
│   ├── firebase-config.js    # Public Firebase client configuration
│   ├── github.js             # GitHub client operations
│   ├── notifications.js      # FCM/browser notification support
│   ├── storage.js            # Local persistence
│   └── ...
├── .wydev/
│   └── android-shell/        # Android WebView shell
├── package.json
└── vite.config.js
```

---

# Production checklist

Before deploying:

- [ ] Configure GitHub OAuth callback
- [ ] Configure all server environment variables
- [ ] Use a strong random `SESSION_SECRET`
- [ ] Configure Firebase Admin credentials
- [ ] Deploy Firestore persistence for production
- [ ] Configure Flutterwave v4 sandbox first
- [ ] Configure the Flutterwave webhook
- [ ] Configure `FLW_ENCRYPTION_KEY`
- [ ] Verify successful-payment entitlement activation
- [ ] Test failed and cancelled payments
- [ ] Test 3DS/VBV redirects if enabled
- [ ] Test GitHub login/logout
- [ ] Test private repository access
- [ ] Test repository creation
- [ ] Test file editing and commit/push
- [ ] Test folder upload
- [ ] Test stale-branch protection
- [ ] Test AI quota limits
- [ ] Test GitHub Actions dispatch/cancel/rerun
- [ ] Test notifications on supported devices
- [ ] Test offline/online recovery
- [ ] Test the Android shell on a physical device
- [ ] Run `npm run build`
- [ ] Run `npm run check`

---

# Troubleshooting

### Repositories appear empty

Check:

1. GitHub authentication/session status
2. Network connectivity
3. GitHub API response
4. Repository permissions

WyteLab keeps a local repository snapshot so a temporary refresh failure does not automatically erase the last known list.

### Push fails

Check whether the remote branch changed after the local workspace was loaded.

WyteLab checks the remote branch SHA before pushing and can return a conflict instead of silently overwriting newer remote work.

### AI diagnosis fails

Check:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- daily usage limit
- server logs
- AI provider availability

### Flutterwave returns `403`

Check:

- v4 API credentials
- sandbox/live environment
- OAuth access
- merchant/API permissions
- encryption-key configuration
- returned trace ID

Do not put secret credentials into frontend environment variables.

---

# Contributing

Issues, bug reports, feature suggestions, and pull requests are welcome.

When reporting a problem, include:

- device/browser
- operating system
- whether the problem happens online or offline
- the affected WyteLab feature
- the visible error message
- relevant server-side trace/request ID when available

**Never include API keys, private keys, card numbers, CVV, OAuth secrets, or Firebase Admin credentials in an issue.**

---

# License and legal

Review the legal pages included in `public/legal/` before deploying or redistributing this project.

If you are using this repository as a commercial product, verify that all third-party dependencies, APIs, icons, fonts, and SDKs are compatible with your intended distribution model.

---

## Built for developers who build from anywhere

**WyteLab** is an attempt to make serious GitHub work more practical on a phone.

🌐 **https://wyte.name.ng**
