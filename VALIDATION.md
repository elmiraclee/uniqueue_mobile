# Validation and release handoff

## Completed on the delivered source

| Check | Result |
| --- | --- |
| TypeScript `npm run typecheck` | Passed |
| Domain/request-model tests | 41 passed |
| Resource lifecycle tests | 10 passed |
| Official CSM validation tests | 10 passed |
| Google runtime boundary tests | 8 passed |
| Route adapter/navigation structure | 20 role adapters, original student/parent tab sets and all queue modes verified |
| Expo Web export | Passed |
| Android JavaScript/Hermes export | Passed |
| iOS JavaScript/Hermes export | Passed |
| Browser workflows with isolated API fixtures | 38 checks passed, 26 screenshots |
| ESLint | 0 errors, 94 warnings; warning-free lint is not claimed |

This validation is for v2.1.0 (original design restored). The 69 unit/lifecycle checks exercise the actual model/hooks/CSM/auth-boundary code. Browser tests run the real exported Expo Web bundle with deterministic local fixtures; no live login, queue mutation, account edit, payment or API call was performed. External requests are blocked/intercepted by that harness. No server database or physical device was used.

Screenshots in `validation/original-design/` cover student Home/discovery/service-details/requirements/review/success/ticket/retry/history/monitor/preferences/notifications/profile/events/cashier, parent Home/required-child/proof/link/account/empty states, and an 1100px desktop layout, plus the restored student Transactions tab, notification sheet, read-only profile and photo viewer. They were visually inspected against locally rendered original mobile reference screens. The original header, dashboard styling, office cards, avatars and role-specific navigation were restored; clipped tab labels and a duplicate empty-child invitation were corrected. Each browser screenshot also checks horizontal overflow; the suite checks uncaught page errors, actor payloads, duplicate-submit prevention, feedback normalization, notification ID preservation and key interactive transitions.

## Reproduce

```sh
npm ci
npm run typecheck
npm test
npm run test:navigation
npm run lint
npx expo export --platform web
# Install Playwright Chromium if not already available:
npx playwright install chromium
npm run test:ui
# Or use an installed sandbox/local Chromium:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:ui
npx expo export --platform android --platform ios --output-dir native-export
npm run check:release
```

Browser results/screenshots are regenerated in `validation/original-design` (override using `UQ_TEST_OUTPUT`). Exported bundles and node_modules are intentionally not in the source ZIP. Included logs record the validation run, not a deployment certificate.

## Required before production

1. **HTTPS:** replace inherited HTTP API and public-web URLs with your real HTTPS deployment and set `allow_insecure_http=false`; align PHP/mobile profiles and rebuild native clients. Included configuration intentionally fails the release gate.
2. **Live staging API/database:** exercise both roles and all server-configured school levels, appointments/slots/cutoffs/capacity policies, hybrid offices, cashier paid/unpaid transitions, current/future event steps, reservation dependencies and eligibility failures. Verify actual endpoint response shapes and permissions against your deployed revision.
3. **Relationships:** test pending/accepted/declined/revoked links across active versus profile-only students, approval races, exact-record matching, child creation, unlinking during an open form, and unauthorized actor attempts.
4. **Authentication:** verify login/signup/activation/reset/logout, session expiry, Google OAuth with your signing identities/redirects and secure on-device storage. Supply the actual iOS Google client ID if enabling it.
5. **Native build/device:** produce signed APK/AAB/IPA using your EAS/native toolchain. JavaScript export is not a compiled Android/iOS binary or store approval. Verify keyboard/pickers/date controls, photo permissions/upload, safe areas, hardware Back and real screen-reader behavior.
6. **Notifications/background/widget:** test push permissions, Firebase/APNs delivery, foreground call prompts, notification deep links, app background/resume/termination, optional monitor sound, and Android widget update/clear behavior on physical devices. Web polling is not proof of background notification delivery.
7. **Reliability:** test real latency/disconnection, ambiguous server success after timeout (do not blindly retry), duplicate taps, concurrent office/relationship changes and multi-device updates. Cancellable reads are tested, but network cancellation cannot roll back a server write already received.
8. **Security/release ownership:** verify Firebase/EAS/application identifiers and signing, legal links, backend access enforcement, production logging, rate limits and data protection. Use only synthetic accounts until transport is secured.

Known lint warnings include inherited hook-dependency/unused diagnostics and React compiler effect/ref advice; they remain visible rather than being reported as a clean warning-free audit. No physical-device, live-server or end-to-end production-readiness claim is made.
