# Incremental mobile change manifest

Baseline: previously delivered professional mobile UI. No backend files changed.

- `app/login.tsx`
- `app/signup.tsx`
- `components/layout/app-header.tsx`
- `components/layout/config-drawer.tsx`
- `components/queue/proceed-modal.tsx`
- `constants/theme.ts`
- `features/account/profile.tsx`
- `features/portal/alert-gate.tsx`
- `features/portal/context.tsx`
- `features/portal/dashboard-styles.ts`
- `features/portal/home.tsx`
- `features/portal/parent-styles.ts`
- `features/portal/tabs.tsx`
- `features/portal/ui.tsx`
- `tests/maroon-alerts-ui.cjs`
- `tests/queue-alerts.cjs`
- `tests/queue-prompt.cjs`
- `tests/rebuild-ui.cjs`
- `utils/client-fetch.ts`
- `utils/queue-alerts.ts`
- `utils/queue-prompt.ts`

Runtime updates: styling, header menu, Logout labels, foreground queue prompt policy and haptic ownership. `utils/client-fetch.ts` changes only the user-facing logout error wording; authentication/network behavior is retained. Test files cover the new policy and existing logout label selectors.
