# Student and parent/guardian workflow parity

Functionality reference: the supplied PHP web project. Visual reference: the original mobile ZIP, as requested after the first rebuild. These are implemented source workflows, not a claim that every server policy has been exercised against a live deployment.

| Web capability | Rebuilt mobile implementation |
| --- | --- |
| Role-specific dashboard | Original student/parent dashboard layouts with campus counts, active/reserved live-ticket cards, feedback reminders, parent child summaries and child filtering |
| Office and event discovery | Search offices/events, opening/cutoff/capacity notices, office policy gating, explicit parent child selection |
| Walk-in and appointment | Multi-step request with mode/date/slot/slip where supported, priority choice, validation and review |
| Service request details | Categories/search, multiple services, quantities, configured choices, requirements, per-copy academic period/year and fee totals |
| Eligibility and routing | Office/prequeue checks and possible windows; refreshed configuration and eligibility before submission |
| Parent queue on behalf of child | Scoped student/parent payloads, relationship recheck before writes, physical ID/authorization acknowledgment |
| Cashier | Completed payable source request selection, amount display, priority and confirmation; hybrid office handling |
| Multi-step campus events | Itinerary/current step, configured services/requirements, academic data, linked payment source, current-step submission and refreshed advancement |
| Request unavailable services | Dedicated request dialog using backend unavailable-service/request contracts |
| Success and live ticket | Ticket code, owner, office/window, status, ETA/people ahead, appointment/reservation/dependencies, services/copies/requirements and timeline |
| Queue actions | Confirmation-based cancellation and eligible skipped-ticket requeue; state checked against current backend responses |
| History | Student/parent transaction list, child/status/type/search filters, statistics, pagination, expanded timeline and CSM response details |
| Client satisfaction measurement | Existing official form retained, validation tested, feedback reminders normalized for different role response shapes |
| Live monitor | Office/window tabs, now serving/next/waiting/last, expandable queues, own-ticket highlighting, saved visible-office preferences and optional foreground chime |
| Account notifications | Unread/all filter, mark one/all read, signed IDs preserved, linked-ticket navigation and live call prompt |
| Student profile | Personal/school details, grade/college/program catalogs, existing inactive values preserved, photo upload and password change |
| Parent profile | Personal/contact editing and password change |
| Student relationship approval | View linked parents and requests, approve/decline pending requests, confirmed unlink |
| Parent relationships | Add supported profile-only child or link existing exact school record; debounced match checking, approval-state handling and unlink |
| Empty/expired parent access | Add/link invitation, no automatic first-child queueing, stale selection cleared after relationship changes |
| Help/legal/logout | Updated guided route targets, isolated tutorial practice, legal links, authenticated logout/session cleanup |
| Native integrations | Existing Google authentication boundaries, push registration and Android live-ticket widget retained/integrated; device validation remains required |

## Cross-cutting rebuild changes

- New shared domain, API, role context and UI instead of divergent student/parent screen copies.
- Proper detail-screen stacks around original mobile navigation: three student tabs and five parent tabs. Forms, monitors and tickets remain reachable without treating detail screens as disabled tabs.
- Focus/foreground-aware reads with cancellation, scope-generation guards and no overlapping polls.
- Explicit loading, empty, retry and stale states; no silent retry of mutations.
- Single-flight request confirmation to prevent rapid duplicate submissions.
- Parent actor scope derived from the authenticated role and verified child, not URL flags.
- Original logo/help/bell header, greeting panels, office and child-card styling, with responsive layout, safe-area-aware tabs, readable form controls, accessible labels and branded checkboxes.

## Boundaries

School policy, fees, eligibility, office capacity, child approval, payment-source state and final authorization remain server-controlled. This project consumes the supplied API contracts; it does not create fake production responses. Test fixtures live only under `tests/fixtures` and are intercepted locally in the browser test harness. No new backend migration or staff/admin mobile interface is included.
