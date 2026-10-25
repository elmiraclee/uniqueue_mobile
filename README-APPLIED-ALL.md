# UniQueue — approved student/parent update

This update implements the approved mobile feature list against the supplied web source. It is source code, not an APK/IPA, and has not been deployed to your live server. No QAM/admin/staff interface changes are included.

## Included changes

### Tutorial redesign
- The tutorial coach reserves its own layout space below the app instead of covering the highlighted screen. Copy is shorter, with optional More details and a scrollable explanation.
- Native View refs and ScrollView innerViewRef are used for measurement. No numeric handle or composite component is passed to native measureLayout.
- The guide scrolls to specific controls, clips the spotlight to the available stage, and supports Back, Next, Pause/Try it, Resume, Skip and Finish.
- Notifications open the actual notification sheet; the monitor steps open the actual monitor. Hidden notification sheets no longer register duplicate guide targets.
- Account-scoped local/server progress and 34 student / 37 parent steps are retained. Practice cannot create a queue ticket, feedback response, payment or profile update.

### Web/mobile parity features
1. Student profile: school level and managed grade/year editing, including sixth year and Irregular. College/program appear only for College; server validates active/current options, matching program/college, and rejects stale academic edits.
2. Managed grade choices: signup, activation and Parent Add Child use the server catalog and managed labels. New choices must be enabled; current legacy/inactive profile values can be retained. Numeric college year is derived server-side, never trusted from the client.
3. Pending CSM: blocks only the same office, checked in student/parent screens and independently in the join API. Other restrictions such as active tickets, schedules, limits and eligibility remain enforced. The existing completed-today rule is retained.
4. Student transaction details: available joined/called/completed timestamps, SQD0 and saved comment. Missing timestamps are not invented.
5. Student history: active records in All, filters/search and server-side pagination. Shared student/parent history presentation retains child filtering and existing parent authorization.
6. Live monitor: Manage offices, persisted device visibility preferences and at least one visible office.
7. Per-office window tabs and correct paused/open state.
8. Independent ticket detail expansion for serving, next, waiting and last-served cards.
9. Explicit stale/disconnected state, retained last snapshot, Retry now and polling recovery.
10. Optional foreground chime based on queue/window changes in visible offices. Initial load and ETA-only drift are silent. Sound stays off until enabled; OS notifications remain separate.
11. Parent child checker: unavailable/timed-out live check does not prevent final submission. Known invalid input still blocks; the final endpoint revalidates identity, grade, duplicates and linking. SR-code formatting is retained.

Also included: student photo preview before choosing a replacement, image-load fallback and responsive sizing. Existing native gallery crop flow is preserved.

## Install — back up first

1. Back up your mobile project, API files and database. Review the changed-file manifest.
2. Extract `uniqueue_mobile-all-features.zip`. It contains the complete updated mobile source under `uniqueue_mobile/`; dependencies, caches, build outputs and private environment files are not bundled. Preserve your local `.env` and signing configuration if merging into an existing checkout.
3. Extract `uniqueue_api-all-features-patch.zip` and MERGE its `uniqueue_api/` contents into the existing API folder. Do not replace/delete the whole server folder. This is a patch, not a standalone API installation: it relies on the rest of the API you uploaded. `db.php`, environment files, uploads and existing server credentials are deliberately excluded and must remain in place.
4. The mobile API must connect to the SAME database as the supplied web app to share grade settings. If `academic_grade_options` already exists, no new migration is needed. Otherwise review and run `optional-database/2026-10-14-academic-grades.sql` in the correct existing database. This is the supplied web migration (CREATE IF NOT EXISTS / INSERT IGNORE), not a database replacement. It does not rewrite student records. Without the table the helper uses standard defaults; admin-managed changes require the table.
5. Check `constants/backend.ts` and your `EXPO_PUBLIC_API_URL` override. The supplied project defaults to `https://uni-queue.site/uniqueue_api`. Your earlier log used an HTTP IP address instead: make sure mobile, API, sessions and uploaded-file root point to the intended environment. Do not enter credentials or bearer tokens into logs.
6. In the mobile project run `npm ci`, then `npx expo start -c`. Rebuild your development/production client as appropriate for your existing native modules and EAS setup. No package dependency changes were made.
7. If you still receive 401, sign out and sign in against the same backend; verify session expiry and that the reverse proxy forwards Authorization. The patch reports safe auth error codes but does not bypass authentication. The public grade-options endpoint is allowlisted; private endpoints remain protected.

## Validation performed locally

- TypeScript: `npx tsc --noEmit` passed with the project's installed dependency types.
- PHP: every API PHP file passed `php -l` using PHP 8.5.
- Expo exports: web, Android Hermes JavaScript bundle and iOS Hermes JavaScript bundle succeeded.
- Isolated MariaDB/PHP HTTP tests: 24 API cases, 7 signup/activation cases, plus a >20 pending-CSM office-coverage case passed. Synthetic accounts only; no live data was contacted.
- PHP helper tests: 9 passed; monitor/catalog model tests: 19 passed.
- Browser-rendered React Native Web regression: 117 checks across 320px and 390px viewports, including paging, history details, managed academic fields, monitor preferences/window/expanded/offline/retry states and child-check fallback.
- Every one of the 71 combined parent/student guide steps resolved a highlight; pause/resume/back traversal passed. Practice traversal produced no destructive submissions. Additional 8 responsive/photo checks passed, including landscape. Relevant screenshots were visually inspected.

### Still requires testing on your actual phone/server
Physical Android/iOS behavior (native layout and safe-area insets, keyboard, gallery permissions/crop/upload, notification permission/push delivery, audible chime, widget, device backgrounding and slow networks), real production database compatibility and Apache/proxy configuration. JavaScript export success is NOT a signed APK/IPA or an on-device test. No production deployment was performed.

## Acceptance smoke test
- Restart/resume each role's guide; confirm the target stays above the coach, including notification, service quantities, academic details, CSM and monitor steps.
- Edit a student to JHS/SHS and College sixth/Irregular; verify conditional fields and saved values on web. Modify a managed label/availability on web and refresh mobile choices.
- Complete a ticket without CSM in office A: joining A must fail; office B must remain eligible if its other rules permit. Submit CSM, then retry.
- Check active and completed transactions, page navigation, timeline and saved comment for the correct student/child.
- Hide an office, relaunch, switch windows, expand tickets, interrupt/recover the network, then opt in to sound and change a visible queue/window. ETA-only changes must stay silent.
- Temporarily interrupt the live child checker in a test environment: final submission should remain available but invalid/duplicate data must still be rejected server-side.
