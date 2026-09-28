# One-second realtime widget and background alarm — v5

## Root causes found

1. The staff web server was still sending Android channel IDs ending in `v2`, while the installed mobile build created `v3`. Android can drop or silently downgrade a push that references a missing channel.
2. The device-token table was only created, never migrated. On an older database, `owner_type` and `owner_id` could be missing, causing server token lookups to fail.
3. Mobile treated any HTTP 200 from token registration as success and permanently skipped re-registering the same cached token, even when the JSON body said registration failed.
4. The first `waiting → next` transition happened inside the staff `queue-data.php` polling endpoint without sending a server push.
5. Android widgets normally receive periodic updates only about every 30 minutes. The old widget depended mainly on that system callback or an open app.
6. The modal vibration is JavaScript-driven, so it stops when the app UI is suspended.
7. The supplied staff web `.env` and mobile API `db.php` pointed to different database accounts. Staff actions therefore could not reliably see the push tokens registered by the mobile API.

## Fixes

- All mobile, API, and web push senders now use matching `v5` channels.
- Every visible push has a high-priority data-only companion push:
  - wakes the Expo background task;
  - refreshes the widget from the live API;
  - invokes a native 15-second vibration fallback for turn alarms.
- Token registration now validates `success: true`, retries every launch, reacts to token rotation, and upgrades the legacy database schema.
- Staff transitions send pushes from `queue-data`, assign, start, complete, skip, cancel, pause/reassign, and window changes.
- The supplied web database configuration is aligned with the mobile API database so tickets, notification rows, and device tokens share one source of truth.
- The widget still has push-driven and one-minute refresh fallbacks, while v5's foreground service provides the primary one-second live update path.

## v5 realtime mode

Android does not permit an ordinary widget or suspended JavaScript app to run every second. v5 adds a native foreground service that:

- polls `get_live_queue.php` every second while a ticket is active;
- updates the home-screen widget directly from native Android code;
- holds a partial wake lock so screen-off/background mode does not pause the one-second loop;
- detects `next`, `called`, and `in_progress` transitions natively;
- posts the urgent notification and runs the alarm vibration without waiting for the app screen to open;
- stops automatically when the ticket is completed/cancelled or the user logs out.

Android requires a permanent **Uniqueue live ticket active** notification while this realtime service runs. This notification is intentional and is the OS-supported tradeoff for one-second background execution.

## Required deployment

These three projects must be deployed together:

1. Build and install a **new APK** from this mobile source. Expo Go cannot test Android remote push or the native widget.
2. Upload the updated `uniqueue_api` source.
3. Upload the updated staff web source. The old web push helper sends obsolete channel IDs.

For EAS Android credentials, the uploaded FCM V1 service account must belong to the same Firebase project as `google-services.json`, and the Android package must remain `com.uniqueue.app`.

After installing the new APK:

1. Open the app, sign in, and allow notifications.
2. Remove and re-add the Live Ticket widget.
3. Background the app normally—do not **Force stop** it in Android Settings.
4. Have staff move a ticket to Next/Serving.
5. In Android notification settings, make sure **Your Turn — Proceed Now** allows vibration and sound.

Android blocks all receivers and pushes after the user explicitly Force stops an app; no application code can override that OS rule.