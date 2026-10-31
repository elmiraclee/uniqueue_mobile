# UniQueue — web maroon color correction

The previous mobile palette was too pink/burgundy. Color tokens now match the uploaded web source `public/assets/css/theme.css`:

- Primary: #660810 (was #76152B)
- Light: #8A2E35
- Dark: #450509
- Soft/tinted surfaces use the same red-maroon family rather than pink-purple tints.

Live-site retrieval failed during this check; the exact reference is the uploaded web theme, not a newly verified live deployment.

## Scope
Only four mobile color files changed. Layout, queue alerts, repeating foreground vibration, header profile menu, Logout behavior, API logic and backend files are unchanged. The earlier device/OS limitations remain. No deployment or APK build was performed.

## Installation
Use either package, not both:
1. Color-only patch: merge the four `uniqueue_mobile/` files into the previous maroon mobile source; back up local edits first. No npm dependency changes or backend upload is required. Restart Metro with `npx expo start -c` if the old palette is cached.
2. Complete source: extract `uniqueue_mobile/` to a clean folder and run `npm ci`, then the usual development build commands. This includes all preceding mobile fixes plus the corrected colors.

## Checks for this color-only update
TypeScript and Expo Web export passed. Six navigation/UI cases at 320/390/1440px passed with zero browser page exceptions and no horizontal page overflow. Exact primary/light/dark token matches were checked against the uploaded web CSS. Backend comparison: 1,826 files unchanged. Existing functional/device validation notes in the complete source concern the preceding feature release; they are not a claim of live/device testing for this palette-only correction.
