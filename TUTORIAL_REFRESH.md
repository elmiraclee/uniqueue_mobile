# Interactive tutorial and queue forms

## What changed

- The maintained request wizard and practice now render the **same** queue-type cards and service-request component (`components/queue-step/form-ui.tsx`). The tutorial is no longer a prettier, separate version of the real form.
- Real requests now have clear step progress, selectable service cards, copy counters (1–99), document-option buttons, grouped academic details, and an optional **Use the same details for all copies** control. Each copy still carries its own validated academic values in the existing request payload.
- Retained the maintained request model, preflight checks, selected-choice requirements, office restrictions, parent verification, cashier/payment selection and event flows. This is a presentation change, not a replacement of those business rules.
- Replaced the bottom tutorial dock with a floating coach anchored to the highlighted control. The app keeps its full viewport. The coach follows measured layout and scroll position; on small/short screens it uses the available space and scrolls its explanation internally while task and Back/Next controls stay visible. Tall informational cards focus their heading portion on short phones rather than leaving a tiny coach strip.
- Practice steps require real actions before **Next** is enabled: tap a queue-type card, select a service, increase copies, select a document option, fill the academic period/year, check sample requirements, and create a sample ticket. A separate review step shows the request before the confirmation lesson.
- Added task-complete feedback, step progress, Back, Pause, Resume, Skip and Finish. Android Back and web Escape pause the guide. Leaving practice returns to the correct role's home. Student and parent guides remain role-specific.
- Practice uses only local sample form state. It cannot submit a real queue, payment, profile edit or CSM response. Existing app notification polling continues independently; tutorial progress may sync to the existing `mobile_tour.php` endpoint.
- Version 3 local progress starts fresh rather than reinterpreting old lesson indices. Active v3 progress resumes at its saved lesson; prerequisite sample fields are restored when required. Unsaved sample edits are not durable across page reloads.
- Removed the duplicate coach render in the notification modal, and improved sample-ticket labels and typography.

## How to try it

1. Run the project normally and sign in to a student or parent account.
2. Tap the **?** button in the app header to start/resume. Long-press it to restart using the existing confirmation.
3. Follow the highlighted control. The action steps are clearly marked as safe practice.
4. Pause at any time to explore; resume with the practice header's **?** button. Exit returns to your role's dashboard.

## Validation

```sh
npm ci
npm run typecheck
npm test
npm run test:navigation
npm run lint
npx expo export --platform web --max-workers 2
npx playwright install chromium
npm run test:ui
npm run test:tutorial
# Optional full walkthrough at a compact width:
UQ_TUTORIAL_WIDTH=320 UQ_TEST_OUTPUT=validation/tutorial-compact npm run test:tutorial
```

Browser suites run the real exported Expo Web bundle against deterministic local PHP-contract fixtures. External requests are blocked. They check the action gates, sample-only submissions, saved progress, pause/resume/exit, role routing, viewport bounds and spotlight/coach separation. Shared-form coverage checks quantity changes and academic values when switching between same-details and individual-copy modes. The existing suite still exercises real wizard payloads, requirements, parent proof, cashier/event flows, navigation and error recovery against fixtures.

Screenshots and machine-readable results are in `validation/tutorial-refresh/`; earlier UI-refresh evidence remains in `validation/ui-refresh/`. See the validation summary for final outcomes.

## Release scope

This ZIP contains updated **source**, not an APK or IPA. Native Android/iOS touch behavior, screen readers, keyboards, large text, audio/haptics, notification permissions, background push and orientation still need physical-device acceptance testing. No live backend or real account was used in the browser tests.

The uploaded development deployment settings are preserved. The HTTP profile still fails the existing production HTTPS release gate; supply the real HTTPS deployment values before using actual credentials/student data or releasing the app. See `UI_REFRESH.md` and the README for the inherited native setup requirements.
