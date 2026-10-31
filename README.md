# UniQueue Mobile — original design + web parity v2.1.0

Complete Expo / React Native source project using the original design from `uniqueue-mobile-fixed-v3-queue-form.zip`, while retaining the rebuilt student and parent/guardian workflows matched to `uniqueue-web-fixed.zip`. This supersedes the earlier redesigned v2.0.0 delivery. It is a replacement project, not a patch to overlay onto an old mobile folder. Extract into a new folder.

## Run

Use Node 24 and npm. From this project's root:

```sh
npm ci
npm run typecheck
npm test
npm run test:navigation
npm run web
```

For Android/iOS, use a development build with the project's native dependencies (`npx expo run:android` or `npx expo run:ios`, on an appropriately configured workstation), or your existing EAS development/preview build workflow. `npm run android` / `npm run ios` start Expo and open an available installed client; they do not create a signed release. Native Google sign-in, notifications, and the custom Android widget require native builds; Expo Go/web are not substitutes for device validation.

## Backend and configuration

The app targets the PHP endpoints already supplied in the web archive under `uniqueue_api`. Deploy that matching backend, database, and server configuration separately. No web/backend source or server secrets are included in this ZIP. The rebuild does not bypass server-side role, relationship, office, capacity, event, or payment rules.

`deployment.generated.json` is the authoritative API/public-web URL configuration consumed by `constants/backend.ts` and `app.config.js`. Changing only `EXPO_PUBLIC_API_URL` does **not** change that imported API URL. If using the web project's deployment selector, regenerate/copy its matching mobile deployment profile; otherwise carefully update this JSON to match the actual deployed PHP profile. Rebuild native clients after transport/profile changes.

The supplied development profile is preserved and uses HTTP. **Do not send real account credentials or student data through it. Production release is blocked until both URLs use HTTPS and `allow_insecure_http` is false.** Run:

```sh
npm run check:release
# Also check iOS OAuth configuration when targeting iOS:
npm run check:release -- --ios
```

The check is expected to fail against the included HTTP profile. Do not silence it. Optional web/mobile profile comparison: `npm run check:release -- --web-dir /path/to/uniqueue`.

`.env.development.example` documents inherited public development settings. Local `.env` is deliberately excluded. Configure Google OAuth client IDs for your application/signatures; iOS client ID is not supplied. `google-services.json` is the supplied Firebase client configuration, not a server service-account credential. Verify Firebase ownership, EAS project identifiers, Android package, iOS bundle identifier, signing, OAuth redirects, and push credentials before building for your deployment. Never embed database/SMTP/service-account secrets in the app.

## New architecture

- `features/portal`: role-scoped session/context, focused cancellable resources, dashboard, offices, ticket, monitor, history, alerts, shared UI, proper detail stacks and the original role-specific tab navigation.
- `features/queue`: validated request model and full regular/appointment/cashier/event wizard.
- `features/account`: profile, password, student/parent relationships, add/link child.
- `app/student` and `app/parent`: thin role route adapters; detail screens live outside the tab navigator. Legacy student queue deep link redirects to the canonical detail screen.
- Existing secure session/authentication, official CSM form, tutorial practice, push integration, and native widget support are integrated rather than replaced with mock implementations.

The UI restores the original mobile logo/header, maroon greeting panels, warm background, elevated office/current-ticket cards, and round profile avatars. Student tabs are Home / Transactions / Profile; parent tabs are Home / Add / History / Alerts / Profile. New web-parity controls use this original mobile visual system rather than the earlier web-style redesign. Parent selection is explicit before queueing, and parent physical-ID/authorization confirmation is required. Expired child access is invalidated instead of silently reusing an old child ID.

See `ORIGINAL-DESIGN.md` for restored layout/navigation details, `FEATURE-PARITY.md` for workflow coverage and `VALIDATION.md` for exact tested scope and remaining release gates.
