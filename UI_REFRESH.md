# UniQueue UI refresh

The follow-up queue-form and interactive tutorial update is documented in [TUTORIAL_REFRESH.md](TUTORIAL_REFRESH.md).

## What changed

- Kept the UniQueue logo and maroon identity; introduced a lighter neutral canvas, consistent card borders, restrained elevation, and more legible typography.
- Unified primary, secondary, loading, disabled, pressed, focused, and destructive buttons through `CustomButton`. Portal, account, authentication, and common dialog actions use this component.
- Updated role-specific bottom navigation with selected icon backgrounds, filled active icons, alert counts, keyboard hiding, and safe-area spacing. Student and parent workflows remain distinct.
- Refreshed notification cards and the inbox with All / Unread segments, explicit unread indicators, consistent actions, semantic icons, and a responsive notification sheet.
- Updated confirmations, validation dialogs, success/error toasts, and queue-call prompts. Toasts no longer cover page headings; destructive dialogs support a separate danger treatment. Dialogs fit small screens and can scroll when needed.
- Added **Profile → App experience** preferences: optional success chime (off by default) and haptic feedback. Settings persist locally. Audio and storage failures do not block app actions. Queue push notification sounds remain separate from interface feedback.
- Replaced repeating in-app vibration with one optional haptic cue. Existing OS queue-alert delivery and channel configuration are preserved.
- Improved authentication forms, labelled controls, password visibility, selector sizes, safe areas, keyboard focus, compact layouts, and reduced-motion behavior in shared animated controls and dialogs.
- Fixed existing lint-blocking issues in the current-queue modal and escaped queue copy.

## Cleanup and routing

Removed the unused **`mobile/`** nested application and **`mobile.zip`**. The repository's existing release-check script explicitly identified those as legacy packaging leftovers; the root package, Metro config, and TypeScript aliases use the root application instead.

Kept public student/parent URLs as lightweight redirects into the maintained tab screens, preserving query parameters. This replaces competing legacy screen implementations without breaking old URLs. Maintained dashboard styles now live in `dashboard-styles.ts` and `parent-styles.ts`.

## Run

```sh
npm ci
npm start
```

For a local web preview:

```sh
npx expo export --platform web
```

## Validation

```sh
npm run typecheck
npm test
npm run test:navigation
npm run lint
npx expo export --platform web
npx playwright install chromium
npm run test:ui
```

The browser suites use local deterministic PHP-contract fixtures and block non-local external requests. They do not log in to, mutate, or validate the real backend. One simulated 503 is deliberate error-state coverage. External Google discovery requests are blocked in the isolated account-form tests.

See `validation/ui-refresh/` for screenshots, test results, changed-file inventory, and the final validation summary. Historical reports in the root predate this refresh.

## Before a native release

- **The uploaded development deployment configuration is retained.** Its HTTP API/web origins and `allow_insecure_http` flag intentionally have not been silently changed. The production release check still rejects this configuration until you supply your real HTTPS deployment values.
- Test Android/iOS installation, keyboard behavior, large accessibility text, physical-device haptics, audible playback, silent mode, notification permissions, background/killed-app push, and deep links on actual devices.
- Native push needs a rebuilt development/production app and the existing server/FCM configuration; Expo Web and Expo Go cannot prove closed-app delivery. Device notification permissions, channel settings, and Do Not Disturb behavior control queue alert delivery.
- This is updated **source**, not an APK/IPA. Build artifacts and `node_modules` are intentionally excluded from the ZIP.
