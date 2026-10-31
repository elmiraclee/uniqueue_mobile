# UniQueue mobile — maroon, queue prompts, and Logout

## What changed
- Stronger maroon student/parent overview cards, selected navigation, header rule, queue-card tints, and authentication accents. Neutral form surfaces remain readable.
- Small header profile photo/initials with View profile and **Logout**. The profile screen also uses Logout, not Sign out. The existing secure logout/session cleanup helper is reused.
- Fresh, authorized position events at **5, 4, 3, 2, and 1 people ahead** open a blocking countdown modal. Next-in-line and actual-turn prompts remain separate.
- While the native app is active and the prompt is visible, a repeating vibration pattern continues until OK. There is no foreground modal-vibration expiry timer. Foreground audio remains bounded; the actual-turn audio timeout does not cancel held modal vibration.
- A newer live position replaces an unacknowledged old count; the actual turn takes priority. Each candidate is checked against the existing live ticket-detail endpoint. Old positions, wrong tickets, completed/cancelled/held tickets are not replayed as active countdowns. A newly invalidated ticket dismisses its alert.
- Countdown OK stays on the current screen; next/turn OK preserves the existing ticket shortcut. An acknowledged event does not reopen during that session. Existing notification read/event-ID deduplication is retained.

## Scope
**Mobile source only. No PHP, SQL, web-app, backend configuration, queue-order, recipient, or authorization changes.** Backend hash comparison covers 1,826 files with zero changes. Existing parent-notice recipient rules remain server-controlled: this UI does not expand parent access.

No production deployment, live queue/account mutation, or signed APK/AAB is included. This is source code, not a device installer. The API remains configured for https://uniqueue.site through the project's existing deployment configuration.

## Choose one package
- **Complete mobile source:** extract `uniqueue_mobile/` into a clean folder. Includes the previous fixes and professional UI plus this update. Dependencies/build outputs/private environment files are not bundled.
- **Incremental patch:** for the previously delivered professional mobile UI only. Back up your project, then merge the included `uniqueue_mobile/` files into your existing mobile root. Do not put the folder inside another `uniqueue_mobile/` folder. If your local files have changed, review the manifest before replacing them.

No server upload or database migration is needed for this patch.

## Local checks
From the mobile project root:

```sh
npm ci
npm run typecheck
npm test
npm run test:alerts
node tests/queue-prompt.cjs
npm run check:release
```

Local browser regression tests use mocked/intercepted API responses, never production accounts. After exporting the web preview, run `node tests/maroon-alerts-ui.cjs` with Playwright Chromium installed; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select your installed Chromium. Other existing UI suites remain available under `tests/`.

## Important vibration/platform limits
- Continuous/repeating foreground vibration is implemented using React Native Vibration on supported native devices. Web previews cannot demonstrate physical-device vibration.
- Backgrounding the app stops foreground audio/vibration. Returning to an outstanding valid prompt resumes its foreground vibration. OK, logout, unmount, or authoritative ticket invalidation stops it.
- An unacknowledged prompt can update to the latest live queue state; stale or cancelled alerts must not keep vibrating forever.
- Background/locked/closed-app alerts are controlled by OS notification channels, permissions, silent/DND settings, device capabilities, and battery restrictions. This patch does not promise unstoppable background vibration or bypass OS security/settings.
- Queue alerts are independent of optional interface tap/success feedback settings.

## Device acceptance tests still required
Use a real development/production build on Android (and iOS if shipped), not a browser screenshot:
1. Trigger authorized 5→4→3→2→1 events. Leave one unacknowledged for more than 30 seconds; vibration should repeat until OK. Test count advancing while still open.
2. Confirm actual turn supersedes countdown, alarm audio plays when permitted, and OK stops vibration immediately. Audio may time out; the visible prompt's vibration should not time out.
3. Test app background/foreground, lock screen, OS notification permission denied, silent/DND and battery restrictions. Background behavior must match the limitation above.
4. Cancel/hold/complete a ticket while its prompt is open; it should stop after successful live-state validation. Test an interrupted API connection without fabricating a ticket state.
5. Verify notices on the student and only the authorized parent ticket creator, including multiple offices and priority/appointment changes, against the existing live backend in a safe staging/test environment.
6. Tap header avatar → View profile; test Logout cancel and confirm on both roles. Confirm session/widget cleanup and offline native logout retry using the existing mechanism.
7. Verify photo fallback, long names, large system text, small screens, accessibility focus, and real-device modal presentation.

## Additional design advice
No extra information-architecture changes were made. Consolidating repeated people-ahead/wait-time text into one compact ticket summary is a suggestion only and requires confirmation.
