# Validation — maroon mobile update

## Passed
- TypeScript: `npm run typecheck` (no errors).
- Core/domain/resource/CSM/Google-runtime/interface-feedback isolated checks: 78.
- Foreground queue audio/vibration/event checks: 22. Includes held repeating vibration, stale-owner cleanup, background release/resume, acknowledgement cancellation, audio-timeout independence, and late-audio initialization after OK.
- Prompt policy isolated checks: 27. Includes 5→1, invalid positions, live-state matching, cancelled/completed/held tickets, next/turn priority, and ticket identity.
- Empty-queue API checks: 11; pending native logout checks: 5.
- New maroon/header/countdown browser checks: 73 at 320px and 390px for student and parent. Includes profile menu, cancel Logout, full header Logout/session clearing, countdown acknowledgements, updating an open modal, stale-position rejection, cancelled-ticket dismissal, and actual-turn shortcut.
- Existing browser UI checks: 42; additional auth/compact states: 8; navigation-label cases: 6 at 320/390/1440px; prior approved state cases: 9; empty-state cases: 8; interactive tutorial checks: 25.
- Expo Web export and Android JavaScript/Hermes export.
- Existing release configuration check (configuration only).
- Lint: 0 errors, 106 warnings remain. This is not a warning-free codebase.
- Seven key text-color pairs meet WCAG AA normal-text contrast 4.5:1.
- Backend hash comparison: 1,826 files unchanged. No server/database configuration or queue policy changes.
- Archives tested for ZIP integrity and checked against known private credential values from the original upload; private environment files and dependencies/build caches are excluded.

## Test boundaries
Browser tests render the real Expo Web application with isolated API fixtures. External requests are intercepted/blocked; these are not live production account/queue tests. The deliberate 503 response in the browser log tests the connection-error UI. Representative changed mobile states were visually inspected individually; the supplied combined preview is a handoff image, not a native-device capture.

**Not performed:** physical-device haptic/audio testing, signed APK/AAB build, Gradle/Kotlin/native compilation, live backend/DB/push E2E validation, iOS native testing, or production deployment. Android export passing establishes JS bundling, not native installability. Follow the device acceptance checklist in README-MAROON-MOBILE.md before deployment. Foreground repeating vibration is implemented, but cannot be demonstrated or guaranteed on a physical phone from browser screenshots or mocked Vibration tests.
