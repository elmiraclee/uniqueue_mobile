# UniQueue — mobile visual redesign

## Scope: MOBILE PRESENTATION ONLY

This redesign uses the latest mobile source from this conversation, including the earlier empty-queue compatibility fix. **No PHP/backend/web-server files, database schema, API endpoints, request payloads, authentication/session code or queue rules were changed in this redesign.** No live deployment or signed APK/AAB was produced.

The existing UniQueue identity is retained: maroon accent, real UniQueue logo, familiar student and parent routes. This is a cleaner service-app design, not a copy of another app's branding.

## Visual changes

- Light neutral canvas, crisp white surfaces, restrained borders and much softer elevation.
- Dark readable type with clear title/body/metadata hierarchy. Maroon emphasizes key actions and ticket IDs rather than filling every section.
- Redesigned student greeting, prominent active ticket and two-column queue information.
- Lighter parent overview, clearer child cards, consistent pending-link presentation.
- Compact header utilities and refined bottom navigation. Labels are checked for truncation at 320/390/1440px.
- Search field with a recognizable icon and visible focus; office actions share a balanced action row.
- Selection chips for history/child filters instead of oversized primary-action buttons.
- Ticket-detail metrics, quiet status badges, cleaner unread notifications and alert modals.
- Consistent queue stepper, forms, inputs, buttons and read-only profile fields.
- Restyled sign-in, student/parent signup, activation and recovery screens; existing actions and validations remain in place.
- The Google sign-in mark is now bundled locally instead of depending on a remote image at runtime. Asset source: https://developers.google.com/identity/images/g-logo.png. The original real UniQueue logo is preserved.

## Choose ONE installation option

### A — Complete updated mobile source

Use `uniqueue-mobile-professional-ui.zip` if you want a complete mobile project based on the last patched source. Extract the `uniqueue_mobile` directory to a NEW location first, compare with your local project, then migrate any local changes you made separately.

Dependencies and build configuration are not upgraded by this redesign. `node_modules`, generated exports, caches and old validation output are excluded; install dependencies normally.

### B — UI-only patch for your existing mobile project

Use `uniqueue-mobile-ui-only-patch.zip` if your current app already contains the prior fixes. Back up your working project, then copy the contents of its `uniqueue_mobile` directory into the matching root of your actual mobile project, for example:

`C:\Users\RHAINE\Desktop\react\uniqueue_mobile`

Merge matching subfolders and replace only the listed files. **Do not replace your whole project with this small patch**, and do not create a nested second mobile project. It is not a complete app. All UI component files in the patch must be applied together: new shared exports are consumed by the restyled screens.

If you made local edits to one of those component files, merge them rather than blindly overwriting your changes. No backend files belong in this patch.

## Run locally

From the mobile project directory containing `package.json`:

```powershell
npm ci
npm run typecheck
npx expo start -c
```

Use your existing development/native-build workflow to preview on a phone. Editing local files does not update an installed production APK automatically. This request adds no new native dependencies or permissions; release UI/assets through your existing compatible mobile build/update pipeline.

**Do NOT upload PHP files, run SQL migrations, change production URLs, rotate credentials or redeploy the backend just to apply this visual redesign.** The earlier security/deployment obligations remain separate and were not performed by this UI-only task.

## Validation completed

| Check | Result |
| --- | --- |
| TypeScript typecheck | Pass |
| Existing isolated mobile tests | 78 checks pass (domain, lifecycle, CSM, Google-runtime mocks, optional feedback) |
| Queue-alert regression | 13 isolated checks pass |
| Empty-queue request-helper regression | 11 checks pass |
| Pending logout race regression | 5 checks pass |
| Main browser UI suite | 42 checks pass |
| Auth/compact-screen UI suite | 8 checks pass |
| Pending links / completed CSM / next-alert UI | 9 checks pass |
| Student/parent empty states | 8 checks pass |
| Navigation label-width regression | 6 cases pass at 320/390/1440px |
| Interactive tutorial suite | 25 checks pass |
| Web export | Pass |
| Android JavaScript/Hermes export | Pass — not a Gradle/Kotlin compile or signed APK |
| Release config gate | Pass, configuration unchanged |
| ESLint | 0 errors, 109 warnings; not a warning-free codebase |
| Contrast checks | 9 selected design-token pairs pass AA text/UI-boundary thresholds |
| Backend scope guard | All snapshotted backend files byte-for-byte unchanged |
| Protected mobile source guard | 21 API/auth/session/queue/config files unchanged |
| Network-call comparison | Same request call expressions in 20 restyled components, ignoring formatting-only trailing commas/whitespace |

Screenshots were rendered with local deterministic fixtures; principal screens, dialogs, forms and compact states were visually inspected. Fixture names/tickets are samples, not live transactions. Deliberate offline/error fixtures produce expected test error logs.

Browser previews are not physical-device certification. Native keyboard behavior, font scaling, platform safe areas, OS dark-mode preferences, screen readers, notification delivery and actual device performance still need your normal phone smoke test. This redesign does not claim to fix or retest production push transport. Existing queue sound/vibration code is unchanged.

## Files / evidence

- `UI-CHANGE-MANIFEST.md`: exact changed mobile files and hashes relative to the pre-redesign source.
- `uniqueue-mobile-ui-previews-and-tests.zip`: current previews, test logs and validation summary.
- Historical reports already in the complete source describe prior work; this file is the scope/installation guide for the visual redesign.

No backend changes or deployment steps are bundled or required for this UI-only change.
