# UniQueue — approved fixes and release handoff

Prepared 31 October 2026, Asia/Manila.

## Release status

**Approved source fixes implemented. NOT deployed. NOT yet certified production-ready.**

These packages contain patched source, not an APK/AAB or a server/database deployment. No production accounts, database, SMTP or push services were used. Web/mobile parity was compared against the two supplied codebases. An unauthenticated attempt to load https://uniqueue.site failed in the web loader; a separate public-header check could not resolve the domain from this environment. This does not prove the site is down for everyone, but live authenticated parity and DNS/TLS remain unverified.

## Implemented behavior

### Tutorial and student/parent UI
- Removed the unsupported Regular/Certified copy selection and its lesson from the practice tutorial. Legitimate service options in actual services remain supported.
- Bumped tutorial progress version so an obsolete step does not strand an existing user.
- Full ticket: explicit people-ahead/wait information, closure timeline, no-requirements explanation, and feedback-aware CSM action. A submitted CSM links to History instead of inviting a duplicate submission.
- Parent Home: pending-link summary and a route to review pending links, without granting access before approval.
- Corrected next-in-line vs proceed-now modal selection for a still-waiting ticket with zero ahead.
- Interpreted the earlier `<br>` request as a general broken-UI audit, as clarified. No arbitrary text or database records were stripped of line breaks.

### Ticket-change notices and audio/vibration
- Distinct event IDs replace ticket/type-only suppression. A second legitimate call, move or position change is not permanently suppressed by the first one.
- Source-row triggers capture status, window, requeue, dependency, priority and appointment/type changes transactionally. An inbox/event/outbox bridge processes captured changes and retries transport failures.
- Notices explain window changes, queue movement, appointment/priority placement ahead, conflict deferral and conflict resolution. Position changes outside the five-person countdown are still recorded.
- People-ahead computation includes the currently serving client and applies shared serve-eligibility rules. Held/ineligible tickets no longer receive a fabricated zero-ahead estimate.
- Foreground positions 5, 4, 3, 2, 1 ahead have audio/vibration cues; called/in_progress starts a bounded actual-turn alarm. Acknowledgement stops the foreground alarm. Next-in-line is a preparation prompt, not a false proceed-now instruction.
- Freshness, current-ticket checks, authenticated audience verification and event claims reduce stale/replayed and duplicate cues. A native realtime widget service no longer starts its own competing turn alarm.
- Android uses v6 notification channels. Background data-push is validated against the active session before a visible local notification is posted.
- **Queue-notice audience:** student plus ONLY the parent who created that ticket, while their link remains active. Student-created ticket: student only. Other linked parents receive no queue-event delivery through this feed. Account/link notices remain separate; this change does not redefine the entire linked-parent viewing policy.
- Read receipts are per recipient: a parent reading a notice does not mark the student's copy read.

### Security/configuration
- Active web/API/mobile profile now uses https://uniqueue.site and https://uniqueue.site/uniqueue_api; mobile cleartext traffic is disabled.
- Five staff queue mutation routes now require POST and a valid CSRF token; the dashboard includes the token. Retired/broken duplicate mutation/notification endpoints fail closed.
- Push registration binds a token to the current mobile session. Delivery excludes expired/revoked sessions. Delayed logout cannot delete a token rebound to a newer session.
- Native offline logout retains pending server revocation in SecureStore and retries it. Serialized storage prevents a concurrent retry from erasing a newer pending logout. Web logout requires an online server confirmation rather than persisting an old bearer insecurely.
- Android widget credentials are encrypted using an Android Keystore AES/GCM key rather than stored as plaintext preferences. Old plaintext is removed, not migrated.
- New channels use private visibility and do not bypass DND. Device lock-screen privacy remains subject to OS/user settings.
- Private `.env` / `.env.expa` from the uploads are NOT redistributed. A placeholder-only production environment template is included.

## Feature parity findings — what was actually missing

Most student/parent features already existed in the supplied mobile source. They were not rebuilt or duplicated.

| Area | Finding / disposition |
| --- | --- |
| Activation, parent signup, password reset, Google auth | Existing; live auth/mail/OAuth acceptance still required |
| Regular, appointment, priority, cashier and event requests | Existing; ordering/notification consistency repaired |
| Academic copies/year/period, requirements | Existing; only unsupported tutorial examples removed |
| Multi-office reserved/dependent queues | Existing; conflict reasons and shared eligibility improved |
| Full-ticket ahead/wait, completion/CSM, requirement empty state | Parity/consistency gaps addressed |
| Parent link/add/approve/unlink | Existing; pending-link visibility added to Home |
| History filters/pagination/timeline/CSM | Existing; ticket-to-history action corrected |
| Unavailable-service request, live monitor, window choice | Existing; live API/device acceptance still required |
| Notification inbox/read controls | Existing; event completeness/deduplication/recipient semantics repaired |
| Profile/password/student photo | Existing and preserved |
| Android widget | Existing; credential storage and alarm ownership repaired in source; native validation pending |
| iOS native widget equivalent | Not supplied; not added without an iOS scope decision |

## Tests actually completed

All listed tests are local/isolated; mocks are not proof of real-device delivery.

| Check | Result |
| --- | --- |
| TypeScript `npm run typecheck` | Pass |
| `npm test` | 41 domain + 10 lifecycle + 10 CSM + 8 Google-runtime + 9 optional-feedback checks pass |
| `npm run test:alerts` | 13 isolated event/audio/vibration checks pass |
| `npm run test:logout` | 5 isolated pending-revocation checks pass |
| MariaDB 10.5 + migration/trigger regression | 35 checks pass, including creator-only audience, independent reads, repeated call/move, 5→1, priority/appointment, conflicts, rollback and session binding |
| Outbox retry test | 3 checks pass; simulated transport failure retained, retried, not replayed after acceptance |
| Staff method/CSRF guards | 15 checks pass across 5 routes |
| PHP CLI 8.5 syntax, excluding vendor | 270 files pass |
| Main browser UI regression | 42 checks pass, including deliberate offline/error fixtures |
| Interactive tutorial | 25 checks pass |
| Additional approved UI states | 9 states pass at 320/390/1440px, no page exceptions; screenshots visually reviewed |
| Web export | Pass |
| Android JavaScript/Hermes export | Pass; NOT a Kotlin/Gradle build, signed artifact or physical-device test |
| Release configuration gate | Pass for configured domain/HTTPS/profile |
| ESLint | 0 errors, 109 warnings; existing hooks/compiler/style debt remains, not a warning-free release |

The failed-delivery log in the outbox test and 503 console line in the error-state UI fixture are intentional test conditions. They are not evidence of a production incident. Prior validation files in the original projects are historical; this handoff describes the current checks.

## Mandatory deployment gates — owner confirmation required

1. **Rotate credentials from the original archives.** The original uploaded environment files contained potentially real secrets. Their validity was not tested. Rotate applicable DB, mail, OAuth private secrets, VAPID/private telemetry credentials and revoke old access as appropriate. Excluding a file does not revoke a leaked secret. No rotation was performed by this task.
2. **Verify domain/TLS and document-root protection.** Confirm DNS and valid HTTPS at uniqueue.site, the API path, redirects and secure cookies. Preserve the unified `uniqueue/` layout and its Apache `.htaccess` rules. Do not expose app/vendor/databases/tools/tests, environment files, source documents or migration files. For nginx or other hosting, implement equivalent deny/rewrite rules; Apache rules are not automatic there. The supplied development profile is inactive, not a production endpoint.
3. **Back up and stage the REAL schema.** These changes are an upgrade to the existing application/database, not a new database installer. Confirm prerequisite migrations and existing base schema. Run `php tools/check-notice-schema.php` using the intended private staging environment. This checks key columns and InnoDB, but does not replace a full schema/grants review. Apply migration 005 during maintenance BEFORE releasing the updated code. Do not run `tests/approved-fixes/fixture.sql` on any real database.
4. **Check triggers and transaction support.** The application DB must support InnoDB, JSON_OBJECT, and CREATE TRIGGER for migration installation. Verify both `uq_queue_notice_insert` and `uq_queue_notice_update` exist. MySQL DDL/trigger installation is not a single rollbackable transaction; take a backup first and keep writers paused until validation completes. Check for unexpected legacy UNIQUE(ticket_id,type) constraints that would block repeated notices. Test existing waiting/called tickets on staging; old inbox rows are not bulk-replayed as fresh alarms.
5. **Configure private environment outside the public tree.** Use `.env.production.example` as a starting point. Set `UNIQUEUE_ENV_FILE` for BOTH web PHP and CLI cron; configure real DB/SMTP/OAuth/VAPID values privately. Keep PHP/MySQL timezones at Asia/Manila / +08:00. Do not overwrite existing runtime uploads with the sanitized source package.
6. **Run the notice worker.** Every minute, run the CLI script `php /absolute/path/uniqueue/uniqueue_api/cron_scan_notifications.php` with the same private environment. It runs about 55 seconds, scanning every five seconds, with an overlap lock. Ensure host cron duration limits permit it. If not, adapt the scheduler on staging rather than silently omitting it. Monitor unprocessed `queue_notice_changes`, pending/attempted `queue_notice_outbox`, worker errors and age/backlog. Transport acceptance is not a confirmed device receipt; expired outbox work can be closed without a delivery attempt.
7. **Ship a NEW native mobile build.** Keystore/widget changes, channel sounds and native dependencies cannot be fully deployed by OTA. Run `npm ci`, typecheck/tests and the release configuration gate. Use EAS/native builds with the correct signing/project/push credentials. Re-register push tokens after upgrading; unbound legacy tokens are intentionally excluded. No APK/AAB, Gradle/Kotlin compile, signing or store submission was completed here.
8. **Configure iOS only if it is in scope.** The real `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is not supplied. The iOS release pre-install gate blocks without it. Set the real registered ID; do not invent one. Validate iOS background modes, APNs credentials, redirect schemes and physical-device behavior separately. No iOS widget was added.
9. **Physical-device and live-server acceptance.** Verify foreground, background, screen off, OS-terminated/force-stopped, denied permission, DND/silent, low battery/OEM restrictions, offline→online, logout/account switch, and reinstallation. Native keyboard/safe areas, TalkBack/VoiceOver and actual low-end-device behavior remain unverified. Data-only push/background execution is best-effort, especially on iOS or force-stopped apps; an absolute always-ringing alarm cannot be promised. Explicitly accept a fallback operational policy for missed device alerts.
10. **End-to-end business acceptance.** On staging with test users: create student and creator-parent tickets; confirm another linked parent receives no queue notice; independently read inboxes; exercise 5→4→3→2→1→next→called→service→complete, repeated calls after skip/rejoin, window transfer/back, appointment and priority ahead even beyond five, two-office conflict/resolution, reserved activation, cancel/expire, CSM submission and pending links. Check simultaneous staff operations and load/backlog; concurrency/load certification is not completed here. Verify live mail/OAuth/push transport/receipts and web CSRF success paths, not just rejection tests.

## Safe rollout / rollback

- Keep a full server + DB backup and a maintenance window. Stage the coordinated PHP/API/mobile change first; do not deploy only `uniqueue_api`.
- Install schema, verify triggers, configure worker, then publish server code and the new native build in a controlled release. Account for installed older clients and their incompatible alert assumptions; pause or require upgrade if a mixed-version acceptance test fails.
- If acceptance fails: stop queue writers and the new worker, restore the previous coordinated code/config and DB backup or a DBA-reviewed compatible rollback. Keep new event tables/triggers until their impact is reviewed; do not drop notification history on a live system as a quick rollback. Reconcile any queued events before resuming.

## Reproducing isolated tests

Mobile, from `uniqueue-interactive-tutorial/`:

```bash
npm ci
npm run typecheck
npm test
npm run test:alerts
npm run test:logout
npm run lint
node scripts/check-release.cjs --web-dir ../uniqueue
# Browser tests require: expo export --platform web + a supported Chromium.
node tests/rebuild-ui.cjs
node tests/tutorial-interactive.cjs
node tests/approved-ui.cjs
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when Chromium is not on the test harness default path. Browser tests use local fixtures and intercept remote requests.

Backend fixture: create a disposable, socket-only MariaDB database named `uq_regression`, load `tests/approved-fixes/fixture.sql`, then `databases/migrations/005-queue-notice-events.sql`. Use a disposable root account with a blank password ONLY on that isolated local server. Export `UQ_TEST_SOCKET` for the three PHP tests; default `/tmp/uniqueue-test.sock`. Set `UNIQUEUE_ENV_FILE` to an intentionally absent local file for these fixture tests so an uploaded/private environment is not loaded. Run events.php, outbox.php, staff-guards.php in that order. The events test mutates the fixture; reset it before rerunning. Never point this harness at production.

## Package contents / exclusions

- `uniqueue-mobile-patched.zip`: complete sanitized mobile source with new tests and this guide.
- `uniqueue-web-api-patched.zip`: complete sanitized web/API source, vendor dependencies as supplied, migration 005, fixture tests, this guide and change manifest.
- Installed node_modules, generated dist/validation, old test logs, caches, Git/IDE agent state, private env files and runtime profile uploads are excluded. Existing production uploads must be preserved separately. Placeholder environment examples remain included.
- `SOURCE-CHANGE-MANIFEST.md` lists added/modified source paths and packaged hashes compared with the supplied archives. It is not a database migration plan.
- `uniqueue-validation-evidence.zip` contains selected current screenshots and test logs, not private configuration or a production database.

**No further live changes have been made. Final deployment requires owner sign-off on the remaining gates above.**
