# Student policy update: deployment and verification

## Existing database: safest deployment order

1. Back up the database and current application first. The requested removal of `activation_claims` and `guardian_reviews` permanently removes their rows. MySQL DDL is not an all-or-nothing transaction.
2. Ensure the base schema and earlier migrations are installed, then run `004-student-roster-activation.sql` from the database package (also in `databases/migrations/` in the web package).
3. Populate **your official roster** in `student_List`: `sr_code` (primary key), `first_name`, `last_name`. It intentionally starts empty. No automatic insert/backfill from existing users is performed.
4. Merge the updated source into your existing deployment, retaining your private environment/configuration and uploaded files. Deploy web/API and updated mobile together: old one-step activation and old parent-queue payloads are intentionally rejected.
5. Rebuild mobile from the top-level project. Restore your original private `.env` and original `google-services.json` locally before building; they are deliberately excluded from these downloads. The old nested `mobile/` project and bundled `mobile.zip` are excluded too.
6. Verify actual SMTP delivery to an authorized student's `{sr_code}@g.batstate-u.edu.ph` inbox and run real-device smoke tests before release.

**Do not import `uniqueue-updated.sql` over a live database.** It is a complete updated snapshot of the uploaded SQL, for a new/review database only; it is not a current production export. The incremental migration preserves students and parent relationships. The snapshot retains the supplied data and must not be published publicly.

## Private files intentionally excluded

Existing `.env*` files, local credential/key files, Google service configuration, uploaded profile photos, old nested archives and IDE/agent settings are not included in the source downloads. Keep your existing private configuration and uploads. This package does not create or change production credentials. General environment variable names below are not credentials.

## Activation SMTP

Uses the existing profile-aware `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`. Port 465 uses implicit TLS; other ports use STARTTLS. Missing credentials/failed delivery returns an error without advancing activation. No test OTP bypass is included. Test actual school-inbox deliverability separately.

## Rules implemented in web and mobile

- `student_List` has exactly three columns: SR Code, first name, last name. Administrators maintain it manually.
- Student Signup: match official roster, then create a real account directly. Parent Signup remains separate and does not require roster membership.
- Existing `profile_only`: Signup directs to Activate, never upgrades it through Signup. Existing `student_account`: Signup/Activate direct to Login. A roster-matched identity without a student profile is directed from Activate to Signup.
- Activation: identity -> OTP to derived school email -> verification -> password creation. Six-digit hashed OTP, ten-minute expiry, five failed guesses, 60-second resend cooldown, persistent account/IP limits, fresh challenge on resend, single-use verification proof. Database locks and affected-row checks permit only one successful activation.
- Activation preserves school/grade/year details; the student updates Profile afterward. Configured grade choices and the shared grade helper derive `year_level` consistently.
- Add Child: Elementary grades only; roster required; creates `profile_only` and an active relationship for the creating parent.
- Link Existing: official roster AND matching `students` row required. `profile_only` links immediately. **Every activated account, including Elementary, requires student approval.** Pending requests do not grant access.
- Existing record found in Add: suggest Link Existing, no duplicate. No student record found in Link: suggest Add Child for Elementary only, otherwise Student Signup first. Live checks and final writes share one policy.
- Existing active relationships are preserved, not retroactively revoked. Relinking after unlinking an activated account requires new approval.
- Every parent-created regular, appointment, payment or event-step ticket requires acknowledgment that physical ID **or** authorization will be presented at the counter. No upload. Staff checks the physical document; the checklist is not online verification.
- Fixed relationship choices fit the same 40-character column on both clients/API.
- Student name changes must match the official roster. Existing users can still log in and retain unchanged identity details without automatic roster backfill.
- Google sign-in cannot log in a `profile_only` identity; it directs to activation. Google-assisted new signup still requires roster matching.
- Mobile child summaries include reserved tickets, matching web.

## Verification and limits

`STUDENT-POLICY-TEST-RESULTS.json` lists 102 passing automated assertions: shared policy/OTP tests, actual local web/API HTTP calls, concurrent activation, DOM interaction tests and reserved-ticket parity. Also checked 266 PHP files, four changed web JS files and six changed TS/TSX files for syntax.

Environment: isolated PHP 8.3 and MariaDB 10.5; a local TLS SMTP sink received test messages, with no external email delivery. For MariaDB TEST IMPORTS ONLY, the original MySQL-8 `utf8mb4_0900_ai_ci` collation was mapped to `utf8mb4_unicode_ci`. The delivered SQL retains the original MySQL-8 collations. Both the updated fresh snapshot and upgrade migration imported successfully; a migration rerun preserved student/link/roster counts.

NOT performed: native Android/iOS builds, full Expo dependency typecheck, real-device UI execution, production deployment/migration, or delivery to actual GSuite inboxes.

The fixture-based PHP suite requires an isolated database ending in `_test`. Set `UNIQUEUE_TEST_DSN`, optionally `UNIQUEUE_TEST_USER` / `UNIQUEUE_TEST_PASS`, then run `php tests/student-policy-regression.php`. Never point tests at production.
