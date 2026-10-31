# Original mobile design restored

## Design source

`uniqueue-mobile-fixed-v3-queue-form.zip` — the original mobile archive supplied with the web project. The request after the first rebuild was to keep this original mobile design and retain only the web's functional parity, rather than adopting the earlier web-style redesign.

## Restored presentation

- Original `AppHeader`: supplied UniQueue logo, compact maroon title, help icon and notification bell/sheet.
- Original student greeting panel: maroon rounded card, avatar, greeting/name, date chip, portal footer and queue-status chip.
- Original compact Current Queue card: ticket code, office/window, status badge, people ahead, estimated wait and call time; opens the rebuilt full ticket.
- Original dashboard statistics and elevated office cards, including office icons, availability badges and nested event presentation. Student discovery is available directly on Home again.
- Original parent hero statistics, child avatars and per-child live ticket cards. Added filtering/selection controls do not replace the original family overview.
- Original profile avatar row, separate personal/academic cards, read-only academic values, and photo viewer/change action; rebuilt save/password/relationship logic remains.
- Original warm background, maroon colors, typography hierarchy, card radii and elevation. The actual original dashboard style declarations are reused in `features/portal/original-student-styles.ts` and `original-parent-styles.ts`.
- Original role-specific bottom navigation, with extra spacing to prevent clipped labels on the current Expo Web renderer.

Required new workflows (for example per-copy academic details, final parent authorization proof, event progression, cashier selection, full notification filtering and expanded history/CSM) are adapted to the original mobile visual system. This is not a rollback to the older application logic or a claim that all newly necessary screens existed in the original archive.

## Navigation map

### Student

- Home: `/student/home` — dashboard plus office/event discovery.
- Transactions: `/student/queue` — history/search/filters/timelines/CSM, matching the original tab's purpose.
- Profile: `/student/profile`.
- `/student/offices`: dedicated office/event discovery entry used by help/deep links.
- `/student/history`: retained history alias for existing links.
- Bell: original sheet, with **View all notifications** leading to `/student/notifications` and its unread filter/actions/ticket links.
- Ticket, queue wizard and monitor are outer-stack detail screens. `/student/queues/office-queue` still redirects to the canonical `/student/office-queue`.

### Parent / guardian

- Home: `/parent/home`.
- Add: `/parent/add-child` — add or link child.
- History: `/parent/history`.
- Alerts: `/parent/notifications`.
- Profile: `/parent/profile`.
- `/parent/queue`: office/event discovery after selecting a child; not an additional tab.
- Ticket, queue wizard and monitor are outer-stack detail screens.

All child-dependent writes retain the authenticated role and verified child scope; selection is never inferred from a spoofable URL role flag. School policy and final authorization remain server-side.

## Delivery boundaries

This is the complete updated source, not an APK/IPA or an overlay patch. Setup and release limitations remain documented in `README.md` and `VALIDATION.md`. The inherited HTTP profile still blocks production use until HTTPS is configured; native device, live-server, push and widget verification remain required.
