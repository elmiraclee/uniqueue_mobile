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
