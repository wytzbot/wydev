# WyteLab audit and fixes — 2026-10-08

## Implemented

- Free plan: 5 repositories/projects visible/creatable.
- Free Actions: 3 failed-workflow reruns per UTC day; Pro: unlimited.
- Pro-only:
  - AI diagnosis
  - 5 AI diagnoses/day
  - repository revert
  - repository deletion
  - pull-request access/actions
- Other existing features remain free.
- Pro pricing:
  - $7.99/month
  - $79.90/year
  - NGN equivalents configurable through `FLW_PRO_NGN_MONTHLY` and `FLW_PRO_NGN_ANNUAL`.
  - Current defaults preserve the existing ₦7,500 monthly value and use ₦79,900 annually; set these env values to the exact commercial NGN prices you want.
- Restored Flutterwave v4 checkout/status/verify/authorize/recover/cancel routes that had been disabled in the server.
- Added recurring monthly/annual entitlement periods.
- Cancellation now stops renewal and grants 3 days of Pro grace access.
- Successful payment shows a modal confirmation and the card-entry UI disappears because the account is Pro.
- Pro screen shows “YOU ARE NOW IN PRO” and a cancel-subscription action; after cancellation it reports the 3-day grace period.
- Fixed a recurring billing webhook bug that referenced the wrong variable for the renewal period.
- Fixed scheduled billing route to actually run renewals instead of reporting billing as disabled.
- AI code path remains intact: Gemini-only provider chain, secret redaction, repository-wide diagnosis, schema validation, and persistent usage accounting.
- AI quota is now reserved before the model call so concurrent requests cannot exceed the daily limit.
- Android export/download:
  - native `DOWNLOADS` feature is enabled by default in the APK/AAB workflow;
  - existing `WyBuild.downloadBase64` bridge is used first;
  - Web Share and browser download remain fallbacks.
- Fixed “delete all files” behavior: the delete picker now uses the complete remote file index, not only files already opened in the editor.
- Added `Build APK & AAB · Partner` to the menu, opening:
  `https://wybuild-black.vercel.app`
- Kept the Android shell and GitHub Actions APK/AAB workflow intact; updated its default native feature set to include Downloads and related native capabilities.
- Added validation checks for the new entitlement, quota, grace-period, partner-link, and Android-download requirements.

## Validation performed

- `node --check api/index.js` — PASS
- `node --check scripts/check-build.mjs` — PASS
- `node --check scripts/release-audit.mjs` — PASS
- TypeScript parser pass over all `src/**/*.js` and `src/**/*.jsx` — PASS
- `node scripts/check-build.mjs` — PASS
- `node scripts/release-audit.mjs` — PASS
- Frontend secret scan — PASS
- TWA packaging consistency checks — PASS

The build-check script correctly skipped its optional esbuild/lucide runtime checks because `npm install` could not complete in this sandbox.

## Important deployment configuration

Set these Vercel environment variables before enabling live billing:

- `FLW_ENV=live`
- `FLW_CLIENT_ID`
- `FLW_CLIENT_SECRET`
- `FLW_WEBHOOK_SECRET_HASH`
- `FLW_ENCRYPTION_KEY`
- `FLW_PRO_USD_MONTHLY=7.99`
- `FLW_PRO_USD_ANNUAL=79.9`
- `FLW_PRO_NGN_MONTHLY=<your exact NGN equivalent>`
- `FLW_PRO_NGN_ANNUAL=<your exact NGN equivalent>`
- `CRON_SECRET`
- Firebase Admin credentials/persistence
- `GEMINI_API_KEY`

Configure Flutterwave's webhook URL as `/api/billing/webhook`, and schedule `/api/billing/renew` with the configured cron secret.

## Build limitation

No APK/AAB binary was fabricated. The sandbox does not have the project's npm dependencies or Android/Gradle SDK toolchain, and the npm install attempt timed out. The repository's GitHub Actions workflow remains the supported release build path and produces both APK and AAB when its signing secrets are configured.

## 2026-10-08 follow-up: Gemini + wytzbot

- Removed the old Gemini 3.x IDs from the active diagnostic allowlist.
- Default AI model is now `gemini-2.5-flash`, with `gemini-2.5-flash-lite` as fallback.
- `GEMINI_MODEL` and `GEMINI_FALLBACK_MODELS` remain configurable through Vercel environment variables.
- Added a server-side lifetime Pro entitlement for the verified GitHub OAuth login `wytzbot`.
- The exception is evaluated from the OAuth session's `githubLogin`; it is not accepted from frontend/local-storage data and does not depend on a Flutterwave payment record.
- `wytzbot` therefore receives the full Pro feature set without a recurring payment while all other accounts continue through the normal entitlement/billing path.
