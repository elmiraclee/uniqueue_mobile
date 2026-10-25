# UniQueue — Student & Parent mobile update

## What is included
Updated Expo / React Native source and matching PHP client API. Student and parent only; no QAM, admin, office dashboard or staff UI changes.

- Shared confirmations, success dialogs and toast notices; consistent password inputs with independent accessible eye controls; safe-area-aware client header and tabs.
- Five password rules, live strength and confirmation-match feedback, with corresponding server-side enforcement.
- Add Child creates Elementary profiles only. Link Existing checks exact first name, last name and SR Code after a debounce, then independently revalidates on submission. Stored school level controls immediate Elementary linking versus student approval for JHS/SHS/College.
- Approve/decline requests, unlink in either direction, preserve both accounts and transaction history, and recipient-owned unlink notices. Unlinked parents lose access; relinking non-Elementary students requires fresh approval.
- Queue service quantities/options and per-copy academic details; same-for-all handling when increasing copies; ticket-specific live details.
- Live monitor office tabs, expandable waiting details, paused status, and sound OFF until explicitly enabled. Operating-system notification sounds are separate.
- Official BatStateU CSM Revision 06 replaces the star-only form. Optional name/contact; Yes/No third-party-sharing consent; CC skip rules; SQD0–7 and exactly one of SQD8a/b; duplicate-ticket prevention.
- Account-scoped guides: 34 student / 37 parent steps, replay/resume via ?, long-press restart, new-signup enrollment, local/server progress, and isolated practice using shared queue/CSM components. Practice cannot create tickets, payments, CSM responses or profile changes.
- Bearer-authenticated API access, native SecureStore session persistence, logout revocation and authorization headers for the Android widget.

Existing account-activation workflow is retained. A new activation UX/checker redesign is NOT part of this update.

## Deployment — back up first
1. Back up the current database, API folder, web application and uploads. Test this release against a staging copy first. The SQL migration is incremental, not a replacement database or a seeder.
2. Use the current UniQueue schema from your web app. In phpMyAdmin, select that database and import `migrations/001-mobile-clients.sql` from the API ZIP. This adds session/guide/notice/CSM support and adjusts the link-request index. It contains no explicit DEFINER or SET USER operation. It does not delete existing users, offices, departments, tickets or feedback rows. Mobile reads/writes CSM rather than the legacy feedback table.
3. Copy `config.example.php` to a private `config.local.php` in `uniqueue_api/`. Enter your own database host, port, name, user and password. These credentials are deliberately absent from the ZIP. Alternatively configure DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD as server environment variables, or UNIQUEUE_DB_CONFIG pointing to a private config outside the web root.
4. Configure the comma-separated Google OAuth client IDs allowed by your deployment in `google_client_ids` or GOOGLE_CLIENT_IDS. These must match the mobile OAuth configuration. Google login fails closed if no allowlist is configured. A Google client ID is not a client secret.
5. Upload the API files including hidden `.htaccess` files, `lib/` and migration directory protection. Preserve your existing PRIVATE SMTP `.env` and actual uploads; neither is included. Password-recovery SMTP uses MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_EMAIL and MAIL_FROM_NAME. Verify PHP mysqli/mysqlnd, PDO MySQL, mbstring, OpenSSL/cURL and required database privileges. Keep error display disabled in production.
6. Do not overwrite the separate web app's `app/` or `public/` folders with the mobile source. This API is client-scoped; staff/maintenance operations through these API routes are denied. Existing external jobs using those legacy API staff endpoints must be reviewed separately, not silently repointed.
7. Coordinate API deployment with the new mobile build: old APKs do not send the new bearer token. Existing installations must sign in again; numeric account IDs stored by an old app are not accepted as authentication. Retain a rollback backup and use a maintenance/staged rollout rather than breaking currently installed clients unexpectedly.
8. Do NOT import any local test database or fixture data. No live database/Hostinger changes were made during this work.

## Build the mobile project
From the extracted `uniqueue_mobile/` root (the canonical project; no nested stale `mobile/` copy):

```sh
npm ci
# Optional: point at your HTTPS API BEFORE building. Default remains the existing production URL.
# EXPO_PUBLIC_API_URL=https://your-domain.example/uniqueue_api
npx tsc --noEmit
npx expo start --dev-client
# With your own configured Expo/EAS account and Android signing credentials:
eas build --platform android --profile preview
```

Use your existing Expo/EAS project, Google/Firebase configuration, app scheme and signing setup. Public Firebase/OAuth project configuration from the uploaded project is retained; no service-account private keys or signing keystores are supplied. SecureStore/audio/native-widget changes require a **fresh native build**; a JavaScript-only OTA update or Expo Go is not sufficient for validating the custom widget. Keep the uploaded Expo57 dependency versions and committed package-lock aligned.

For iOS, configure your own bundle identifier, OAuth client and provisioning/signing as needed; the inherited iOS OAuth placeholder still needs deployment-specific setup.

## Verification completed locally
- TypeScript `tsc --noEmit`: passed.
- PHP syntax checks: passed.
- 44 API integration checks: ownership/forgery denials, stored-level link rules, request approval, post-unlink denial and both notices, CSM exact ticket/No consent/CC skip/invalid SQD8/duplicate rejection, Elementary creation, tutorial persistence and logout revocation.
- 6 supplementary checks: additive migration rerun without ticket-count changes; profile school/grade fields; student/parent guide bounds; unrelated account notices; live-monitor identity forgery.
- Expo web export and Android + iOS Hermes JavaScript bundle exports: passed. These are **not** native APK/IPA compilation or installation tests.
- Complete mocked guide traversal: all 34 student and 37 parent steps passed without browser runtime errors. CSM No-consent selection, CC skipping, exclusive SQD8 selection and disabled practice submission checked at both widths.
- Mocked browser previews at 320×844 and 390×844: signup/password eyes, add/link request and success, unlink confirmation, monitor collapsed/expanded/paused, practice review/CSM and guide navigation. External requests were mocked; no production endpoints were contacted.

## Required staging/device acceptance before rollout
The following must still be verified using your actual staging configuration and a newly built app:
- Android Gradle/Kotlin/widget compilation and installation; widget/background refresh after logout and remote unlink.
- Physical-device keyboard/safe areas, Android back, notification permission/delivery, foreground audio toggle and killed-app notifications. Browser preview does not prove these.
- Real Google OAuth/redirects, actual SMTP OTP delivery/recovery, upload permissions and real HTTPS connectivity.
- Both user roles across the real queue workflow, approval/unlink from two devices, official CSM submission and tutorial resume. Concurrent live queue behavior is not proven by the sequential fixture checks.

No APK/IPA or live deployment is included. The source/API ZIPs are for staging and native build verification first.
