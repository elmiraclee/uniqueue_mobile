# Mobile error fixes + folder cleanup (Oct 2026)

No business logic was changed.

## Errors fixed
| Error | Cause | Fix |
| --- | --- | --- |
| `Cannot find native module 'UniqueueWidget'` | The widget is native Android code. It only exists in an EAS/dev build, never in Expo Go. `requireNativeModule` threw on every queue refresh. | `modules/uniqueue-widget/index.ts` now uses `requireOptionalNativeModule`, so it returns `null`. `utils/live-ticket-widget.ts` caches the result. Widget calls do nothing when the module is missing. |
| Widget/background service crashes | `startForeground()` could throw on Android 12+ background starts and on Android 15 boot. The dataSync time limit (Android 15) was not handled. | `UniqueueRealtimeService` checks `startForeground` and falls back to the widget refresh alarm. It also adds `onTimeout`. `UniqueueBootReceiver` skips the foreground service on Android 15+. |
| `SafeAreaView has been deprecated` | `login.tsx`, `signup.tsx`, `student/live-queue.tsx` imported it from `react-native`. | Now imported from `react-native-safe-area-context`. On Android, live-queue keeps its old top spacing. |
| `Fetch Offices/Events/Current Queue Error: Empty response (HTTP 500)` | Server side: `uniqueue_api/lib/` (shared.php, web/functions.php, web/algo.php) is **not uploaded** to uni-queue.site. Every endpoint that requires it fails with a PHP fatal error. | Upload the `lib/` folder from the API zip (see below). |
| `Notification API returned 500` | Uncaught mysqli/push errors in `check_notification.php`. | API patch: errors are logged and the endpoint always returns JSON. |
| TypeScript errors | `showBack` prop, `TYPOGRAPHY.h3`, and a broken, unused `live-queue-modal.tsx` (`API.getOfficeQueue` did not exist). | `tsc --noEmit` now passes. |

## Removed (duplicates / leftovers)
- `mobile/` and `mobile.zip`: an old copy of the whole app
- `constants/app`, `constants/components`, `constants/constants`, `constants/utils`, `constants/app.json`, `constants/package.json`, `constants/tsconfig.json`, `constants/eslint.config.js`: another old copy nested inside `constants/`
- `hooks/`, `utils/safe-json.ts`, `metro-shims/empty.js`, `assets/images/*react-logo*`: unused template leftovers
- `components/queue/live-queue-modal.tsx`: unused and broken

## Added
- `expo-dev-client` (required by the `development` profile in `eas.json`)

## To see the widget, run a real build (not Expo Go)
```
eas build --profile development --platform android   # or: npx expo run:android
npx expo start --dev-client
```
