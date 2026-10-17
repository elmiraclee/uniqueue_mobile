# UniQueue — Web ↔ Mobile parity update

## Deploy
1. Upload the whole `uniqueue_api/` folder (incl. the new `lib/` folder) to the server.
   `lib/web/functions.php` and `lib/web/algo.php` are verbatim copies of the web's
   `app/helpers/functions.php` and `public/api/algo.php` — re-copy them whenever those change.
2. Make sure the web migration `2026-10-05-smart-multi-queue.sql` has been run
   (reserved status + depends_on_ticket_id).
3. Rebuild the Expo app (`eas build`) from `uniqueue_mobile/`.

## New API endpoints
activate_student.php, prequeue_check.php, get_possible_windows.php, service_need_request_multi.php

## Rewritten / updated API endpoints (web rules 1:1)
office-queue.php, get_offices.php, queue_process.php, get_current_queue.php, get_queue_details.php,
get_payable_tickets.php, get_unavailable_services.php, cancel_queue.php, requeue_respond.php,
mark_notification_read.php, parent_signup.php, signup.php, update_parent_profile.php,
get_parent_profile.php, get_parent_transactions.php, get_parent_children.php,
cron_scan_notifications.php (removed invisible characters that caused a PHP parse error)

## Mobile
- Student: join other offices while a ticket is active (smart multi-queue / reserved tickets),
  office hours/holiday/cutoff shown, unavailable services multi-request with choices + note,
  hybrid office payments, possible-counter preview, early pre-queue warning,
  event academic period/school year, account activation screen, strong-password signup.
- Parent: per-child queues (no family-wide lock), live card (window, people ahead, ETA, 5s refresh),
  cancel + requeue for a child, events + availability + parent-queue setting, unavailable-service
  requests, history with child/status filters + details + feedback + pagination,
  notifications mark read / mark all, profile with linked children + secure password change,
  signup with consent + strong password.

## Still recommended
The API still trusts student_id/parent_id sent by the app. Add token auth (issue a token at login,
verify it in lib/shared.php) before going wide.

## Round 2 — copy web capabilities to mobile
- Student home: current-queue card shows People Ahead, Estimated Wait, Assigned Window,
  Estimated Call Time (web dashboard rows); button to the new Live Queue Monitor.
- NEW Live Queue Monitor (`/student/live-monitor`, `/parent/live-monitor`): office tabs, open
  windows only, paused state, now serving / next / waiting with est. call time, your ticket highlighted, 3s refresh.
- Live queue board: estimated call time + per-ticket ETA.
- Ticket screen: web live panel (state headline/sub, Ahead / Est. wait / Window, est. call time,
  reserved / all-windows-closed / requeued notes); cancel follows `can_cancel`.
- Cancel rule everywhere = web (waiting/reserved/next and never once called).
- Requirements step includes the selected choice's own requirements.
- Office queue: "Queue for {child}" banner for parents; "currently unavailable services" button +
  request popup for this office; payment event steps show "Requested at" + "Amount to Pay".
- Parent home: 3s refresh, per-ticket People Ahead / Estimated Wait / Window / Estimated Call Time,
  "{child} is being called! Proceed now to {window}", Last updated + Refresh, Profile only /
  Student account badge, hero stats incl. Offices open, live monitor link; joining another queue is
  blocked while the child has an active queue or pending feedback (web parent dashboard rule) —
  also enforced in the parent office picker.

## Round 3
- Ticket / live queue / cards: skipped-and-unanswered tickets show "You were skipped" with no
  position or ETA (people ahead may be null).
