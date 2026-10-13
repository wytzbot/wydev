# Preview and error handling hardening

## Server-controlled preview allowance
- `GET /api/preview/usage?repo=owner/name` returns the authoritative allowance for the signed-in account and repository.
- `POST /api/preview/usage` consumes one preview atomically in Firestore. Free accounts are limited to two previews per repository; Pro accounts are unlimited. Browser storage is not used as the source of truth.
- The server fails closed with `PREVIEW_STORAGE_UNAVAILABLE` if Firebase Admin/Firestore is not configured; it does not silently fall back to per-instance memory.
- Firestore collection: `wydev_preview_usage`; records contain only account ID, repository name, count, and update time, never ZIP contents.

## Preview support
- Static HTML/CSS/JS and prebuilt static site output are supported when assets can be resolved locally and the app does not require a server process.
- React/Vite, Vue, Svelte, Angular, and Next.js static exports should be built before upload. Upload the generated static output (commonly `dist/`, `build/`, `out/`, or `browser/`).
- Unbuilt JSX/TSX/module source, relative dynamic chunk imports that cannot be resolved safely, SSR routes, backend processes, dependency installation, and server-only environment variables are not executed. The UI gives a clear explanation rather than displaying a broken preview as successful.
- ZIP source files are not sent to a preview server. Only allowance metadata is stored server-side.

## Deployment requirements
- Configure Firebase Admin credentials already used by WyteLab (`FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
- Deploy the frontend and `/api` function together. Test GET/POST preview usage against Firestore, including simultaneous POST requests at the free limit.
- Test expired WyteLab/WyBuild sessions and revoked GitHub authorization; users should see an actionable sign-in message rather than a misleading password error.
