# Where these files go

This zip contains only new/changed files — copy each into the matching
path in your project (overwriting the existing file where one exists).

## Mobile app (Expo project)

| File in this zip | Goes to |
|---|---|
| `screens-app-student/home.tsx` | `app/student/home.tsx` |
| `screens-app-student/profile.tsx` | `app/student/profile.tsx` |
| `screens-app-student/queue.tsx` | `app/student/queue.tsx` |
| `components/queue/requeue-modal.tsx` | `components/queue/requeue-modal.tsx` (new file) |
| `components/queue/change-password-modal.tsx` | `components/queue/change-password-modal.tsx` (new file) |
| `constants-backend.ts` | `constants/backend.ts` |

`@react-native-picker/picker` is already in your `package.json`, so no new
dependency install is needed.

## Backend (`uniqueue_api/`)

| File in this zip | Goes to |
|---|---|
| `uniqueue_api/update_profile.php` | new file |
| `uniqueue_api/change_password.php` | new file |
| `uniqueue_api/requeue_respond.php` | new file |
| `uniqueue_api/get_current_queue.php` | overwrite (adds `is_requeued`/`requeue_confirmed` to the response) |
| `uniqueue_api/get_student_transaction.php` | overwrite (adds optional `q`, `page`, `per_page` params; old callers with just `student_id` are unaffected) |
| `uniqueue_api/get_student_profile.php` | overwrite (adds `email` to the response) |

## One thing to check before deploying

`requeue_respond.php` and `get_current_queue.php` read/write the
`queue_tickets.is_requeued` and `queue_tickets.requeue_confirmed`
columns — the same ones the web app's staff dashboard and
`requeue-respond.php` already use. I didn't have access to run this
against your actual database, so please confirm those columns exist on
`queue_tickets` in your schema (they should, since web already relies on
them) before shipping.

## What changed, function by function

- **Profile screen**: "Save Changes" now calls `update_profile.php`
  instead of only writing to `AsyncStorage`. College/Program are now
  cascading pickers (same UX as the signup screen) instead of free text,
  so they save the correct `college_id`/`program_id` instead of
  arbitrary strings. Email field was added (previously missing from the
  mobile profile entirely). A "Change Password" button opens a new modal
  that calls `change_password.php`.
- **Home screen**: the existing 3-second polling loop now also checks
  `is_requeued` on the student's current ticket. If a staff member skips
  the student, a `RequeueModal` pops up automatically with "Stay in
  Queue" / "Cancel My Queue", matching the web dashboard's behavior.
- **Transactions screen (`queue.tsx`)**: added a search box above the
  existing type/status filters, debounced 400ms, calling the new `q`
  param on `get_student_transaction.php`. The existing client-side
  type/status filtering is untouched.
- Server-side pagination (`page`/`per_page`) is built into
  `get_student_transaction.php` and returns `total`/`has_more`, but I
  did not wire a "load more" UI into `queue.tsx` — the screen still
  pulls the student's full (now search-filtered) history in one request.
  Worth revisiting if a student's history grows large enough that this
  becomes slow; the backend is ready for it whenever you want that added.
